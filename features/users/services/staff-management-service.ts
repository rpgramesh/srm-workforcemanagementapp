import { normalizeAustralianMobile } from "@/features/auth/services/au-mobile";
import { userRepository } from "@/features/users/repositories/supabase-user-repository";
import type { UserRepository } from "@/features/users/repositories/user-repository";
import type { AppRole } from "@/types/app";
import type {
  StaffCreateInput,
  StaffListFilters,
  StaffUpdateInput,
  StaffPermissions,
} from "@/types/user";
import {
  canManageStaff as canManageStaffGuard,
  STAFF_MANAGER_ROLES,
  PIN_FORMAT,
} from "@/types/user";
import type { User } from "@/types/user";
import { filterPresetRepository } from "@/features/presets/repositories/supabase-filter-preset-repository";
import type { FilterPresetRepository } from "@/types/preset";
import type { FilterPreset } from "@/types/preset";
import { auditLogService, type AuditLogServiceLike } from "@/features/audit/services/audit-log-service";

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const DEFAULT_PERMISSIONS_BY_ROLE: Record<AppRole, StaffPermissions> = {
  super_admin: {
    canClockIn: true, canViewRoster: true, canSwapShifts: true,
    canManageStaff: true, canManageRoster: true, canManagePayroll: true,
    canSendMessages: true, canViewReports: true, canAccessAdminDashboard: true,
  },
  restaurant_admin: {
    canClockIn: true, canViewRoster: true, canSwapShifts: true,
    canManageStaff: true, canManageRoster: true, canManagePayroll: true,
    canSendMessages: true, canViewReports: true, canAccessAdminDashboard: true,
  },
  manager: {
    canClockIn: true, canViewRoster: true, canSwapShifts: true,
    canManageStaff: true, canManageRoster: true, canManagePayroll: false,
    canSendMessages: true, canViewReports: true, canAccessAdminDashboard: true,
  },
  supervisor: {
    canClockIn: true, canViewRoster: true, canSwapShifts: true,
    canManageStaff: false, canManageRoster: false, canManagePayroll: false,
    canSendMessages: true, canViewReports: false, canAccessAdminDashboard: false,
  },
  employee: {
    canClockIn: true, canViewRoster: true, canSwapShifts: true,
    canManageStaff: false, canManageRoster: false, canManagePayroll: false,
    canSendMessages: true, canViewReports: false, canAccessAdminDashboard: false,
  },
};

export interface StaffServiceOperationResult<T> {
  success: boolean;
  message: string;
  description?: string;
  data?: T;
  issues?: Record<string, string[]>;
}

export class StaffManagementService {
  constructor(
    private readonly users: UserRepository = userRepository,
    private readonly presets: FilterPresetRepository = filterPresetRepository,
    private readonly audit: AuditLogServiceLike = auditLogService,
  ) {}

  static validateCreate(input: StaffCreateInput): Record<string, string[]> {
    const issues: Record<string, string[]> = {};
    const push = (k: string, m: string) => {
      issues[k] ??= [];
      issues[k]!.push(m);
    };

    if (!input.firstName?.trim()) push("firstName", "First name is required");
    else if (input.firstName.trim().length < 2) push("firstName", "First name must be at least 2 characters");

    if (!input.lastName?.trim()) push("lastName", "Last name is required");
    else if (input.lastName.trim().length < 2) push("lastName", "Last name must be at least 2 characters");

    const normalized = normalizeAustralianMobile(input.mobile);
    if (!normalized) push("mobile", "Enter a valid Australian mobile number (e.g. 04XX XXX XXX)");

    if (!input.role) push("role", "Role is required");
    if (typeof input.pin !== "string" || !PIN_FORMAT.test(input.pin)) {
      push("pin", "PIN must be exactly 4 digits");
    } else if (/^(\d)\1{3}$/.test(input.pin)) {
      push("pin", "PIN cannot be 4 identical digits");
    } else if (/0123|1234|2345|3456|4567|5678|6789|7654|6543|5432|4321|3210/.test(input.pin)) {
      push("pin", "PIN cannot be a sequential sequence");
    }

    if (typeof input.email === "string" && input.email.length > 0) {
      if (!EMAIL_REGEX.test(input.email.trim())) push("email", "Enter a valid email address");
    }

    if (typeof input.hourlyRate === "number") {
      if (!Number.isFinite(input.hourlyRate) || input.hourlyRate < 0) {
        push("hourlyRate", "Hourly rate must be a non-negative number");
      }
    }

    if (input.employmentDate && typeof input.employmentDate === "string") {
      const d = new Date(`${input.employmentDate}T00:00:00Z`);
      if (Number.isNaN(d.getTime())) push("employmentDate", "Enter a valid employment date");
      else if (d.getTime() > Date.now() + 86400000) push("employmentDate", "Employment date cannot be in the future");
    }

    return issues;
  }

