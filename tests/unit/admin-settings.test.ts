import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { test } from "node:test";
import assert from "node:assert";

test("Admin Settings Repository - CRUD/Read-Update Operations", async (t) => {
  const { adminSettingsRepository } = await import("@/features/settings/repositories/supabase-admin-settings-repository");

  await t.test("should fetch admin settings successfully", async () => {
    const settings = await adminSettingsRepository.getSettings();
    assert.ok(settings, "Should retrieve settings");
    assert.strictEqual(settings.id, 1, "Settings ID must be 1");
    assert.ok(typeof settings.siteName === "string", "siteName should be a string");
    assert.ok(typeof settings.sessionTimeoutMins === "number", "sessionTimeoutMins should be a number");
  });

  await t.test("should update and persist settings correctly", async () => {
    // 1. Get original settings
    const original = await adminSettingsRepository.getSettings();
    assert.ok(original, "Original settings must exist");

    // 2. Perform a test update
    const nextSiteName = `Test Venue - ${Date.now()}`;
    const nextTimeout = original.sessionTimeoutMins === 30 ? 45 : 30;

    const updated = await adminSettingsRepository.updateSettings({
      siteName: nextSiteName,
      sessionTimeoutMins: nextTimeout,
    });

    assert.strictEqual(updated.siteName, nextSiteName, "siteName should be updated");
    assert.strictEqual(updated.sessionTimeoutMins, nextTimeout, "sessionTimeoutMins should be updated");

    // 3. Retrieve from DB again to verify persistence
    const reFetched = await adminSettingsRepository.getSettings();
    assert.ok(reFetched, "Refetched settings must exist");
    assert.strictEqual(reFetched.siteName, nextSiteName, "siteName must match updated value after refetch");
    assert.strictEqual(reFetched.sessionTimeoutMins, nextTimeout, "sessionTimeoutMins must match updated value after refetch");

    // 4. Restore original settings to leave database clean
    const restored = await adminSettingsRepository.updateSettings({
      siteName: original.siteName,
      sessionTimeoutMins: original.sessionTimeoutMins,
      openHoursStart: original.openHoursStart,
      openHoursEnd: original.openHoursEnd,
      defaultTimezone: original.defaultTimezone,
      auMobileFormat: original.auMobileFormat,
      requireHttps: original.requireHttps,
      maxLoginAttempts: original.maxLoginAttempts,
      maxPasswordExpiryDays: original.maxPasswordExpiryDays,
      theme: original.theme,
      allowNotifications: original.allowNotifications,
      currency: original.currency,
      allowSelfRegistration: original.allowSelfRegistration,
      defaultUserRole: original.defaultUserRole,
    });

    assert.strictEqual(restored.siteName, original.siteName, "Original siteName should be restored");
  });
});
