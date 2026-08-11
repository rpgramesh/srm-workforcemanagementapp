"use server";

import { z } from "zod";
import { listStaff } from "@/features/users/actions/staff-actions";
import { operationsRepository } from "@/features/data/repositories/operations-repository";
import type {
  AdvancedSearchFilters,
  SearchHit,
  SearchModuleId,
} from "@/types/platform";
import type { AppRole } from "@/types/app";
import type { Department, Shift } from "@/types/domain";
import type { User } from "@/types/user";

const AppRoleSchema = z.enum([
  "super_admin",
  "restaurant_admin",
  "manager",
  "supervisor",
  "employee",
]) satisfies z.ZodSchema<AppRole>;

const SearchModuleIdSchema = z.enum([
  "staff",
  "shifts",
  "messages",
  "audit_logs",
  "departments",
  "payroll",
  "roster",
]) satisfies z.ZodSchema<SearchModuleId>;

const AdvancedSearchFiltersSchema = z.object({
  query: z.string().max(200).optional(),
  modules: z.array(SearchModuleIdSchema).optional(),
  role: AppRoleSchema.optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  onlyActive: z.boolean().optional().nullable(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
}) satisfies z.ZodSchema<AdvancedSearchFilters>;

function normalizeStr(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().trim();
}

function fuzzyScore(haystack: string, needle: string): number {
  const h = normalizeStr(haystack);
  const n = normalizeStr(needle);
  if (!n) return 0;
  if (!h) return 0;
  if (h === n) return 100;
  if (h.startsWith(n)) return 80;
  if (h.includes(n)) return 60;
  const hWords = h.split(/[\s_-]+/).filter(Boolean);
  const nWords = n.split(/[\s_-]+/).filter(Boolean);
  let wordHits = 0;
  for (const nw of nWords) {
    if (hWords.some((hw) => hw.startsWith(nw) || hw.includes(nw))) {
      wordHits += 1;
    }
  }
  if (nWords.length > 0) {
    const ratio = wordHits / nWords.length;
    if (ratio >= 1) return 50;
    if (ratio >= 0.5) return 30;
  }
  let charScore = 0;
  let idx = 0;
  for (const ch of n) {
    const found = h.indexOf(ch, idx);
    if (found !== -1) {
      charScore += 1;
      idx = found + 1;
    }
  }
  return Math.round((charScore / n.length) * 15);
}

function bestScore(fields: Array<string | null | undefined>, needle: string): number {
  let best = 0;
  for (const f of fields) {
    const s = fuzzyScore(f ?? "", needle);
    if (s > best) best = s;
  }
  return best;
}

interface SearchFacets {
  modules: Array<{ id: SearchModuleId; label: string; count: number }>;
  roles: Array<{ id: AppRole; label: string; count: number }>;
  departments: Array<{ id: string; label: string; count: number }>;
}

const MODULE_LABELS: Record<SearchModuleId, string> = {
  staff: "Staff",
  shifts: "Shifts",
  messages: "Messages",
  audit_logs: "Audit Logs",
  departments: "Departments",
  payroll: "Payroll",
  roster: "Roster",
};

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  restaurant_admin: "Restaurant Admin",
  manager: "Manager",
  supervisor: "Supervisor",
  employee: "Employee",
};

function roleToLabel(role: AppRole): string {
  return ROLE_LABELS[role] ?? String(role).replace(/_/g, " ");
}

function userToHit(u: User): SearchHit {
  return {
    id: u.id,
    module: "staff",
    title: u.fullName,
    subtitle: [u.jobTitle, u.employeeId ? `ID: ${u.employeeId}` : null]
      .filter(Boolean)
      .join(" · ") || roleToLabel(u.role),
    href: `/admin/staff`,
    score: 0,
    meta: {
      role: u.role,
      departmentId: u.departmentId,
      isActive: u.isActive,
      email: u.email,
      mobile: u.mobile,
    },
  };
}