  static mergePermissions(role: AppRole, override: StaffPermissions | undefined): StaffPermissions {
    const base = { ...(DEFAULT_PERMISSIONS_BY_ROLE[role] ?? {}) };
    if (!override) return base;
    return { ...base, ...override };
  }

  private async requireManager(actorRole: AppRole | null, capability: string): Promise<{ ok: boolean; message: string; description?: string }> {
    if (!actorRole) return { ok: false, message: "Not signed in", description: "You must be signed in to manage staff records." };
    if (!canManageStaffGuard(actorRole)) {
      return {
        ok: false,
        message: "Permission denied",
        description: `Your role (${actorRole}) is not authorised for ${capability}. Only ${STAFF_MANAGER_ROLES.join(", ")} can manage staff.`,
      };
    }
    return { ok: true, message: "ok" };
  }

  async createStaff(actor: { userId: string | null; role: AppRole | null }, input: StaffCreateInput): Promise<StaffServiceOperationResult<User>> {
    const authz = await this.requireManager(actor.role, "creating staff");
    if (!authz.ok) return { success: false, message: authz.message, description: authz.description };

    const issues = StaffManagementService.validateCreate(input);
    if (Object.keys(issues).length > 0) {
      return { success: false, message: "Please fix the highlighted fields", issues };
    }

    const normalizedMobile = normalizeAustralianMobile(input.mobile)!;
    const permissions = StaffManagementService.mergePermissions(input.role, input.permissions);

    try {
      const created = await this.users.create({
        ...input,
        mobile: normalizedMobile,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: input.email ? input.email.trim() : null,
        permissions,
      });
      await this.audit.append("staff_created", {
        actorUserId: actor.userId ?? null,
        targetUserId: created.id,
        departmentId: created.departmentId ?? null,
        details: {
          role: created.role,
          employeeId: created.employeeId,
          email: created.email,
          permissionKeys: Object.keys(permissions).filter((k) => permissions[k as keyof StaffPermissions]),
        },
      });
      return {
        success: true,
        message: `${created.fullName} added to staff`,
        description: created.employeeId ? `Employee ID ${created.employeeId} · Role ${created.role}` : `Role ${created.role}`,
        data: created,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create staff record";
      if (message.toLowerCase().includes("pin") && message.includes("already")) {
        return { success: false, message: "PIN already in use", description: "That 4-digit PIN is assigned to another staff member. Pick a different one.", issues: { pin: ["PIN already in use by another staff member"] } };
      }
      if (message.toLowerCase().includes("mobile") && message.includes("already")) {
        return { success: false, message: "Mobile number already in use", description: "An active staff member already has this mobile number.", issues: { mobile: ["Mobile number already in use"] } };
      }
      if (message.toLowerCase().includes("employee id")) {
        return { success: false, message: "Employee ID already in use", issues: { employeeId: ["Employee ID already assigned"] } };
      }
      return { success: false, message: "Could not save staff member", description: message };
    }
  }

  async updateStaff(actor: { userId: string | null; role: AppRole | null }, input: StaffUpdateInput): Promise<StaffServiceOperationResult<User>> {
    const authz = await this.requireManager(actor.role, "updating staff");
    if (!authz.ok) return { success: false, message: authz.message, description: authz.description };
    if (!input.id) return { success: false, message: "User ID is required" };

    const before = await this.users.findById(input.id);
    if (!before) return { success: false, message: "Staff member not found" };

    const issues: Record<string, string[]> = {};
    let normalizedMobile: string | undefined;
    if (typeof input.mobile === "string" && input.mobile.length > 0) {
      normalizedMobile = normalizeAustralianMobile(input.mobile) ?? undefined;
      if (!normalizedMobile) issues["mobile"] = ["Enter a valid Australian mobile number"];
    }
    if (typeof input.pin === "string" && input.pin.length > 0) {
      if (!PIN_FORMAT.test(input.pin)) issues["pin"] = ["PIN must be exactly 4 digits"];
      else if (/^(\d)\1{3}$/.test(input.pin)) issues["pin"] = ["PIN cannot be 4 identical digits"];
    }
    if (typeof input.email === "string" && input.email.length > 0) {
      if (!EMAIL_REGEX.test(input.email.trim())) issues["email"] = ["Enter a valid email address"];
    }
    if (Object.keys(issues).length > 0) {
      return { success: false, message: "Please fix the highlighted fields", issues };
    }

    const permissions = input.role
      ? StaffManagementService.mergePermissions(input.role, input.permissions)
      : input.permissions
        ? { ...before.permissions, ...input.permissions }
        : undefined;

    try {
      const updated = await this.users.update({
        ...input,
        mobile: normalizedMobile ?? null,
        email: typeof input.email === "string" ? (input.email.trim() || null) : undefined,
        permissions,
      });
      await this.audit.append("staff_updated", {
        actorUserId: actor.userId ?? null,
        targetUserId: updated.id,
        departmentId: updated.departmentId ?? null,
        details: this.buildDiff(before, updated),
      });
      return { success: true, message: `${updated.fullName} updated`, data: updated };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update staff";
      if (message.toLowerCase().includes("pin") && message.includes("already")) {
        return { success: false, message: "PIN already in use", issues: { pin: ["PIN already in use by another staff member"] } };
      }
      if (message.toLowerCase().includes("mobile") && message.includes("already")) {
        return { success: false, message: "Mobile number already in use", issues: { mobile: ["Mobile already assigned"] } };
      }
      if (message.toLowerCase().includes("employee id")) {
        return { success: false, message: "Employee ID already in use", issues: { employeeId: ["Employee ID already assigned"] } };
      }
      return { success: false, message: "Could not update staff member", description: message };
    }
  }

  async deactivateStaff(actor: { userId: string | null; role: AppRole | null }, staffId: string): Promise<StaffServiceOperationResult<void>> {
    const authz = await this.requireManager(actor.role, "deleting staff");
    if (!authz.ok) return { success: false, message: authz.message, description: authz.description };
    if (!staffId) return { success: false, message: "Staff ID is required" };
    const before = await this.users.findById(staffId);
    if (!before) return { success: false, message: "Staff member not found" };
    try {
      await this.users.softDelete(staffId);
      await this.audit.append("staff_deleted", {
        actorUserId: actor.userId ?? null,
        targetUserId: staffId,
        departmentId: before.departmentId ?? null,
        details: { previousRole: before.role, previousEmployeeId: before.employeeId, method: "soft_deactivate" },
      });
      return { success: true, message: `${before.fullName} removed from active staff` };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to deactivate staff";
      return { success: false, message: "Could not remove staff member", description: message };
    }
  }

  async listStaff(actor: { userId: string | null; role: AppRole | null }, filters?: StaffListFilters): Promise<{ rows: User[]; total: number }> {
    const authz = await this.requireManager(actor.role, "listing staff");
    if (!authz.ok) return { rows: [], total: 0 };
    const { limit, offset, ...restFilters } = filters ?? {};
    const [rows, total] = await Promise.all([
      this.users.filter(filters),
      this.users.filterCount(filters ? restFilters : undefined),
    ]);
    return { rows, total };
  }

  async getStaff(actor: { userId: string | null; role: AppRole | null }, staffId: string): Promise<User | null> {
    const authz = await this.requireManager(actor.role, "viewing staff details");
    if (!authz.ok) return null;
    return this.users.findById(staffId);
  }

  async listPresets(actor: { userId: string | null }, module: string): Promise<FilterPreset[]> {
    if (!actor.userId) return [];
    return this.presets.list(actor.userId, module);
  }

  async savePreset(
    actor: { userId: string | null },
    module: string,
    name: string,
    filters: StaffListFilters,
    isDefault: boolean = false,
  ): Promise<StaffServiceOperationResult<string>> {
    if (!actor.userId) return { success: false, message: "You must be signed in to save filter presets" };
    const clean = name.trim();
    if (clean.length < 2) return { success: false, message: "Preset name must be at least 2 characters" };
    if (clean.length > 40) return { success: false, message: "Preset name must be 40 characters or fewer" };
    try {
      const id = await this.presets.upsert(actor.userId, module, clean, filters, isDefault);
      await this.audit.append("filter_preset_saved", { actorUserId: actor.userId, details: { module, name: clean, isDefault } });
      return { success: true, message: `Preset "${clean}" saved`, data: id };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save preset";
      return { success: false, message: "Could not save preset", description: message };
    }
  }

  async deletePreset(actor: { userId: string | null }, module: string, presetId: string): Promise<StaffServiceOperationResult<void>> {
    if (!actor.userId) return { success: false, message: "You must be signed in to delete presets" };
    try {
      await this.presets.remove(actor.userId, module, presetId);
      await this.audit.append("filter_preset_deleted", { actorUserId: actor.userId, details: { module, presetId } });
      return { success: true, message: "Preset deleted" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete preset";
      return { success: false, message: "Could not delete preset", description: message };
    }
  }

  private buildDiff(before: User, after: User): Record<string, unknown> {
    const diff: Record<string, unknown> = {};
    const pairs: Array<[string, unknown, unknown]> = [
      ["role", before.role, after.role],
      ["firstName", before.firstName, after.firstName],
      ["lastName", before.lastName, after.lastName],
      ["mobile", before.mobile, after.mobile],
      ["email", before.email, after.email],
      ["employeeId", before.employeeId, after.employeeId],
      ["jobTitle", before.jobTitle, after.jobTitle],
      ["hourlyRate", before.hourlyRate, after.hourlyRate],
      ["departmentId", before.departmentId, after.departmentId],
      ["employmentDate", before.employmentDate?.toISOString().slice(0, 10), after.employmentDate?.toISOString().slice(0, 10)],
      ["isActive", before.isActive, after.isActive],
    ];
    for (const [k, a, b] of pairs) {
      if (JSON.stringify(a) !== JSON.stringify(b)) diff[k] = { before: a ?? null, after: b ?? null };
    }
    const permDiff: Record<string, { before: boolean; after: boolean }> = {};
    const allKeys = new Set<string>([...Object.keys(before.permissions), ...Object.keys(after.permissions)]);
    for (const k of allKeys) {
      const b = !!before.permissions[k as keyof StaffPermissions];
      const a = !!after.permissions[k as keyof StaffPermissions];
      if (b !== a) permDiff[k] = { before: b, after: a };
    }
    if (Object.keys(permDiff).length > 0) diff.permissions = permDiff;
    return diff;
  }
}

export const staffManagementService = new StaffManagementService();
