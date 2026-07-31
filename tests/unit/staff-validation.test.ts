import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { test } from "node:test";
import assert from "node:assert";
import type { StaffCreateInput } from "@/types/user";

test("Staff Management Service — validateCreate", async (t) => {
  const { StaffManagementService } = await import("@/features/users/services/staff-management-service");

  await t.test("should pass validation with valid inputs", () => {
    const input: StaffCreateInput = {
      firstName: "James",
      lastName: "Smith",
      mobile: "0412345678",
      role: "employee",
      pin: "9831",
      email: "james.smith@example.com",
      hourlyRate: 28.50,
      employmentDate: "2026-01-01",
    };

    const issues = StaffManagementService.validateCreate(input);
    assert.deepStrictEqual(Object.keys(issues).length, 0, "Should have no validation issues");
  });

  await t.test("should reject missing or empty names", () => {
    const input: StaffCreateInput = {
      firstName: "",
      lastName: "   ",
      mobile: "0412345678",
      role: "employee",
      pin: "9831",
    };

    const issues = StaffManagementService.validateCreate(input);
    assert.ok(issues.firstName, "Should report firstName error");
    assert.ok(issues.lastName, "Should report lastName error");
  });

  await t.test("should reject names that are too short", () => {
    const input: StaffCreateInput = {
      firstName: "A",
      lastName: "B",
      mobile: "0412345678",
      role: "employee",
      pin: "9831",
    };

    const issues = StaffManagementService.validateCreate(input);
    assert.ok(issues.firstName, "Should report firstName error");
    assert.ok(issues.lastName, "Should report lastName error");
  });

  await t.test("should reject invalid Australian mobile numbers", () => {
    const invalidNumbers = [
      "123456",
      "0512345678", // not starting with 04
      "+61312345678", // not mobile
      "abc",
    ];

    for (const mobile of invalidNumbers) {
      const input: StaffCreateInput = {
        firstName: "James",
        lastName: "Smith",
        mobile,
        role: "employee",
        pin: "9831",
      };
      const issues = StaffManagementService.validateCreate(input);
      assert.ok(issues.mobile, `Should reject invalid mobile: ${mobile}`);
    }
  });

  await t.test("should reject invalid PIN formats and simple PINs", () => {
    const badPins = [
      "123", // too short
      "12345", // too long
      "abcd", // non-digits
      "1111", // identical digits
      "8888", // identical digits
      "1234", // sequential forward
      "4321", // sequential backward
      "5678", // sequential forward
      "3210", // sequential backward
    ];

    for (const pin of badPins) {
      const input: StaffCreateInput = {
        firstName: "James",
        lastName: "Smith",
        mobile: "0412345678",
        role: "employee",
        pin,
      };
      const issues = StaffManagementService.validateCreate(input);
      assert.ok(issues.pin, `Should reject pin: ${pin}`);
    }
  });

  await t.test("should reject invalid email formats", () => {
    const badEmails = [
      "plainaddress",
      "#@%^%#$@#$@#.com",
      "@example.com",
      "Joe Smith <email@example.com>",
      "email.example.com",
      "email@example@example.com",
    ];

    for (const email of badEmails) {
      const input: StaffCreateInput = {
        firstName: "James",
        lastName: "Smith",
        mobile: "0412345678",
        role: "employee",
        pin: "9831",
        email,
      };
      const issues = StaffManagementService.validateCreate(input);
      assert.ok(issues.email, `Should reject email: ${email}`);
    }
  });

  await t.test("should reject negative hourly rates", () => {
    const input: StaffCreateInput = {
      firstName: "James",
      lastName: "Smith",
      mobile: "0412345678",
      role: "employee",
      pin: "9831",
      hourlyRate: -5,
    };
    const issues = StaffManagementService.validateCreate(input);
    assert.ok(issues.hourlyRate, "Should reject negative hourly rate");
  });

  await t.test("should reject future employment dates", () => {
    const nextYear = new Date().getFullYear() + 1;
    const input: StaffCreateInput = {
      firstName: "James",
      lastName: "Smith",
      mobile: "0412345678",
      role: "employee",
      pin: "9831",
      employmentDate: `${nextYear}-01-01`,
    };
    const issues = StaffManagementService.validateCreate(input);
    assert.ok(issues.employmentDate, "Should reject future employment date");
  });
});
