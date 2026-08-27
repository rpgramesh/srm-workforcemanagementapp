"use server";

import { z } from "zod";
import { getCurrentActor } from "@/lib/server-session";
import { adminSettingsRepository } from "../repositories/supabase-admin-settings-repository";
import { auditLogRepository } from "@/features/audit/repositories/supabase-audit-log-repository";
import type { AppRole } from "@/types/app";
import { revalidatePath } from "next/cache";
import type { AdminSettings } from "@/types/domain";

const ADMIN_ROLES: AppRole[] = ["super_admin", "restaurant_admin"];

const SystemConfigSchema = z.object({
  siteName: z.string().trim().min(2, "Site name must be at least 2 characters").max(64),
  openHoursStart: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Invalid time format"),
  openHoursEnd: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Invalid time format"),
  defaultTimezone: z.string().min(1, "Timezone is required"),
  auMobileFormat: z.boolean(),
});

export type SystemConfigInput = z.infer<typeof SystemConfigSchema>;

export interface ActionResult<T = void> {
  success: boolean;
  message: string;
  data?: T;
  issues?: Record<string, string[]>;
}

export async function getAdminSettings(): Promise<AdminSettings | null> {
  const actor = await getCurrentActor();
  if (!actor || !ADMIN_ROLES.includes(actor.role)) {
    return null;
  }
  return adminSettingsRepository.getSettings();
}

export async function updateSystemConfig(raw: unknown): Promise<ActionResult> {
  const actor = await getCurrentActor();
  if (!actor || !ADMIN_ROLES.includes(actor.role)) {
    return { success: false, message: "Unauthorized" };
  }

  const parsed = SystemConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const issues: Record<string, string[]> = {};
    for (const e of parsed.error.issues) {
      const key = e.path.join(".") || "root";
      issues[key] = issues[key] ?? [];
      issues[key].push(e.message);
    }
    return { success: false, message: "Please fix the highlighted fields", issues };
  }

  try {
    await adminSettingsRepository.updateSettings(parsed.data);
    
    try {
      await auditLogRepository.append("settings_updated", {
        actorUserId: actor.userId,
        targetUserId: actor.userId, // Self
        details: { source: "admin_settings_panel", changes: parsed.data },
      });
    } catch {
      /* ignore audit error */
    }

    revalidatePath("/settings/admin");
    return { success: true, message: "System configuration saved successfully" };
  } catch (err: any) {
    console.error("updateSystemConfig error:", err);
    return { success: false, message: err.message || "Failed to save configuration" };
  }
}
