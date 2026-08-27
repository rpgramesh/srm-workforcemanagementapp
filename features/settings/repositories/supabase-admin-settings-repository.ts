import { createSupabaseServerClient } from "@/lib/supabase";
import { handleResult } from "@/features/data/supabase-utils";
import type { AdminSettings } from "@/types/domain";

export class SupabaseAdminSettingsRepository {
  async getSettings(): Promise<AdminSettings | null> {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("admin_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }
    
    if (!data) return null;

    return {
      id: data.id,
      siteName: data.site_name,
      openHoursStart: data.open_hours_start,
      openHoursEnd: data.open_hours_end,
      defaultTimezone: data.default_timezone,
      auMobileFormat: data.au_mobile_format,
      requireHttps: data.require_https,
      updatedAt: data.updated_at,
      sessionTimeoutMins: data.session_timeout_mins,
      maxLoginAttempts: data.max_login_attempts,
      maxPasswordExpiryDays: data.max_password_expiry_days,
      theme: data.theme,
      allowNotifications: data.allow_notifications,
      currency: data.currency,
      allowSelfRegistration: data.allow_self_registration,
      defaultUserRole: data.default_user_role,
    };
  }

  async updateSettings(settings: Partial<Omit<AdminSettings, "id" | "updatedAt">>): Promise<AdminSettings> {
    const supabase = await createSupabaseServerClient();
    
    const updates: Record<string, any> = {};
    if (settings.siteName !== undefined) updates.site_name = settings.siteName;
    if (settings.openHoursStart !== undefined) updates.open_hours_start = settings.openHoursStart;
    if (settings.openHoursEnd !== undefined) updates.open_hours_end = settings.openHoursEnd;
    if (settings.defaultTimezone !== undefined) updates.default_timezone = settings.defaultTimezone;
    if (settings.auMobileFormat !== undefined) updates.au_mobile_format = settings.auMobileFormat;
    if (settings.requireHttps !== undefined) updates.require_https = settings.requireHttps;
    if (settings.sessionTimeoutMins !== undefined) updates.session_timeout_mins = settings.sessionTimeoutMins;
    if (settings.maxLoginAttempts !== undefined) updates.max_login_attempts = settings.maxLoginAttempts;
    if (settings.maxPasswordExpiryDays !== undefined) updates.max_password_expiry_days = settings.maxPasswordExpiryDays;
    if (settings.theme !== undefined) updates.theme = settings.theme;
    if (settings.allowNotifications !== undefined) updates.allow_notifications = settings.allowNotifications;
    if (settings.currency !== undefined) updates.currency = settings.currency;
    if (settings.allowSelfRegistration !== undefined) updates.allow_self_registration = settings.allowSelfRegistration;
    if (settings.defaultUserRole !== undefined) updates.default_user_role = settings.defaultUserRole;

    const { data, error } = await supabase
      .from("admin_settings")
      .update(updates)
      .eq("id", 1)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      id: data.id,
      siteName: data.site_name,
      openHoursStart: data.open_hours_start,
      openHoursEnd: data.open_hours_end,
      defaultTimezone: data.default_timezone,
      auMobileFormat: data.au_mobile_format,
      requireHttps: data.require_https,
      updatedAt: data.updated_at,
      sessionTimeoutMins: data.session_timeout_mins,
      maxLoginAttempts: data.max_login_attempts,
      maxPasswordExpiryDays: data.max_password_expiry_days,
      theme: data.theme,
      allowNotifications: data.allow_notifications,
      currency: data.currency,
      allowSelfRegistration: data.allow_self_registration,
      defaultUserRole: data.default_user_role,
    };
  }
}

export const adminSettingsRepository = new SupabaseAdminSettingsRepository();
