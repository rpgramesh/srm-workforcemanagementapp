// app/api/manager/settings/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentActor } from "@/lib/server-session";
import { adminSettingsRepository } from "@/features/settings/repositories/supabase-admin-settings-repository";
import { revalidatePath } from "next/cache";
import type { AppRole } from "@/types/app";

// Define role permissions
const ADMIN_ROLES: AppRole[] = ["super_admin", "restaurant_admin"];
const VIEWER_ROLES: AppRole[] = ["manager", "supervisor", "employee"];

const AdminSettingsSchema = z.object({
  siteName: z.string().trim().min(2).max(64),
  openHoursStart: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/),
  openHoursEnd: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/),
  defaultTimezone: z.string().min(1),
  auMobileFormat: z.boolean(),
  requireHttps: z.boolean(),
  sessionTimeoutMins: z.number().int().min(5).max(1440),
  maxLoginAttempts: z.number().int().min(1).max(20),
  maxPasswordExpiryDays: z.number().int().min(0).max(365),
  theme: z.enum(["light", "dark", "system"]),
  allowNotifications: z.boolean(),
  currency: z.string().min(1).max(10),
  allowSelfRegistration: z.boolean(),
  defaultUserRole: z.enum([
    "super_admin",
    "restaurant_admin",
    "manager",
    "supervisor",
    "employee",
  ]),
});

export async function GET() {
  try {
    const actor = await getCurrentActor();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (![...ADMIN_ROLES, ...VIEWER_ROLES].includes(actor.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const settings = await adminSettingsRepository.getSettings();
    if (!settings) return NextResponse.json({ error: "Settings not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: settings });
  } catch (err: any) {
    console.error("GET /api/manager/settings error:", err);
    return NextResponse.json({ error: err.message || "Failed to retrieve" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await getCurrentActor();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!ADMIN_ROLES.includes(actor.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    const updated = await adminSettingsRepository.updateSettings(parsed.data);
    try { await revalidatePath("/settings/manager"); } catch {}
    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    console.error("PUT /api/manager/settings error:", err);
    return NextResponse.json({ error: err.message || "Failed to update" }, { status: 500 });
  }
}
