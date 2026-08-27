import { adminSettingsRepository } from '@/features/settings/repositories/supabase-admin-settings-repository';

/**
 * Retrieves the opening hours configuration from admin settings.
 * Returns an object with `start` and `end` in HH:MM (24h) format.
 */
export async function getOpeningHours(): Promise<{ start: string; end: string }> {
  const settings = await adminSettingsRepository.getSettings();
  if (!settings) {
    // Default to full day if not configured
    return { start: '00:00', end: '23:59' };
  }
  return { start: settings.openHoursStart, end: settings.openHoursEnd };
}
