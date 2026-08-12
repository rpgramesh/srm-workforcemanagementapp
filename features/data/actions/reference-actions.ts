"use server";

import { sb } from "@/features/data/supabase-utils";

export interface DepartmentRow {
  id: string;
  name: string;
  short_label: string;
  color: string | null;
}

const DEFAULT_DEPARTMENTS: DepartmentRow[] = [
  { id: "dept-foh", name: "Front of House", short_label: "FRONT", color: "#10B981" },
  { id: "dept-kit", name: "Kitchen",       short_label: "KITCHEN", color: "#0EA5E9" },
  { id: "dept-bar", name: "Bar",           short_label: "BAR", color: "#F59E0B" },
  { id: "dept-mgt", name: "Management",    short_label: "MGMT", color: "#F43F5E" },
];

function accentToHex(accentClass: string | null): string | null {
  if (!accentClass) return null;
  if (accentClass.includes("emerald")) return "#10B981";
  if (accentClass.includes("sky") || accentClass.includes("blue")) return "#0EA5E9";
  if (accentClass.includes("amber") || accentClass.includes("yellow")) return "#F59E0B";
  if (accentClass.includes("rose") || accentClass.includes("red") || accentClass.includes("pink")) return "#F43F5E";
  if (accentClass.includes("violet") || accentClass.includes("purple")) return "#8B5CF6";
  if (accentClass.includes("teal") || accentClass.includes("cyan")) return "#14B8A6";
  return null;
}

interface DepartmentDBRow {
  id: string;
  name: string;
  short_label: string;
  color: string | null;
  accent_class?: string | null;
}

export async function listDepartments(): Promise<DepartmentRow[]> {
  try {
    const { data, error } = await sb()
      .from("departments")
      .select("id, name, short_label, accent_class")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });
    if (error) {
      console.warn("[reference-actions] listDepartments DB error", error.message);
      return DEFAULT_DEPARTMENTS;
    }
    if (!data || data.length === 0) return DEFAULT_DEPARTMENTS;
    return (data as DepartmentDBRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      short_label: r.short_label,
      color: r.color ?? accentToHex(r.accent_class ?? null),
    }));
  } catch (e: unknown) {
    console.warn("[reference-actions] listDepartments fallback", e instanceof Error ? e.message : String(e));
    return DEFAULT_DEPARTMENTS;
  }
}

interface ActiveStaffMinimalRow {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  department_id: string | null;
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
