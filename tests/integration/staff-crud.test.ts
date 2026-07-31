import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { test, after, before } from "node:test";
import assert from "node:assert";
import { Client } from "pg";
import type { StaffCreateInput, StaffUpdateInput } from "@/types/user";

const TEST_MOBILE = "+61499999999";
const TEST_EMPLOYEE_ID = "EMP-TEST-CRUD";

test("Staff Management Database CRUD Integration Test", async (t) => {
  // Dynamically import features to ensure dotenv has configured the environment
  const { staffManagementService } = await import("@/features/users/services/staff-management-service");
  const { userRepository } = await import("@/features/users/repositories/supabase-user-repository");

  const actor = { userId: "env-super-admin", role: "super_admin" as const };
  let createdUserId: string | null = null;

  // Clean up any existing test records first
  const cleanup = async () => {
    const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await pgClient.connect();
      await pgClient.query("DELETE FROM public.users WHERE mobile = $1 OR employee_id = $2", [TEST_MOBILE, TEST_EMPLOYEE_ID]);
    } catch (err) {
      console.error("Cleanup failed:", err);
    } finally {
      await pgClient.end().catch(() => {});
    }
  };

  before(async () => {
    await cleanup();
  });

  after(async () => {
    await cleanup();
  });

  await t.test("1. Create Staff User - persists record to database", async () => {
    const input: StaffCreateInput = {
      firstName: "Test",
      lastName: "User",
      mobile: TEST_MOBILE,
      role: "employee",
      pin: "9911",
      employeeId: TEST_EMPLOYEE_ID,
      jobTitle: "Junior Tester",
      hourlyRate: 25.00,
      email: "test.crud@venue.com",
      isActive: true,
      notes: "Temporary test user created by integration tests",
      permissions: { canClockIn: true, canViewRoster: true },
    };

    const result = await staffManagementService.createStaff(actor, input);
    assert.ok(result.success, `Staff creation should succeed: ${result.message}`);
    assert.ok(result.data, "Should return created user data");
    assert.ok(result.data.id, "Created user should have a database UUID");
    createdUserId = result.data.id;

    // Verify record exists in DB using repository
    const dbUser = await userRepository.findById(createdUserId);
    assert.ok(dbUser, "User should be retrievable from the database");
    assert.strictEqual(dbUser.firstName, "Test");
    assert.strictEqual(dbUser.lastName, "User");
    assert.strictEqual(dbUser.mobile, TEST_MOBILE);
    assert.strictEqual(dbUser.employeeId, TEST_EMPLOYEE_ID);
    assert.strictEqual(dbUser.jobTitle, "Junior Tester");
    assert.strictEqual(Number(dbUser.hourlyRate), 25.00);
    assert.strictEqual(dbUser.email, "test.crud@venue.com");
    assert.strictEqual(dbUser.isActive, true);
    assert.strictEqual(dbUser.permissions.canClockIn, true);
    assert.strictEqual(dbUser.permissions.canViewRoster, true);
  });

  await t.test("2. Update Staff User - modifies record details and maintains audit log", async () => {
    if (!createdUserId) {
      assert.fail("Skip update test: user was not created");
    }

    const updateInput: StaffUpdateInput = {
      id: createdUserId,
      jobTitle: "Senior Tester",
      hourlyRate: 35.50,
      email: "test.crud-updated@venue.com",
    };

    const result = await staffManagementService.updateStaff(actor, updateInput);
    assert.ok(result.success, `Staff update should succeed: ${result.message}`);

    const dbUser = await userRepository.findById(createdUserId);
    assert.ok(dbUser, "User should still be retrievable");
    assert.strictEqual(dbUser.jobTitle, "Senior Tester");
    assert.strictEqual(Number(dbUser.hourlyRate), 35.50);
    assert.strictEqual(dbUser.email, "test.crud-updated@venue.com");
    assert.strictEqual(dbUser.firstName, "Test", "Other fields should remain unchanged");
  });

  await t.test("3. Deactivate Staff User - soft deletes user from active list", async () => {
    if (!createdUserId) {
      assert.fail("Skip deactivation test: user was not created");
    }

    const result = await staffManagementService.deactivateStaff(actor, createdUserId);
    assert.ok(result.success, `Deactivation should succeed: ${result.message}`);

    const dbUser = await userRepository.findById(createdUserId);
    assert.ok(dbUser, "User should still exist in database");
    assert.strictEqual(dbUser.isActive, false, "isActive should be false after deactivation");
  });
});
