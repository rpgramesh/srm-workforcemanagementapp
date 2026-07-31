import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { test, after, before } from "node:test";
import assert from "node:assert";
import { Client } from "pg";
import type { StaffListFilters } from "@/types/user";

const ACTOR = { userId: "env-super-admin", role: "super_admin" as const };
const PRESET_NAME = "Integration Test Preset";

test("Staff Filtering and Presets Integration Test", async (t) => {
  // Dynamically import to ensure env variables are set
  const { staffManagementService } = await import("@/features/users/services/staff-management-service");
  const { userRepository } = await import("@/features/users/repositories/supabase-user-repository");

  const cleanupPresets = async () => {
    const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await pgClient.connect();
      await pgClient.query("DELETE FROM public.filter_presets WHERE name = $1", [PRESET_NAME]);
    } catch (err) {
      console.error("Cleanup presets failed:", err);
    } finally {
      await pgClient.end().catch(() => {});
    }
  };

  before(async () => {
    await cleanupPresets();
  });

  after(async () => {
    await cleanupPresets();
  });

  await t.test("1. Filter by search term - retrieves matching staff members", async () => {
    const filters: StaffListFilters = { search: "Anmol", status: "active" };
    const { rows, total } = await staffManagementService.listStaff(ACTOR, filters);

    assert.ok(total >= 1, "Should find at least 1 record for search term 'Anmol'");
    const user = rows.find((r) => r.firstName === "Anmol");
    assert.ok(user, "User Anmol should be in the filtered rows");
    assert.strictEqual(user.employeeId, "EMP-1004");
  });

  await t.test("2. Filter by role - retrieves only staff with specified role", async () => {
    const filters: StaffListFilters = { role: "manager", status: "active" };
    const { rows, total } = await staffManagementService.listStaff(ACTOR, filters);

    assert.ok(total >= 1, "Should find at least 1 manager");
    for (const r of rows) {
      assert.strictEqual(r.role, "manager", "Each returned record must be a manager");
    }
  });

  await t.test("3. Sorting - returns records in sorted order by name", async () => {
    const filtersAsc: StaffListFilters = { sortBy: "name", sortDir: "asc", status: "active" };
    const { rows: rowsAsc } = await staffManagementService.listStaff(ACTOR, filtersAsc);

    const filtersDesc: StaffListFilters = { sortBy: "name", sortDir: "desc", status: "active" };
    const { rows: rowsDesc } = await staffManagementService.listStaff(ACTOR, filtersDesc);

    if (rowsAsc.length >= 2) {
      const firstAsc = rowsAsc[0]!.lastName || rowsAsc[0]!.firstName;
      const lastAsc = rowsAsc[rowsAsc.length - 1]!.lastName || rowsAsc[rowsAsc.length - 1]!.firstName;
      const firstDesc = rowsDesc[0]!.lastName || rowsDesc[0]!.firstName;

      assert.strictEqual(firstAsc, rowsDesc[rowsDesc.length - 1]!.lastName || rowsDesc[rowsDesc.length - 1]!.firstName);
      assert.strictEqual(lastAsc, firstDesc);
    }
  });

  await t.test("4. Pagination - respects limit and offset constraints", async () => {
    const filtersAll: StaffListFilters = { status: "active", sortBy: "name", sortDir: "asc" };
    const { rows: allRows } = await staffManagementService.listStaff(ACTOR, filtersAll);

    if (allRows.length >= 3) {
      const filtersPage: StaffListFilters = { status: "active", sortBy: "name", sortDir: "asc", limit: 2, offset: 1 };
      const { rows: pageRows } = await staffManagementService.listStaff(ACTOR, filtersPage);

      assert.strictEqual(pageRows.length, 2, "Should return exactly 2 items for limit=2");
      assert.strictEqual(pageRows[0]!.id, allRows[1]!.id, "First item of page 2 should match second item of all list");
      assert.strictEqual(pageRows[1]!.id, allRows[2]!.id, "Second item of page 2 should match third item of all list");
    }
  });

  await t.test("5. Filter Presets - can save, list, and delete presets", async () => {
    const targetFilters: StaffListFilters = { role: "employee", status: "active", sortBy: "name" };

    // Save Preset
    const saveResult = await staffManagementService.savePreset(ACTOR, "staff", PRESET_NAME, targetFilters, false);
    assert.ok(saveResult.success, `Saving preset should succeed: ${saveResult.message}`);
    assert.ok(saveResult.data, "Should return the saved preset UUID string");
    const presetId = saveResult.data;

    // List Presets
    const presets = await staffManagementService.listPresets(ACTOR, "staff");
    const testPreset = presets.find((p) => p.id === presetId);
    assert.ok(testPreset, "Preset should be found in listed presets");
    assert.strictEqual(testPreset.name, PRESET_NAME);
    assert.strictEqual((testPreset.filters as StaffListFilters).role, "employee");

    // Delete Preset
    const deleteResult = await staffManagementService.deletePreset(ACTOR, "staff", presetId);
    assert.ok(deleteResult.success, `Deleting preset should succeed: ${deleteResult.message}`);

    // Verify deletion
    const postPresets = await staffManagementService.listPresets(ACTOR, "staff");
    assert.ok(!postPresets.some((p) => p.id === presetId), "Deleted preset should no longer be listed");
  });
});
