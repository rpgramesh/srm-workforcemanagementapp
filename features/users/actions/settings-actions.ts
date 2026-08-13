"use server";

import { z } from "zod";
import { getCurrentActor } from "@/lib/server-session";
import { auditLogRepository } from "@/features/audit/repositories/supabase-audit-log-repository";
import { updateStaff, getStaffForEdit } from "./staff-actions";
import { normalizeAustralianMobile } from "@/features/auth/services/au-mobile";
import type { User } from "@/types/user";
import type { AppRole } from "@/types/app";

const PIN_FORMAT = /^\d{4}$/;

const ProfileUpdateSchema = z.object({
  firstName: z.string().trim().min(2, "First name must be at least 2 characters").max(64),
  lastName: z.string().trim().min(2, "Last name must be at least 2 characters").max(64),
  mobile: z.string().trim().refine((v) => !!normalizeAustralianMobile(v), "Enter a valid Australian mobile number"),
  email: z.union([z.string().trim().email("Enter a valid email"), z.null(), z.literal("")]),
  color: z.union([z.string().trim().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/, "Must be a hex color like #10B981"), z.null(), z.literal("")]),
  jobTitle: z.union([z.string().trim().max(128), z.null(), z.literal("")]),
});

const PinChangeSchema = z.object({
  currentPin: z.string().regex(PIN_FORMAT, "Current PIN must be 4 digits"),
  newPin: z.string().regex(PIN_FORMAT, "New PIN must be 4 digits"),
  confirmPin: z.string().regex(PIN_FORMAT, "Confirm PIN must be 4 digits"),
}).refine((d) => d.newPin === d.confirmPin, {
  message: "New PIN and confirmation do not match",
  path: ["confirmPin"],
}).refine((d) => d.currentPin !== d.newPin, {
  message: "New PIN must be different from current PIN",
  path: ["newPin"],
});

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;
export type PinChangeInput = z.infer<typeof PinChangeSchema>;

export interface ActionResult {
  success: boolean;
  message: string;
  issues?: Record<string, string[]>;
}

export async function getMyProfile(): Promise<User | null> {
  const actor = await getCurrentActor();
  if (!actor) return null;
  if (actor.userId.startsWith("env-")) {
    const role: AppRole =
      actor.userId === "env-super-admin" ? "super_admin" : actor.role ?? "employee";
    const fullName = actor.fullName ?? (role === "super_admin" ? "Super Admin" : "Staff Member");
    const [firstName, ...rest] = fullName.split(" ");
    const lastName = rest.join(" ");
    return {
      id: actor.userId,
      firstName,
      lastName,
      fullName,
      mobile: "",
      role,
      employeeId: null,
      jobTitle: role === "super_admin" ? "System Owner" : null,
      hourlyRate: null,
      avatarUrl: null,
      color: "#10B981",
      isActive: true,
      createdAt: new Date(actor.issuedAt),
      updatedAt: new Date(),
      email: null,
      departmentId: null,
      employmentDate: null,
      address: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      notes: null,
      permissions: {},
    };
  }
  return getStaffForEdit(actor.userId);
}

export async function updateMyProfile(raw: unknown): Promise<ActionResult> {
  const actor = await getCurrentActor();
  if (!actor) {
    return { success: false, message: "Not authenticated" };
  }

  const parsed = ProfileUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const issues: Record<string, string[]> = {};
    for (const e of parsed.error.issues) {
      const key = e.path.join(".") || "root";
      issues[key] = issues[key] ?? [];
      issues[key].push(e.message);
    }
    return { success: false, message: "Please fix the highlighted fields", issues };
  }

  if (actor.userId.startsWith("env-")) {
    return {
      success: true,
      message:
        "Preview mode: profile edits are not persisted for the seeded demo admin account. Sign in with a real seeded staff account to save changes.",
    };
  }

  const data = parsed.data;
  const result = await updateStaff({
    id: actor.userId,
    firstName: data.firstName,
    lastName: data.lastName,
    mobile: data.mobile,
    email: data.email || null,
    color: data.color || null,
    jobTitle: data.jobTitle || null,
  });

  if (!result.success) {
    return {
      success: false,
      message: result.message || "Failed to update profile",
      issues: result.issues as Record<string, string[]> | undefined,
    };
  }

  try {
    await auditLogRepository.append("staff_updated", {
      actorUserId: actor.userId,
      targetUserId: actor.userId,
      details: { source: "settings_profile" },
    });
  } catch {
    /* ignore audit errors */
  }

  return { success: true, message: "Profile updated successfully" };
}

export async function changePin(raw: unknown): Promise<ActionResult> {
  const actor = await getCurrentActor();
  if (!actor) {
    return { success: false, message: "Not authenticated" };
  }

  const parsed = PinChangeSchema.safeParse(raw);
  if (!parsed.success) {
    const issues: Record<string, string[]> = {};
    for (const e of parsed.error.issues) {
      const key = e.path.join(".") || "root";
      issues[key] = issues[key] ?? [];
      issues[key].push(e.message);
    }
    return { success: false, message: "Please fix the highlighted fields", issues };
  }

  if (actor.userId.startsWith("env-")) {
    return {
      success: true,
      message:
        "Preview mode: PIN changes are not persisted for the seeded demo admin account. Sign in with a real seeded staff account to save changes.",
    };
  }

  const result = await updateStaff({
    id: actor.userId,
    pin: parsed.data.newPin,
  });

  if (!result.success) {
    return {
      success: false,
      message: result.message || "Failed to change PIN",
      issues: result.issues as Record<string, string[]> | undefined,
    };
  }

  try {
    await auditLogRepository.append("pin_changed", {
      actorUserId: actor.userId,
      targetUserId: actor.userId,
      details: { source: "settings_security" },
    });
  } catch {
    /* ignore audit errors */
  }

  return { success: true, message: "PIN changed successfully" };
}

export async function updatePreferences(raw: {
  theme?: string | null;
  compactMode?: boolean | null;
  timezone?: string | null;
  language?: string | null;
  showOnlineStatus?: boolean | null;
  allowMessagesFrom?: "everyone" | "managers" | "none" | null;
}): Promise<ActionResult> {
  const actor = await getCurrentActor();
  if (!actor) {
    return { success: false, message: "Not authenticated" };
  }

  try {
    await auditLogRepository.append("staff_updated", {
      actorUserId: actor.userId,
      targetUserId: actor.userId,
      details: { source: "settings_preferences", ...raw },
    });
  } catch {
    /* ignore */
  }

  return { success: true, message: "Preferences saved" };
}
