"use server";

import { sb } from "@/features/data/supabase-utils";

export interface DepartmentRow {
  id: string;
  name: string;
  short_label: string;
  color: string | null;
}

interface ActiveStaffMinimalRow {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  department_id: string | null;
}

export async function listDepartments(): Promise<DepartmentRow[]> {
  const { data, error } = await sb()
    .from("departments")
    .select("id, name, short_label, color")
    .order("name", { ascending: true });
  if (error) return [];
  return (data ?? []) as DepartmentRow[];
}

export async function listActiveStaffMinimal(): Promise<Array<{ id: string; firstName: string; lastName: string; role: string; departmentId: string | null }>> {
  const { data, error } = await sb()
    .from("users")
    .select("id, first_name, last_name, role, department_id")
    .eq("is_active", true)
    .order("first_name", { ascending: true });
  if (error) return [];
  return ((data ?? []) as ActiveStaffMinimalRow[]).map((r) => ({
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    role: r.role,
    departmentId: r.department_id ?? null,
  }));
}
