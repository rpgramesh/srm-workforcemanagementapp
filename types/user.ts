import type { AppRole } from "./app";

export type StaffSortKey =
  | "name"
  | "role"
  | "department"
  | "employment_date"
  | "employee_id"
  | "is_active";

export interface StaffPermissions {
  canClockIn?: boolean;
  canViewRoster?: boolean;
  canSwapShifts?: boolean;
  canManageStaff?: boolean;
  canManageRoster?: boolean;
  canManagePayroll?: boolean;
  canSendMessages?: boolean;
  canViewReports?: boolean;
  canAccessAdminDashboard?: boolean;
  [key: string]: boolean | undefined;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  mobile: string;
  email: string | null;
  role: AppRole;
  employeeId: string | null;
  jobTitle: string | null;
  hourlyRate: number | null;
  avatarUrl: string | null;
  color: string | null;
  departmentId: string | null;
  employmentDate: Date | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  notes: string | null;
  permissions: StaffPermissions;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StaffListFilters {
  search?: string;
  departmentId?: string | null;
  role?: AppRole | null;
  status?: "active" | "inactive" | "all";
  employeeId?: string | null;
  sortBy?: StaffSortKey;
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface StaffCreateInput {
  firstName: string;
  lastName: string;
  mobile: string;
  role: AppRole;
  pin: string;
  employeeId?: string | null;
  jobTitle?: string | null;
  hourlyRate?: number | null;
  avatarUrl?: string | null;
  color?: string | null;
  departmentId?: string | null;
  email?: string | null;
  employmentDate?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  notes?: string | null;
  permissions?: StaffPermissions;
  isActive?: boolean;
}

export interface StaffUpdateInput extends Partial<Omit<StaffCreateInput, "pin" | "mobile">> {
  id: string;
  pin?: string | null;
  mobile?: string | null;
}

export interface VerifiedUser {
  user: User;
  source: "env_admin" | "env_user" | "supabase";
}

export interface UserPagination {
  limit?: number;
  offset?: number;
  roles?: AppRole[];
  onlyActive?: boolean;
}

export const ADMIN_DASHBOARD_ROLES: AppRole[] = [
  "super_admin",
  "restaurant_admin",
  "manager",
];

export const STAFF_MANAGER_ROLES: AppRole[] = [
  "super_admin",
  "restaurant_admin",
  "manager",
];

export function canAccessAdminDashboard(role: AppRole): boolean {
  return ADMIN_DASHBOARD_ROLES.includes(role);
}

export function canManageStaff(role: AppRole): boolean {
  return STAFF_MANAGER_ROLES.includes(role);
}

export const PIN_FORMAT = /^\d{4}$/;
