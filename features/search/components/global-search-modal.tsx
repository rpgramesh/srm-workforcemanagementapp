"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  X,
  Filter,
  Calendar,
  Users,
  Building2,
  CalendarClock,
  MessageSquare,
  FileText,
  Banknote,
  ListTodo,
  ChevronDown,
  Check,
  Command,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ModuleResultRow } from "@/features/search/components/module-result-row";
import { globalSearch, searchSuggest } from "@/features/search/actions/search-actions";
import type {
  AdvancedSearchFilters,
  SearchHit,
  SearchModuleId,
} from "@/types/platform";
import type { AppRole } from "@/types/app";
import { cn } from "@/lib/utils";

const ALL_MODULES: SearchModuleId[] = [
  "staff",
  "shifts",
  "departments",
  "messages",
  "audit_logs",
  "payroll",
  "roster",
];

const MODULE_META: Record<
  SearchModuleId,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  staff: { label: "Staff", Icon: Users },
  shifts: { label: "Shifts", Icon: CalendarClock },
  departments: { label: "Departments", Icon: Building2 },
  messages: { label: "Messages", Icon: MessageSquare },
  audit_logs: { label: "Audit Logs", Icon: FileText },
  payroll: { label: "Payroll", Icon: Banknote },
  roster: { label: "Roster", Icon: ListTodo },
};

const ROLE_OPTIONS: Array<{ id: AppRole; label: string }> = [
  { id: "super_admin", label: "Super Admin" },
  { id: "restaurant_admin", label: "Restaurant Admin" },
  { id: "manager", label: "Manager" },
  { id: "supervisor", label: "Supervisor" },
  { id: "employee", label: "Employee" },
];

interface GlobalSearchModalProps {
  open: boolean;
  onClose: () => void;
}

interface FacetState {
  modules: Array<{ id: SearchModuleId; label: string; count: number }>;
  roles: Array<{ id: AppRole; label: string; count: number }>;
  departments: Array<{ id: string; label: string; count: number }>;
}

const DEFAULT_FACETS: FacetState = { modules: [], roles: [], departments: [] };

