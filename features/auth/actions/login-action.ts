"use server";

import { headers } from "next/headers";
import { userService } from "@/features/users/services/user-service";
import type { AdminLoginResult } from "@/features/users/services/user-service";
import { auditLogRepository } from "@/features/audit/repositories/supabase-audit-log-repository";
import { setActorSession, clearActorSession, getCurrentActor } from "@/lib/server-session";
import { canAccessAdminDashboard } from "@/types/user";
import { normalizeAustralianMobile } from "@/features/auth/services/au-mobile";

const RATE_LIMIT_WINDOW_MS = 60_000 * 5;
const RATE_LIMIT_MAX_ATTEMPTS = 8;
const FAILURE_COOLDOWN_MS = 1_200;

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
  if (!canAccessAdminDashboard(a.role)) return null;
  return a;
}

export async function logout(): Promise<void> {
  await clearActorSession();
}
