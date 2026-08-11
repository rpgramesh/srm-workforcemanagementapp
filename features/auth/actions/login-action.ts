"use server";

import { headers, cookies } from "next/headers";
import { createHash } from "node:crypto";
import { userService } from "@/features/users/services/user-service";
import type { AdminLoginResult } from "@/features/users/services/user-service";
import { auditLogRepository } from "@/features/audit/repositories/supabase-audit-log-repository";
import { setActorSession, clearActorSession, getCurrentActor } from "@/lib/server-session";
import { canAccessAdminDashboard } from "@/types/user";
import { normalizeAustralianMobile } from "@/features/auth/services/au-mobile";
import { staffManagementService } from "@/features/users/services/staff-management-service";
import type { AppRole } from "@/types/app";

const RATE_LIMIT_WINDOW_MS = 60_000 * 5;
const RATE_LIMIT_MAX_ATTEMPTS = 8;
const FAILURE_COOLDOWN_MS = 1_200;
const LOGOUT_COOLDOWN_MS = 250;

interface AttemptTracker {
  timestamps: number[];
}

const attemptStore: Map<string, AttemptTracker> = new Map();

function pruneOldTimestamps(tracker: AttemptTracker, now: number) {
  tracker.timestamps = tracker.timestamps.filter(
    (ts) => now - ts <= RATE_LIMIT_WINDOW_MS,
  );
}

function keyFor(normalizedMobile: string | null, clientIp: string): string {
  const userPart = normalizedMobile
    ? Buffer.from(normalizedMobile, "utf-8").toString("base64url")
    : "anon";
  const ipPart = Buffer.from(clientIp, "utf-8").toString("base64url");
  return `${ipPart}:${userPart}`;
}

function extractClientIp(h: Headers): string {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const cf = h.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const vercel = h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;
  return "unknown";
}

function extractUserAgent(h: Headers): string | null {
  return h.get("user-agent") ?? null;
}

function assertSecureTransport(h: Headers): void {
  const proto = (h.get("x-forwarded-proto") ?? "").trim().toLowerCase();
  const url = (h.get(":scheme") ?? "").trim().toLowerCase();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const isLocalHost = /^localhost(?:$|:)/.test(host) || host.endsWith(".local");
  const isVercelPreview = host.endsWith(".vercel.app");
  if (isLocalHost || isVercelPreview) return;
  if (proto && proto !== "https") {
    throw new Error("Insecure transport denied — authentication requires HTTPS.");
  }
  if (url && url !== "https") {
    throw new Error("Insecure transport denied — authentication requires HTTPS.");
  }
}

function supabaseProjectRef(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  try {
    const u = new URL(raw);
    const host = u.hostname;
    const m = host.match(/^([a-z0-9]+)\.supabase\.(co|in)$/i);
    if (m && m[1]) return m[1]!;
  } catch {
    /* fallthrough */
  }
  return createHash("sha256").update(raw).digest("hex").slice(0, 20);
}

interface LogoutOptions {
  clientIp?: string;
  userAgent?: string | null;
}

export type DashboardAccessResult =
  | { readonly allowed: true; readonly role: AppRole; readonly reason: "role_allowed" }
  | { readonly allowed: false; readonly role: AppRole; readonly reason: "role_denied" };

export async function canAccessDashboard(role: AppRole): Promise<DashboardAccessResult> {
  const ok = canAccessAdminDashboard(role);
  return ok
    ? { allowed: true, role, reason: "role_allowed" }
    : { allowed: false, role, reason: "role_denied" };
}

export async function adminLogin(
  mobile: string,
  pin: string,
): Promise<AdminLoginResult> {
  const h = await headers();
  assertSecureTransport(h);
  const clientIp = extractClientIp(h);
  const userAgent = extractUserAgent(h);

  const mobileRaw = typeof mobile === "string" ? mobile : "";
  const pinRaw = typeof pin === "string" ? pin : "";
  const normalizedMobile = normalizeAustralianMobile(mobileRaw) ?? null;

  const key = keyFor(normalizedMobile, clientIp);
  const now = Date.now();
  const tracker = attemptStore.get(key) ?? { timestamps: [] };
  pruneOldTimestamps(tracker, now);
  if (tracker.timestamps.length >= RATE_LIMIT_MAX_ATTEMPTS) {
    try {
      await auditLogRepository.append("login_failure", {
        actorUserId: null,
        targetUserId: null,
        clientIp,
        userAgent,
        details: {
          reason: "rate_limited",
          windowMs: RATE_LIMIT_WINDOW_MS,
          attempts: tracker.timestamps.length,
        },
      });
    } catch {
      /* ignore audit errors in rate-limit path */
    }
    return {
      success: false,
      message: "Too many attempts",
      description:
        "Too many failed sign-in attempts from this location. Please wait a few minutes and try again.",
    };
  }

  await new Promise((resolve) => setTimeout(resolve, FAILURE_COOLDOWN_MS));

  const r = await userService.adminLogin({ mobile: mobileRaw, pin: pinRaw });

  if (r.success && r.verified) {
    await setActorSession({
      userId: r.verified.user.id,
      role: r.verified.user.role,
      fullName: r.verified.user.fullName,
    });
    attemptStore.delete(key);
    try {
      await auditLogRepository.append("login_success", {
        actorUserId: r.verified.user.id,
        targetUserId: r.verified.user.id,
        departmentId: r.verified.user.departmentId ?? null,
        clientIp,
        userAgent,
        details: {
          source: r.verified.source,
          role: r.verified.user.role,
        },
      });
    } catch {
      /* audit errors never prevent login success */
    }
  } else {
    tracker.timestamps.push(now);
    attemptStore.set(key, tracker);
    try {
      await auditLogRepository.append("login_failure", {
        actorUserId: null,
        targetUserId: null,
        clientIp,
        userAgent,
        details: {
          reason: "invalid_credentials",
          mobileProvided: !!mobileRaw,
          mobileNormalized: !!normalizedMobile,
          pinLength: pinRaw.length,
        },
      });
    } catch {
      /* ignore */
    }
  }
  return r;
}

