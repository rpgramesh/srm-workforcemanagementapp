import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentActor } from "@/lib/server-session";
import { adminSettingsRepository } from "@/features/settings/repositories/supabase-admin-settings-repository";
import { auditLogRepository } from "@/features/audit/repositories/supabase-audit-log-repository";
import { revalidatePath } from "next/cache";
import type { AppRole } from "@/types/app";

const ADMIN_ROLES: AppRole[] = ["super_admin", "restaurant_admin"];

const AdminSettingsSchema = z.object({
  siteName: z.string().trim().min(2, "Site name must be at least 2 characters").max(64),
  openHoursStart: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, "Invalid time format (HH:MM)"),
  openHoursEnd: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, "Invalid time format (HH:MM)"),
  defaultTimezone: z.string().min(1, "Timezone is required"),
  auMobileFormat: z.boolean(),
  requireHttps: z.boolean(),
  sessionTimeoutMins: z.number().int().min(5, "Session timeout must be at least 5 minutes").max(1440, "Session timeout cannot exceed 24 hours"),
  maxLoginAttempts: z.number().int().min(1, "Max login attempts must be at least 1").max(20, "Max login attempts cannot exceed 20"),
  maxPasswordExpiryDays: z.number().int().min(0, "Password expiry cannot be negative").max(365, "Password expiry cannot exceed 1 year"),
  theme: z.enum(["light", "dark", "system"]),
  allowNotifications: z.boolean(),
  currency: z.string().min(1, "Currency is required").max(10),
  allowSelfRegistration: z.boolean(),
  defaultUserRole: z.enum(["super_admin", "restaurant_admin", "manager", "supervisor", "employee"]),
});

export async function GET() {
  try {
    const actor = await getCurrentActor();
    if (!actor || !ADMIN_ROLES.includes(actor.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await adminSettingsRepository.getSettings();
    if (!settings) {
      return NextResponse.json({ error: "Settings not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: settings });
  } catch (err: any) {
    console.error("GET /api/admin/settings error:", err);
    return NextResponse.json({ error: err.message || "Failed to retrieve settings" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await getCurrentActor();
    if (!actor || !ADMIN_ROLES.includes(actor.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await request.json();
    const parsed = AdminSettingsSchema.safeParse(rawBody);

    if (!parsed.success) {
      const issues: Record<string, string[]> = {};
      for (const e of parsed.error.issues) {
        const key = e.path.join(".") || "root";
        issues[key] = issues[key] ?? [];
        issues[key].push(e.message);
      }
      return NextResponse.json({ error: "Validation failed", issues }, { status: 400 });
    }

    const updatedSettings = await adminSettingsRepository.updateSettings(parsed.data);

    try {
      await auditLogRepository.append("settings_updated", {
        actorUserId: actor.userId,
        targetUserId: actor.userId,
        details: { source: "admin_settings_api", changes: parsed.data },
      });
    } catch (auditErr) {
      console.warn("Failed to write settings audit log:", auditErr);
    }

    try {
      revalidatePath("/settings/admin");
    } catch (revalErr) {
      console.warn("revalidatePath skipped:", revalErr);
    }
    return NextResponse.json({ success: true, message: "Settings updated successfully", data: updatedSettings });
  } catch (err: any) {
    console.error("PUT /api/admin/settings error:", err);
    return NextResponse.json({ error: err.message || "Failed to update settings" }, { status: 500 });
  }
}