function shiftToHit(s: Shift): SearchHit {
  const date = s.shiftDate
    ? new Date(`${s.shiftDate}T00:00:00Z`).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
      })
    : "";
  const subtitle = [
    date,
    s.startTime ? `${s.startTime}–${s.endTime}` : null,
    s.userFullName ?? null,
    s.departmentName ?? null,
    s.stationLabel ?? null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    id: s.id,
    module: "shifts",
    title: `${s.userFullName ?? "Open Shift"}${s.stationLabel ? ` · ${s.stationLabel}` : ""}`,
    subtitle,
    href: `/admin/schedule`,
    score: 0,
    meta: {
      userId: s.userId,
      departmentId: s.departmentId,
      shiftDate: s.shiftDate,
      status: s.status,
    },
  };
}

function departmentToHit(d: Department): SearchHit {
  return {
    id: d.id,
    module: "departments",
    title: d.name,
    subtitle: [d.code, d.shortLabel].filter(Boolean).join(" · "),
    href: `/admin/staff`,
    score: 0,
    meta: {
      isActive: d.isActive,
      accentClass: d.accentClass,
      sortOrder: d.sortOrder,
    },
  };
}

export async function globalSearch(
  rawFilters: unknown,
): Promise<{ hits: SearchHit[]; total: number; facets: SearchFacets }> {
  const parsed = AdvancedSearchFiltersSchema.safeParse(rawFilters);
  const filters: AdvancedSearchFilters = parsed.success
    ? (parsed.data as AdvancedSearchFilters)
    : {};

  const query = normalizeStr(filters.query);
  const modules = filters.modules && filters.modules.length > 0
    ? filters.modules
    : (["staff", "shifts", "departments"] as SearchModuleId[]);
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const wantStaff = modules.includes("staff");
  const wantShifts = modules.includes("shifts");
  const wantDepts = modules.includes("departments");

  const staffPromise = wantStaff
    ? listStaff({
        search: query || undefined,
        departmentId: filters.departmentId ?? undefined,
        role: filters.role ?? undefined,
        status: filters.onlyActive ? "active" : "all",
        limit: 200,
      }).catch(() => ({ rows: [] as User[], total: 0 }))
    : Promise.resolve({ rows: [] as User[], total: 0 });

  const deptsPromise = wantDepts
    ? operationsRepository.listDepartments(false).catch(() => [] as Department[])
    : Promise.resolve([] as Department[]);

  const shiftsPromise = wantShifts
    ? (async () => {
        try {
          const today = new Date();
          const defaultFrom = new Date(today);
          defaultFrom.setUTCDate(today.getUTCDate() - 14);
          const defaultTo = new Date(today);
          defaultTo.setUTCDate(today.getUTCDate() + 30);
          const from = filters.dateFrom ?? defaultFrom.toISOString().slice(0, 10);
          const to = filters.dateTo ?? defaultTo.toISOString().slice(0, 10);
          const shifts = await operationsRepository.listShifts({
            from,
            to,
            withUserJoins: true,
          });
          return shifts as Shift[];
        } catch {
          return [] as Shift[];
        }
      })()
    : Promise.resolve([] as Shift[]);

  const [staffResult, departments, shifts] = await Promise.all([
    staffPromise,
    deptsPromise,
    shiftsPromise,
  ]);

  const allHits: SearchHit[] = [];

  for (const u of staffResult.rows as User[]) {
    if (filters.departmentId && u.departmentId !== filters.departmentId) continue;
    if (filters.role && u.role !== filters.role) continue;
    if (filters.onlyActive && !u.isActive) continue;
    const hit = userToHit(u);
    if (query) {
      const score = bestScore(
        [
          u.fullName,
          u.firstName,
          u.lastName,
          u.employeeId,
          u.jobTitle,
          u.email,
          u.mobile,
        ],
        query,
      );
      if (score <= 0 && wantStaff && modules.length === 1) {
        hit.score = 1;
      } else if (score > 0) {
        hit.score = score;
      } else {
        continue;
      }
    } else {
      hit.score = 5;
    }
    allHits.push(hit);
  }

  for (const d of departments) {
    if (filters.onlyActive && !d.isActive) continue;
    const hit = departmentToHit(d);
    if (query) {
      const score = bestScore([d.name, d.code, d.shortLabel], query);
      if (score > 0) {
        hit.score = score;
      } else {
        continue;
      }
    } else {
      hit.score = 4;
    }
    allHits.push(hit);
  }

  for (const s of shifts) {
    if (filters.departmentId && s.departmentId !== filters.departmentId) continue;
    if (filters.dateFrom && s.shiftDate < filters.dateFrom) continue;
    if (filters.dateTo && s.shiftDate > filters.dateTo) continue;
    const hit = shiftToHit(s);
    if (query) {
      const score = bestScore(
        [
          s.userFullName,
          s.userFirstName,
          s.userLastName,
          s.userEmployeeId,
          s.userJobTitle,
          s.departmentName,
          s.locationName,
          s.stationLabel,
          s.shiftDate,
        ],
        query,
      );
      if (score > 0) {
        hit.score = score;
      } else {
        continue;
      }
    } else {
      hit.score = 3;
    }
    allHits.push(hit);
  }

  allHits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.title.localeCompare(b.title);
  });

  const total = allHits.length;
  const paged = allHits.slice(offset, offset + limit);

  const moduleCounts = new Map<SearchModuleId, number>();
  const roleCounts = new Map<AppRole, number>();
  const deptCounts = new Map<string, { label: string; count: number }>();

  for (const h of allHits) {
    moduleCounts.set(h.module, (moduleCounts.get(h.module) ?? 0) + 1);
    if (h.module === "staff" && h.meta?.role) {
      const r = h.meta.role as AppRole;
      roleCounts.set(r, (roleCounts.get(r) ?? 0) + 1);
    }
    if (h.meta?.departmentId) {
      const did = String(h.meta.departmentId);
      const existing = deptCounts.get(did);
      const label =
        (h.module === "departments" ? h.title : ((h.meta as Record<string, unknown>)?.departmentName as string)) ??
        existing?.label ??
        did;
      deptCounts.set(did, {
        label,
        count: (existing?.count ?? 0) + 1,
      });
    }
  }

  const facets: SearchFacets = {
    modules: Array.from(moduleCounts.entries())
      .map(([id, count]) => ({
        id,
        label: MODULE_LABELS[id] ?? id,
        count,
      }))
      .sort((a, b) => b.count - a.count),
    roles: Array.from(roleCounts.entries())
      .map(([id, count]) => ({
        id,
        label: roleToLabel(id),
        count,
      }))
      .sort((a, b) => b.count - a.count),
    departments: Array.from(deptCounts.entries())
      .map(([id, v]) => ({ id, label: v.label, count: v.count }))
      .sort((a, b) => b.count - a.count),
  };

  return { hits: paged, total, facets };
}

export async function searchSuggest(
  rawQuery: unknown,
): Promise<{ hits: SearchHit[] }> {
  const q = typeof rawQuery === "string" ? rawQuery : "";
  const trimmed = normalizeStr(q);
  if (!trimmed) {
    return { hits: [] };
  }
  const modules = ["staff", "shifts", "departments"] as SearchModuleId[];
  const result = await globalSearch({
    query: trimmed,
    modules,
    limit: 30,
  });

  const perModule = new Map<SearchModuleId, SearchHit[]>();
  for (const m of modules) perModule.set(m, []);
  for (const h of result.hits) {
    const arr = perModule.get(h.module);
    if (!arr) continue;
    if (arr.length < 6) arr.push(h);
  }

  const ordered: SearchHit[] = [];
  for (const m of modules) {
    const arr = perModule.get(m) ?? [];
    ordered.push(...arr);
  }

  return { hits: ordered };
}
