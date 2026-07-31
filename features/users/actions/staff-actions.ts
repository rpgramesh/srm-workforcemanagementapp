"use server";

import { z } from "zod";
import { staffManagementService } from "@/features/users/services/staff-management-service";
import type { StaffServiceOperationResult } from "@/features/users/services/staff-management-service";
import { getCurrentActor } from "@/lib/server-session";
import type { StaffListFilters, User, StaffCreateInput, StaffUpdateInput } from "@/types/user";
import type { FilterPreset } from "@/types/preset";
import { normalizeAustralianMobile } from "@/features/auth/services/au-mobile";
import type { AppRole } from "@/types/app";

const AppRoleSchema = z.enum(["super_admin", "restaurant_admin", "manager", "supervisor", "employee"]) satisfies z.ZodSchema<AppRole>;

const StaffSortKeySchema = z.enum([
  "name", "role", "department", "employment_date", "employee_id", "is_active",
]);

const StaffCreateSchema = z.object({
  firstName: z.string().trim().min(2, "First name must be at least 2 characters").max(64),
  lastName: z.string().trim().min(2, "Last name must be at least 2 characters").max(64),
  mobile: z.string().trim().refine((v) => !!normalizeAustralianMobile(v), "Enter a valid Australian mobile number"),
  role: AppRoleSchema,
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
  employeeId: z.union([z.string().trim().max(32), z.null()]).optional(),
  jobTitle: z.union([z.string().trim().max(128), z.null()]).optional(),
  hourlyRate: z.union([z.number().min(0).max(9999), z.null()]).optional(),
  avatarUrl: z.union([z.string().trim().max(512).url(), z.null()]).optional(),
  color: z.union([z.string().trim().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/, "Must be a hex color like #10B981"), z.null()]).optional(),
  departmentId: z.union([z.string().uuid(), z.null()]).optional(),
  email: z.union([z.string().trim().email("Enter a valid email"), z.null()]).optional(),
  employmentDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]).optional(),
  address: z.union([z.string().trim().max(512), z.null()]).optional(),
  emergencyContactName: z.union([z.string().trim().max(128), z.null()]).optional(),
  emergencyContactPhone: z.union([z.string().trim().max(32), z.null()]).optional(),
  notes: z.union([z.string().trim().max(4000), z.null()]).optional(),
  permissions: z.record(z.string(), z.boolean()).optional(),
  isActive: z.boolean().optional(),
});

const StaffUpdateSchema = StaffCreateSchema.partial().extend({
  id: z.string().uuid("Staff id is required"),
  pin: z.union([z.string().regex(/^\d{4}$/, "PIN must be 4 digits"), z.null()]).optional(),
  mobile: z.union([z.string().refine((v) => !!normalizeAustralianMobile(v), "Enter a valid Australian mobile number"), z.null()]).optional(),
});

const StaffFiltersSchema = z.object({
  search: z.string().max(120).optional(),
  departmentId: z.union([z.string().uuid(), z.null()]).optional(),
  role: z.union([AppRoleSchema, z.null()]).optional(),
  status: z.enum(["active", "inactive", "all"]).optional(),
  employeeId: z.union([z.string().max(64), z.null()]).optional(),
  sortBy: StaffSortKeySchema.optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});

function toZodIssues(issues: Record<string, string[]> | undefined): z.ZodIssue[] {
  if (!issues) return [];
  return Object.entries(issues).flatMap(([path, messages]) =>
    messages.map((m) => ({
      code: z.ZodIssueCode.custom,
      path: [path],
      message: m,
    })),
  );
}

export async function createStaff(
  raw: unknown,
): Promise<StaffServiceOperationResult<User> & { zodErrors?: z.ZodIssue[] }> {
  const actor = await getCurrentActor();
  const parsed = StaffCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields", zodErrors: parsed.error.issues };
  }
  const r = await staffManagementService.createStaff(
    { userId: actor?.userId ?? null, role: actor?.role ?? null },
    parsed.data as StaffCreateInput,
  );
  if (!r.success && r.issues) {
    return { ...r, zodErrors: toZodIssues(r.issues) };
  }
  return r;
}

export async function updateStaff(
  raw: unknown,
): Promise<StaffServiceOperationResult<User> & { zodErrors?: z.ZodIssue[] }> {
  const actor = await getCurrentActor();
  const parsed = StaffUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields", zodErrors: parsed.error.issues };
  }
  const r = await staffManagementService.updateStaff(
    { userId: actor?.userId ?? null, role: actor?.role ?? null },
    parsed.data as StaffUpdateInput,
  );
  if (!r.success && r.issues) {
    return { ...r, zodErrors: toZodIssues(r.issues) };
  }
  return r;
}

export async function deactivateStaff(staffId: string): Promise<StaffServiceOperationResult<void>> {
  const actor = await getCurrentActor();
  return staffManagementService.deactivateStaff(
    { userId: actor?.userId ?? null, role: actor?.role ?? null },
    staffId,
  );
}

export async function listStaff(
  raw: unknown = {},
): Promise<{ rows: User[]; total: number; error?: string }> {
  const actor = await getCurrentActor();
  const parsed = StaffFiltersSchema.safeParse(raw);
  const filters: StaffListFilters = parsed.success ? (parsed.data as StaffListFilters) : {};
  const r = await staffManagementService.listStaff(
    { userId: actor?.userId ?? null, role: actor?.role ?? null },
    filters,
  );
  return { rows: r.rows, total: r.total };
}

export async function getStaffForEdit(staffId: string): Promise<User | null> {
  const actor = await getCurrentActor();
  return staffManagementService.getStaff(
    { userId: actor?.userId ?? null, role: actor?.role ?? null },
    staffId,
  );
}

export async function listFilterPresets(module: string): Promise<FilterPreset[]> {
  const actor = await getCurrentActor();
  return staffManagementService.listPresets({ userId: actor?.userId ?? null }, module);
}

export async function saveFilterPreset(
  module: string,
  name: string,
  filters: unknown,
  isDefault: boolean = false,
): Promise<StaffServiceOperationResult<string>> {
  const actor = await getCurrentActor();
  const parsed = StaffFiltersSchema.safeParse(filters);
  const safeFilters: StaffListFilters = parsed.success ? (parsed.data as StaffListFilters) : {};
  return staffManagementService.savePreset(
    { userId: actor?.userId ?? null },
    module,
    name,
    safeFilters,
    isDefault,
  );
}

export async function deleteFilterPreset(
  module: string,
  presetId: string,
): Promise<StaffServiceOperationResult<void>> {
  const actor = await getCurrentActor();
  return staffManagementService.deletePreset(
    { userId: actor?.userId ?? null },
    module,
    presetId,
  );
}