export function GlobalSearchModal({ open, onClose }: GlobalSearchModalProps) {
  const [query, setQuery] = useState("");
  const [activeModules, setActiveModules] = useState<SearchModuleId[]>([]);
  const [filters, setFilters] = useState<Omit<AdvancedSearchFilters, "query" | "modules">>({});
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<FacetState>(DEFAULT_FACETS);
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const deptDropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(hits.length - 1, prev + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(-1, prev - 1));
      } else if (e.key === "Enter" && activeIndex >= 0 && hits[activeIndex]) {
        e.preventDefault();
        const hit = hits[activeIndex];
        window.location.href = hit.href;
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, hits, activeIndex]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (roleDropdownOpen && roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) {
        setRoleDropdownOpen(false);
      }
      if (deptDropdownOpen && deptDropdownRef.current && !deptDropdownRef.current.contains(e.target as Node)) {
        setDeptDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [roleDropdownOpen, deptDropdownOpen]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveModules([]);
      setFilters({});
      setHits([]);
      setTotal(0);
      setFacets(DEFAULT_FACETS);
      setActiveIndex(-1);
      setShowAdvanced(false);
      setRoleDropdownOpen(false);
      setDeptDropdownOpen(false);
      return;
    }
    runSearch("", [], {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(query, activeModules, filters);
    }, 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, activeModules, filters, open]);

  const runSearch = useCallback(
    async (q: string, mods: SearchModuleId[], f: typeof filters) => {
      setLoading(true);
      try {
        const payload: AdvancedSearchFilters = {
          ...f,
          query: q || undefined,
          modules: mods.length > 0 ? mods : undefined,
          limit: 50,
        };
        let result;
        if (!q && mods.length === 0 && !f.role && !f.departmentId && !f.dateFrom && !f.dateTo && !f.onlyActive) {
          result = await searchSuggest("");
          setHits(result.hits);
          setTotal(0);
          setFacets(DEFAULT_FACETS);
        } else if (q && mods.length === 0 && !f.role && !f.departmentId && !f.dateFrom && !f.dateTo && !f.onlyActive) {
          result = await searchSuggest(q);
          setHits(result.hits);
          setTotal(result.hits.length);
          setFacets(DEFAULT_FACETS);
        } else {
          const r = await globalSearch(payload);
          setHits(r.hits);
          setTotal(r.total);
          setFacets(r.facets as FacetState);
        }
      } catch {
        setHits([]);
        setTotal(0);
      } finally {
        setLoading(false);
        setActiveIndex(-1);
      }
    },
    [],
  );

  const groupedHits = useMemo(() => {
    const groups = new Map<SearchModuleId, SearchHit[]>();
    for (const m of ALL_MODULES) groups.set(m, []);
    for (const h of hits) {
      const arr = groups.get(h.module) ?? [];
      arr.push(h);
      groups.set(h.module, arr);
    }
    return Array.from(groups.entries()).filter(([, arr]) => arr.length > 0);
  }, [hits]);

  const toggleModule = (m: SearchModuleId) => {
    setActiveModules((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );
  };

  const clearAllFilters = () => {
    setActiveModules([]);
    setFilters({});
    setQuery("");
  };

  const updateFilter = <K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const flatHits = useMemo(() => hits, [hits]);

  useEffect(() => {
    if (activeIndex < 0 || !resultListRef.current) return;
    const el = resultListRef.current.querySelector<HTMLElement>(
      `[data-result-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const hasAnyFilter =
    activeModules.length > 0 ||
    !!filters.role ||
    !!filters.departmentId ||
    !!filters.dateFrom ||
    !!filters.dateTo ||
    !!filters.onlyActive;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 pt-[12vh] sm:pt-[14vh]">
      <div
        className="fixed inset-0 bg-slate-50/80 backdrop-blur-md"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Global Search"
        className="relative z-10 w-full max-w-3xl rounded-3xl border border-slate-200 bg-white/95 shadow-2xl shadow-slate-950/60 ring-1 ring-white/5 backdrop-blur-xl"
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 pt-5 pb-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-blue-500/25 bg-blue-500/10 text-blue-600">
            <Search className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  activeModules.length > 0
                    ? `Search in ${activeModules.map((m) => MODULE_META[m].label).join(", ")}...`
                    : "Search staff, shifts, departments... (type to filter)"
                }
                className="h-12 rounded-2xl border-white/5 bg-slate-50/40 pl-4 pr-28 text-base"
              />
              <div className="pointer-events-none absolute right-24 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/60 px-1.5 py-1 text-[10px] text-slate-500 sm:flex">
                <Command className="size-3" />
                <span>K</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white/5 text-slate-500 transition hover:bg-white/10 hover:text-slate-900"
            aria-label="Close search"
          >
            <X className="size-4.5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-5 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {ALL_MODULES.slice(0, 3).map((m) => {
              const { label, Icon } = MODULE_META[m];
              const active = activeModules.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleModule(m)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "border-blue-500/30 bg-blue-500/10 text-blue-700"
                      : "border-slate-200 bg-white/5 text-slate-700 hover:bg-white/10",
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                </button>
              );
            })}
          </div>
          <div className="mx-2 hidden h-5 w-px bg-white/10 sm:block" />
          <div className="flex flex-wrap items-center gap-1.5 sm:hidden">
            {ALL_MODULES.slice(3).map((m) => {
              const { label, Icon } = MODULE_META[m];
              const active = activeModules.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleModule(m)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    active
                      ? "border-blue-500/30 bg-blue-500/10 text-blue-700"
                      : "border-slate-200 bg-white/5 text-slate-700 hover:bg-white/10",
                  )}
                >
                  <Icon className="size-3" />
                  {label}
                </button>
              );
            })}
          </div>
          <div className="hidden sm:flex sm:flex-wrap sm:items-center sm:gap-1.5">
            {ALL_MODULES.slice(3).map((m) => {
              const { label, Icon } = MODULE_META[m];
              const active = activeModules.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleModule(m)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "border-blue-500/30 bg-blue-500/10 text-blue-700"
                      : "border-slate-200 bg-white/5 text-slate-700 hover:bg-white/10",
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                </button>
              );
            })}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAdvanced((s) => !s)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                showAdvanced || hasAnyFilter
                  ? "border-amber-400/25 bg-amber-400/10 text-amber-200"
                  : "border-slate-200 bg-white/5 text-slate-700 hover:bg-white/10",
              )}
            >
              <Filter className="size-3.5" />
              Filters
              <ChevronDown
                className={cn(
                  "size-3 transition-transform",
                  showAdvanced && "rotate-180",
                )}
              />
            </button>
          </div>
        </div>

        {showAdvanced ? (
          <div className="space-y-3 border-b border-white/5 bg-slate-50/30 px-5 py-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="relative" ref={roleDropdownRef}>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Role
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setRoleDropdownOpen((o) => !o);
                    setDeptDropdownOpen(false);
                  }}
                  className="flex h-11 w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/40 px-4 text-left text-sm text-slate-900 transition-colors hover:border-slate-300"
                >
                  <span className={cn(!filters.role && "text-slate-500")}>
                    {filters.role ? ROLE_OPTIONS.find((r) => r.id === filters.role)?.label : "Any role"}
                  </span>
                  <ChevronDown className="size-4 text-slate-500" />
                </button>
                {roleDropdownOpen ? (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white/98 p-1 shadow-2xl backdrop-blur">
                    <button
                      type="button"
                      onClick={() => {
                        updateFilter("role", null);
                        setRoleDropdownOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs text-slate-500 hover:bg-white/5"
                    >
                      Any role
                      {!filters.role ? <Check className="size-3.5 text-blue-600" /> : null}
                    </button>
                    {ROLE_OPTIONS.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          updateFilter("role", r.id);
                          setRoleDropdownOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-900 hover:bg-white/5"
                      >
                        {r.label}
                        {filters.role === r.id ? (
                          <Check className="size-3.5 text-blue-600" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="relative" ref={deptDropdownRef}>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Department
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setDeptDropdownOpen((o) => !o);
                    setRoleDropdownOpen(false);
                  }}
                  className="flex h-11 w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/40 px-4 text-left text-sm text-slate-900 transition-colors hover:border-slate-300"
                >
                  <span className={cn(!filters.departmentId && "text-slate-500")}>
                    {filters.departmentId
                      ? facets.departments.find((d) => d.id === filters.departmentId)?.label ??
                        "Selected"
                      : "Any department"}
                  </span>
                  <ChevronDown className="size-4 text-slate-500" />
                </button>
                {deptDropdownOpen ? (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white/98 p-1 shadow-2xl backdrop-blur">
                    <button
                      type="button"
                      onClick={() => {
                        updateFilter("departmentId", null);
                        setDeptDropdownOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs text-slate-500 hover:bg-white/5"
                    >
                      Any department
                      {!filters.departmentId ? <Check className="size-3.5 text-blue-600" /> : null}
                    </button>
                    {(facets.departments.length > 0
                      ? facets.departments
                      : []
                    ).map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          updateFilter("departmentId", d.id);
                          setDeptDropdownOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-900 hover:bg-white/5"
                      >
                        <span className="truncate">{d.label}</span>
                        <div className="flex items-center gap-2">
                          <Badge tone="slate" size="sm">{d.count}</Badge>
                          {filters.departmentId === d.id ? (
                            <Check className="size-3.5 text-blue-600" />
                          ) : null}
                        </div>
                      </button>
                    ))}
                    {facets.departments.length === 0 ? (
                      <p className="px-3 py-4 text-center text-xs text-slate-500">
                        Run a search first to see departments
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Active Only
                </label>
                <button
                  type="button"
                  onClick={() => updateFilter("onlyActive", filters.onlyActive ? null : true)}
                  className={cn(
                    "flex h-11 w-full items-center justify-between rounded-2xl border px-4 text-sm transition-colors",
                    filters.onlyActive
                      ? "border-blue-500/30 bg-blue-500/10 text-blue-700"
                      : "border-slate-200 bg-slate-50/40 text-slate-500 hover:border-slate-300 hover:text-slate-700",
                  )}
                >
                  <span>{filters.onlyActive ? "Active staff/shifts only" : "Include inactive"}</span>
                  <div
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full border",
                      filters.onlyActive
                        ? "border-blue-500/40 bg-blue-500/20"
                        : "border-slate-200 bg-slate-50/60",
                    )}
                  >
                    {filters.onlyActive ? <Check className="size-3 text-blue-600" /> : null}
                  </div>
                </button>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Date From
                </label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="date"
                    value={filters.dateFrom ?? ""}
                    onChange={(e) =>
                      updateFilter("dateFrom", e.target.value ? e.target.value : null)
                    }
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/40 pl-11 pr-4 text-sm text-slate-900 text-slate-900 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 [color-scheme:dark]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Date To
                </label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="date"
                    value={filters.dateTo ?? ""}
                    onChange={(e) =>
                      updateFilter("dateTo", e.target.value ? e.target.value : null)
                    }
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/40 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 [color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <Button
                  variant="ghost"
                  onClick={clearAllFilters}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white/5 hover:bg-white/10"
                >
                  <X className="size-4" />
                  Clear filters
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {hasAnyFilter ? (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-white/5 px-5 py-2.5">
            {activeModules.map((m) => {
              const { label, Icon } = MODULE_META[m];
              return (
                <Badge key={m} tone="emerald" size="sm" className="gap-1">
                  <Icon className="size-3" />
                  {label}
                  <button
                    type="button"
                    onClick={() => toggleModule(m)}
                    className="ml-0.5 rounded-full hover:bg-white/10"
                    aria-label={`Remove ${label} filter`}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              );
            })}
            {filters.role ? (
              <Badge tone="sky" size="sm" className="gap-1">
                <Users className="size-3" />
                {ROLE_OPTIONS.find((r) => r.id === filters.role)?.label}
                <button
                  type="button"
                  onClick={() => updateFilter("role", null)}
                  className="ml-0.5 rounded-full hover:bg-white/10"
                  aria-label="Remove role filter"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ) : null}
            {filters.departmentId ? (
              <Badge tone="teal" size="sm" className="gap-1">
                <Building2 className="size-3" />
                {facets.departments.find((d) => d.id === filters.departmentId)?.label ??
                  "Department"}
                <button
                  type="button"
                  onClick={() => updateFilter("departmentId", null)}
                  className="ml-0.5 rounded-full hover:bg-white/10"
                  aria-label="Remove department filter"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ) : null}
            {filters.onlyActive ? (
              <Badge tone="emerald" size="sm" className="gap-1">
                <Check className="size-3" />
                Active only
                <button
                  type="button"
                  onClick={() => updateFilter("onlyActive", null)}
                  className="ml-0.5 rounded-full hover:bg-white/10"
                  aria-label="Remove active-only filter"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ) : null}
            {filters.dateFrom ? (
              <Badge tone="amber" size="sm" className="gap-1">
                <Calendar className="size-3" />
                From {filters.dateFrom}
                <button
                  type="button"
                  onClick={() => updateFilter("dateFrom", null)}
                  className="ml-0.5 rounded-full hover:bg-white/10"
                  aria-label="Remove date-from filter"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ) : null}
            {filters.dateTo ? (
              <Badge tone="amber" size="sm" className="gap-1">
                <Calendar className="size-3" />
                To {filters.dateTo}
                <button
                  type="button"
                  onClick={() => updateFilter("dateTo", null)}
                  className="ml-0.5 rounded-full hover:bg-white/10"
                  aria-label="Remove date-to filter"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-between px-5 py-2.5 text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            {loading ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 animate-pulse rounded-full bg-blue-600" />
                Searching...
              </span>
            ) : (
              <span>
                {flatHits.length > 0
                  ? `${flatHits.length}${total > flatHits.length ? ` of ${total}` : ""} result${
                      flatHits.length === 1 ? "" : "s"
                    }`
                  : "No results"}
              </span>
            )}
            {facets.roles.length > 0 || facets.departments.length > 0 ? (
              <span className="hidden items-center gap-2 sm:inline-flex">
                {facets.roles.length > 0 ? (
                  <Badge tone="slate" size="sm">
                    {facets.roles.reduce((a, b) => a + b.count, 0)} roles
                  </Badge>
                ) : null}
                {facets.departments.length > 0 ? (
                  <Badge tone="slate" size="sm">
                    {facets.departments.length} depts
                  </Badge>
                ) : null}
              </span>
            ) : null}
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white/5 px-1.5 py-0.5 text-[10px]">
              <kbd className="font-sans">↑</kbd>
              <kbd className="font-sans">↓</kbd>
              Navigate
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white/5 px-1.5 py-0.5 text-[10px]">
              <kbd className="font-sans">Enter</kbd>
              Open
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white/5 px-1.5 py-0.5 text-[10px]">
              <kbd className="font-sans">Esc</kbd>
              Close
            </span>
          </div>
        </div>

        <div
          ref={resultListRef}
          className="max-h-[50vh] min-h-[180px] overflow-y-auto px-3 pb-5 pt-2"
        >
          {flatHits.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex size-14 items-center justify-center rounded-2xl border border-slate-200 bg-white/5 text-slate-500">
                <Search className="size-6" />
              </div>
              <p className="text-sm font-medium text-slate-700">No matching results</p>
              <p className="mt-1 max-w-xs text-xs text-slate-500">
                {query
                  ? `Try different keywords for "${query}", or remove some filters`
                  : "Start typing to search across staff, shifts, and departments"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedHits.map(([moduleId, groupHits]) => {
                const { label, Icon } = MODULE_META[moduleId];
                return (
                  <div key={moduleId} className="space-y-1.5">
                    <div className="sticky top-0 z-10 flex items-center gap-2 bg-white/95 px-2 py-1 backdrop-blur">
                      <Icon className="size-3.5 text-slate-500" />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {label}
                      </span>
                      <span className="text-[10px] text-slate-600">
                        · {groupHits.length}
                      </span>
                      <div className="ml-2 h-px flex-1 bg-white/5" />
                    </div>
                    <div className="space-y-1">
                      {groupHits.map((hit) => {
                        const idx = flatHits.indexOf(hit);
                        return (
                          <div
                            key={`${hit.module}-${hit.id}`}
                            data-result-index={idx}
                            onMouseEnter={() => setActiveIndex(idx)}
                          >
                            <ModuleResultRow
                              hit={hit}
                              active={idx === activeIndex}
                              onClick={() => {
                                window.location.href = hit.href;
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
