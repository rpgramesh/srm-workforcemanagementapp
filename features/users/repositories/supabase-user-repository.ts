/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  User,
  UserPagination,
  StaffCreateInput,
  StaffUpdateInput,
  StaffListFilters,
  StaffPermissions,
} from "@/types/user";
import { UserRepository } from "@/features/users/repositories/user-repository";
import { normalizeSupabaseError } from "@/features/data/supabase-utils";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { AppRole } from "@/types/app";

interface SupabaseUserRow {
  id: string;
  first_name: string;
  last_name: string;
  mobile: string;
  email: string | null;
  role: AppRole;
  employee_id: string | null;
  job_title: string | null;
  hourly_rate: string | number | null;
  avatar_url: string | null;
  color: string | null;
  department_id: string | null;
  employment_date: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  permissions: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function parsePermissions(raw: any): StaffPermissions {
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as StaffPermissions;
  return {};
}

function mapRow(row: SupabaseUserRow): User {
  const hourlyRate =
    row.hourly_rate == null
      ? null
      : typeof row.hourly_rate === "number"
        ? row.hourly_rate
        : Number.parseFloat(String(row.hourly_rate));

  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: [row.first_name, row.last_name].filter(Boolean).join(" ").trim(),
    mobile: row.mobile,
    email: row.email ?? null,
    role: row.role,
    employeeId: row.employee_id,
    jobTitle: row.job_title,
    hourlyRate: Number.isFinite(hourlyRate) ? (hourlyRate as number) : null,
    avatarUrl: row.avatar_url,
    color: row.color,
    departmentId: row.department_id ?? null,
    employmentDate: row.employment_date ? new Date(`${row.employment_date}T00:00:00Z`) : null,
    address: row.address ?? null,
    emergencyContactName: row.emergency_contact_name ?? null,
    emergencyContactPhone: row.emergency_contact_phone ?? null,
    notes: row.notes ?? null,
    permissions: parsePermissions(row.permissions),
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function applyPaginationFilters(query: any, params?: UserPagination) {
  let q = query;
  if (params?.roles && params.roles.length > 0) {
    q = q.in("role", params.roles);
  }
  if (params?.onlyActive) {
    q = q.eq("is_active", true);
  }
  return q;
}

function applyStaffFilters(query: any, params?: StaffListFilters) {
  let q = query;
  const p = params ?? {};

  if (p.departmentId) {
    q = q.eq("department_id", p.departmentId);
  }
  if (p.role) {
    q = q.eq("role", p.role);
  }
  if (p.status === "active") {
    q = q.eq("is_active", true);
  } else if (p.status === "inactive") {
    q = q.eq("is_active", false);
  }
  if (p.employeeId) {
    q = q.ilike("employee_id", `%${p.employeeId}%`);
  }
  if (p.search && p.search.trim().length > 0) {
    const term = p.search.trim();
    q = q.or(
      [
        `first_name.ilike.%${term}%`,
        `last_name.ilike.%${term}%`,
        `mobile.ilike.%${term}%`,
        `email.ilike.%${term}%`,
        `job_title.ilike.%${term}%`,
      ].join(","),
    );
  }

  const dir = p.sortDir === "desc" ? false : true;
  switch (p.sortBy) {
    case "role":
      q = q.order("role", { ascending: dir }).order("last_name", { ascending: true }).order("first_name", { ascending: true });
      break;
    case "department":
      q = q.order("department_id", { ascending: dir, nullsFirst: false }).order("last_name", { ascending: true }).order("first_name", { ascending: true });
      break;
    case "employment_date":
      q = q.order("employment_date", { ascending: dir, nullsFirst: false }).order("last_name", { ascending: true }).order("first_name", { ascending: true });
      break;
    case "employee_id":
      q = q.order("employee_id", { ascending: dir, nullsFirst: false }).order("last_name", { ascending: true }).order("first_name", { ascending: true });
      break;
    case "is_active":
      q = q.order("is_active", { ascending: dir }).order("last_name", { ascending: true }).order("first_name", { ascending: true });
      break;
    case "name":
    default:
      q = q.order("last_name", { ascending: dir }).order("first_name", { ascending: dir });
  }

  return q;
}

export class SupabaseUserRepository implements UserRepository {
  private readonly client = createSupabaseServerClient();

  async findById(id: string): Promise<User | null> {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(id)) return null;
    const { data, error } = await this.client
      .from("users")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw normalizeSupabaseError(error);
    return data ? mapRow(data as SupabaseUserRow) : null;
  }

  async findByMobile(mobile: string): Promise<User | null> {
    const { data, error } = await this.client
      .from("users")
      .select("*")
      .eq("mobile", mobile)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw normalizeSupabaseError(error);
    return data ? mapRow(data as SupabaseUserRow) : null;
  }

  async findByEmployeeId(employeeId: string): Promise<User | null> {
    const { data, error } = await this.client
      .from("users")
      .select("*")
      .eq("employee_id", employeeId)
      .maybeSingle();

    if (error) throw normalizeSupabaseError(error);
    return data ? mapRow(data as SupabaseUserRow) : null;
  }

  async list(params?: UserPagination): Promise<User[]> {
    let query = this.client.from("users").select("*");
    query = applyPaginationFilters(query, params);

    if (typeof params?.limit === "number") query = query.limit(params.limit);
    if (typeof params?.offset === "number") {
      query = query.range(params.offset, params.offset + (params.limit ?? 50) - 1);
    }

    query = query
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

    const { data, error } = await query;
    if (error) throw normalizeSupabaseError(error);
    return (data as SupabaseUserRow[]).map(mapRow);
  }

  async count(params?: Omit<UserPagination, "limit" | "offset">): Promise<number> {
    const q = this.client
      .from("users")
      .select("*", { count: "exact", head: true });
    const withFilters = applyPaginationFilters(q, params);
    const { count, error } = await withFilters;
    if (error) throw normalizeSupabaseError(error);
    return Number(count ?? 0);
  }

  async filter(params?: StaffListFilters): Promise<User[]> {
    let query = this.client.from("users").select("*");
    query = applyStaffFilters(query, params);
    if (typeof params?.limit === "number") query = query.limit(params.limit);
    if (typeof params?.offset === "number") {
      query = query.range(params.offset, params.offset + (params.limit ?? 50) - 1);
    }
    const { data, error } = await query;
    if (error) throw normalizeSupabaseError(error);
    return (data as SupabaseUserRow[]).map(mapRow);
  }

  async filterCount(params?: Omit<StaffListFilters, "limit" | "offset">): Promise<number> {
    const q = this.client.from("users").select("*", { count: "exact", head: true });
    const withFilters = applyStaffFilters(q, params);
    const { count, error } = await withFilters;
    if (error) throw normalizeSupabaseError(error);
    return Number(count ?? 0);
  }

  async create(input: StaffCreateInput): Promise<User> {
    const { data: newId, error: rpcError } = await this.client.rpc("create_staff_user", {
      p_first_name: input.firstName,
      p_last_name: input.lastName,
      p_mobile: input.mobile,
      p_role: input.role,
      p_pin: input.pin,
      p_employee_id: input.employeeId ?? null,
      p_job_title: input.jobTitle ?? null,
      p_hourly_rate: input.hourlyRate ?? null,
      p_avatar_url: input.avatarUrl ?? null,
      p_color: input.color ?? null,
      p_department_id: input.departmentId ?? null,
      p_email: input.email ?? null,
      p_employment_date: input.employmentDate ?? null,
      p_address: input.address ?? null,
      p_emergency_contact_name: input.emergencyContactName ?? null,
      p_emergency_contact_phone: input.emergencyContactPhone ?? null,
      p_notes: input.notes ?? null,
      p_permissions: (input.permissions ?? {}) as any,
      p_is_active: input.isActive ?? true,
    });

    if (rpcError) throw new Error(rpcError.message ?? String(rpcError));
    if (!newId) throw new Error("create_staff_user returned no id");

    const created = await this.findById(newId as string);
    if (!created) throw new Error("User created but could not be loaded");
    return created;
  }

  async update(input: StaffUpdateInput): Promise<User> {
    const { error: rpcError } = await this.client.rpc("update_staff_user", {
      p_user_id: input.id,
      p_first_name: input.firstName ?? null,
      p_last_name: input.lastName ?? null,
      p_mobile: input.mobile ?? null,
      p_role: input.role ?? null,
      p_pin: input.pin ?? null,
      p_employee_id: input.employeeId ?? null,
      p_job_title: input.jobTitle ?? null,
      p_hourly_rate: input.hourlyRate ?? null,
      p_avatar_url: input.avatarUrl ?? null,
      p_color: input.color ?? null,
      p_department_id: input.departmentId ?? null,
      p_email: input.email ?? null,
      p_employment_date: input.employmentDate ?? null,
      p_address: input.address ?? null,
      p_emergency_contact_name: input.emergencyContactName ?? null,
      p_emergency_contact_phone: input.emergencyContactPhone ?? null,
      p_notes: input.notes ?? null,
      p_permissions: typeof input.permissions === "undefined" ? null : (input.permissions as any),
      p_is_active: typeof input.isActive === "undefined" ? null : input.isActive,
    });

    if (rpcError) throw new Error(rpcError.message ?? String(rpcError));
    const updated = await this.findById(input.id);
    if (!updated) throw new Error("User updated but could not be loaded");
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await this.client.rpc("soft_delete_staff_user", {
      p_user_id: id,
    });
    if (error) throw new Error(error.message ?? String(error));
  }

  async verifyByMobileAndPin(mobile: string, pin: string): Promise<User | null> {
    const { data, error } = await this.client.rpc("verify_user_pin", {
      user_mobile: mobile,
      pin_input: pin,
    });

    if (error) throw normalizeSupabaseError(error);
    const row = Array.isArray(data) ? data[0] : null;
    if (!row?.matched || !row?.user_id) return null;

    return this.findById(row.user_id as string);
  }

  async verifyByClockInPin(pin: string): Promise<User | null> {
    const { data, error } = await this.client.rpc("verify_clock_in_pin", {
      pin_input: pin,
    });

    if (error) throw normalizeSupabaseError(error);
    const row = Array.isArray(data) ? data[0] : null;
    if (!row?.matched || !row?.user_id) return null;

    return this.findById(row.user_id as string);
  }
}

export const userRepository: UserRepository = new SupabaseUserRepository();
