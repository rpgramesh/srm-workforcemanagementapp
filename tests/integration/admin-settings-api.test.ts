import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { test, after } from "node:test";
import assert from "node:assert";

// Integration test for Settings API Route Handlers
test("Admin Settings API Route Handlers", async (t) => {
  // Dynamically import Route Handler and repositories to ensure dotenv is fully loaded
  const { GET, PUT } = await import("@/app/api/admin/settings/route");
  const { adminSettingsRepository } = await import("@/features/settings/repositories/supabase-admin-settings-repository");

  after(() => {
    // Clean up mock actor global
    delete (global as any).__mockActor;
  });

  await t.test("1. GET - Reject unauthorized role (employee)", async () => {
    (global as any).__mockActor = {
      userId: "test-employee-id",
      role: "employee",
      fullName: "John Employee",
      issuedAt: Date.now(),
    };

    const response = await GET();
    assert.strictEqual(response.status, 401, "Should reject employee role with 401");
    const json = await response.json();
    assert.strictEqual(json.error, "Unauthorized");
  });

  await t.test("2. GET - Allow admin role (super_admin)", async () => {
    (global as any).__mockActor = {
      userId: "test-admin-id",
      role: "super_admin",
      fullName: "Super Admin",
      issuedAt: Date.now(),
    };

    const response = await GET();
    assert.strictEqual(response.status, 200, "Should allow super_admin with 200");
    const json = await response.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.data, "Should return settings data");
  });

  await t.test("3. PUT - Reject unauthorized role (employee)", async () => {
    (global as any).__mockActor = {
      userId: "test-employee-id",
      role: "employee",
      fullName: "John Employee",
      issuedAt: Date.now(),
    };

    const request = new Request("http://localhost:3000/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify({ siteName: "Hack" }),
    });

    const response = await PUT(request);
    assert.strictEqual(response.status, 401, "Should reject employee role with 401");
  });

  await t.test("4. PUT - Reject invalid schema format (validation failed)", async () => {
    (global as any).__mockActor = {
      userId: "test-admin-id",
      role: "restaurant_admin",
      fullName: "Restaurant Admin",
      issuedAt: Date.now(),
    };

    // sessionTimeoutMins is invalid (too small), theme is invalid
    const invalidPayload = {
      siteName: "A", // too short
      openHoursStart: "25:00", // invalid hour
      openHoursEnd: "23:00",
      defaultTimezone: "Australia/Sydney",
      auMobileFormat: true,
      requireHttps: true,
      sessionTimeoutMins: 2, // invalid (min 5)
      maxLoginAttempts: 5,
      maxPasswordExpiryDays: 90,
      theme: "invalid-theme",
      allowNotifications: true,
      currency: "AUD",
      allowSelfRegistration: false,
      defaultUserRole: "employee",
    };

    const request = new Request("http://localhost:3000/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify(invalidPayload),
    });

    const response = await PUT(request);
    assert.strictEqual(response.status, 400, "Should fail validation with 400");
    const json = await response.json();
    assert.strictEqual(json.error, "Validation failed");
    assert.ok(json.issues, "Should list validation issues");
    assert.ok(json.issues.siteName, "Should complain about siteName");
    assert.ok(json.issues.openHoursStart, "Should complain about openHoursStart");
    assert.ok(json.issues.sessionTimeoutMins, "Should complain about sessionTimeoutMins");
    assert.ok(json.issues.theme, "Should complain about theme");
  });

  await t.test("5. PUT - Update settings successfully and persist", async () => {
    (global as any).__mockActor = {
      userId: "test-admin-id",
      role: "restaurant_admin",
      fullName: "Restaurant Admin",
      issuedAt: Date.now(),
    };

    const original = await adminSettingsRepository.getSettings();
    assert.ok(original, "Original settings must exist");

    const testSiteName = "ShiftMaster Integration Test";
    const testTimeout = original.sessionTimeoutMins === 60 ? 45 : 60;

    const validPayload = {
      siteName: testSiteName,
      openHoursStart: original.openHoursStart.slice(0, 5),
      openHoursEnd: original.openHoursEnd.slice(0, 5),
      defaultTimezone: original.defaultTimezone,
      auMobileFormat: original.auMobileFormat,
      requireHttps: original.requireHttps,
      sessionTimeoutMins: testTimeout,
      maxLoginAttempts: original.maxLoginAttempts,
      maxPasswordExpiryDays: original.maxPasswordExpiryDays,
      theme: original.theme,
      allowNotifications: original.allowNotifications,
      currency: original.currency,
      allowSelfRegistration: original.allowSelfRegistration,
      defaultUserRole: original.defaultUserRole,
    };

    const request = new Request("http://localhost:3000/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify(validPayload),
    });

    const response = await PUT(request);
    assert.strictEqual(response.status, 200, "Should succeed with 200");
    const json = await response.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.siteName, testSiteName);
    assert.strictEqual(json.data.sessionTimeoutMins, testTimeout);

    // Verify in database
    const reFetched = await adminSettingsRepository.getSettings();
    assert.ok(reFetched);
    assert.strictEqual(reFetched.siteName, testSiteName);
    assert.strictEqual(reFetched.sessionTimeoutMins, testTimeout);

    // Restore original settings
    await adminSettingsRepository.updateSettings({
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
  });
});