export async function currentActorInfo() {
  const a = await getCurrentActor();
  if (!a) return null;
  const access = await canAccessDashboard(a.role);
  if (!access.allowed) return null;
  return a;
}

export async function logout(options?: LogoutOptions): Promise<void> {
  const h = await headers();
  const clientIp = options?.clientIp ?? extractClientIp(h);
  const userAgent = options?.userAgent ?? extractUserAgent(h);

  const actor = await getCurrentActor();
  const actorUserId = actor?.userId ?? null;
  const departmentId = actor ? (actor as { departmentId?: string | null }).departmentId ?? null : null;

  await clearActorSession();

  const c = await cookies();
  c.delete("sfm_actor_sig_v1");
  c.delete("sb-access-token");
  c.delete("sb-refresh-token");
  const loopbackCookie = `sb-${supabaseProjectRef()}-auth-token.loopback`;
  c.delete(loopbackCookie);

  await new Promise((resolve) => setTimeout(resolve, LOGOUT_COOLDOWN_MS));

  try {
    await auditLogRepository.append("logout", {
      actorUserId,
      targetUserId: actorUserId,
      departmentId,
      clientIp,
      userAgent,
      details: {
        source: actor ? "actor_session" : "no_session",
      },
    });
  } catch {
    /* audit errors never prevent logout */
  }
}

export async function changePin(
  oldPin: string,
  newPin: string,
): Promise<{ success: boolean; message: string; description?: string }> {
  const h = await headers();
  assertSecureTransport(h);
  const clientIp = extractClientIp(h);
  const userAgent = extractUserAgent(h);

  const actor = await getCurrentActor();
  if (!actor) {
    return {
      success: false,
      message: "Not signed in",
      description: "You must be signed in to change your PIN.",
    };
  }

  const dashboardAccess = await canAccessDashboard(actor.role);
  if (!dashboardAccess.allowed) {
    return {
      success: false,
      message: "Permission denied",
      description: "Your role is not authorised to change your PIN via this endpoint.",
    };
  }

  const oldPinRaw = typeof oldPin === "string" ? oldPin : "";
  const newPinRaw = typeof newPin === "string" ? newPin : "";

  if (!/^\d{4}$/.test(oldPinRaw) || !/^\d{4}$/.test(newPinRaw)) {
    return {
      success: false,
      message: "Invalid PIN format",
      description: "Both old and new PIN must be exactly 4 digits.",
    };
  }

  if (oldPinRaw === newPinRaw) {
    return {
      success: false,
      message: "New PIN matches old PIN",
      description: "Your new PIN must be different from your current PIN.",
    };
  }

  const actorRecord = await userService.getUser(actor.userId);
  if (!actorRecord || !actorRecord.mobile) {
    return {
      success: false,
      message: "Account not found",
      description: "Your account record could not be located.",
    };
  }

  const verifyResult = await userService.adminLogin({
    mobile: actorRecord.mobile,
    pin: oldPinRaw,
  });
  if (!verifyResult.success || !verifyResult.verified) {
    try {
      await auditLogRepository.append("pin_changed", {
        actorUserId: actor.userId,
        targetUserId: actor.userId,
        departmentId: (actorRecord.departmentId ?? null) as string | null,
        clientIp,
        userAgent,
        details: {
          outcome: "failed",
          reason: "old_pin_invalid",
        },
      });
    } catch {
      /* ignore */
    }
    return {
      success: false,
      message: "Current PIN incorrect",
      description: "The old PIN you entered does not match our records.",
    };
  }

  const updateResult = await staffManagementService.updateStaff(
    { userId: actor.userId, role: actor.role },
    { id: actor.userId, pin: newPinRaw },
  );

  if (!updateResult.success) {
    try {
      await auditLogRepository.append("pin_changed", {
        actorUserId: actor.userId,
        targetUserId: actor.userId,
        departmentId: (actorRecord.departmentId ?? null) as string | null,
        clientIp,
        userAgent,
        details: {
          outcome: "failed",
          reason: "update_error",
          issues: updateResult.issues ?? null,
        },
      });
    } catch {
      /* ignore */
    }
    return {
      success: false,
      message: updateResult.message,
      description: updateResult.description,
    };
  }

  try {
    await auditLogRepository.append("pin_changed", {
      actorUserId: actor.userId,
      targetUserId: actor.userId,
      departmentId: (actorRecord.departmentId ?? null) as string | null,
      clientIp,
      userAgent,
      details: {
        outcome: "success",
      },
    });
  } catch {
    /* ignore */
  }

  return {
    success: true,
    message: "PIN updated",
    description: "Your security PIN has been changed successfully.",
  };
}
