"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Bookmark,
  BookmarkCheck,
  Eraser,
  Filter,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { clsx } from "clsx";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import {
  deleteFilterPreset,
  listFilterPresets,
  saveFilterPreset,
} from "@/features/users/actions/staff-actions";
import type { StaffListFilters, StaffSortKey } from "@/types/user";
import type { FilterPreset } from "@/types/preset";
import type { DepartmentRow } from "@/features/data/actions/reference-actions";
import { Modal } from "@/components/ui/modal";
import type { AppRole } from "@/types/app";

const SORT_OPTIONS: { value: StaffSortKey; label: string }[] = [
  { value: "name", label: "Name (A→Z)" },
  { value: "role", label: "Role" },
  { value: "department", label: "Department" },
  { value: "employment_date", label: "Employment date" },
  { value: "employee_id", label: "Employee ID" },
  { value: "is_active", label: "Active status" },
];

export interface StaffFilterBarProps {
  filters: StaffListFilters;
  departments: DepartmentRow[];
  onChange: (next: StaffListFilters) => void;
  onRefreshRequest?: () => void;
}

export function StaffFilterBar({ filters, departments, onChange, onRefreshRequest }: StaffFilterBarProps) {
  const [open, setOpen] = useState(false);
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [busy, setBusy] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshPresets = async () => {
    setPresets(await listFilterPresets("staff"));
  };

  useEffect(() => {
    void refreshPresets();
  }, []);

  const commit = (patch: Partial<StaffListFilters>) => {
    onChange({ ...filters, ...patch, offset: 0 });
  };

  const onSearchChange = (v: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const trimmed = v.trim();
    searchTimer.current = setTimeout(() => {
      commit({ search: trimmed.length ? trimmed : undefined });
    }, 220);
  };

  const resetAll = () => {
    onChange({
      sortBy: "name",
      sortDir: "asc",
      offset: 0,
      limit: filters.limit,
    });
    toast.success("Filters cleared");
    onRefreshRequest?.();
  };

  const applyPreset = (p: FilterPreset) => {
    onChange({ ...(p.filters as StaffListFilters), offset: 0 });
    setPresetsOpen(false);
    toast.success(`Applied preset “${p.name}”`);
    onRefreshRequest?.();
  };

  const handleSave = async () => {
    const name = saveName.trim();
    if (name.length < 2 || name.length > 40) {
      toast.error("Preset name must be 2–40 characters");
      return;
    }
    setBusy(true);
    try {
      const r = await saveFilterPreset("staff", name, filters, saveAsDefault);
      if (!r.success) {
        toast.error(r.message);
        return;
      }
      toast.success(`Saved preset “${name}”`);
      setSaveOpen(false);
      setSaveName("");
      setSaveAsDefault(false);
      await refreshPresets();
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePreset = async (id: string, name: string) => {
    setBusy(true);
    try {
      const r = await deleteFilterPreset("staff", id);
      if (!r.success) {
        toast.error(r.message);
        return;
      }
      toast.success(`Deleted preset “${name}”`);
      await refreshPresets();
    } finally {
      setBusy(false);
    }
  };

  const activeChipCount = useMemo(() => {
    let c = 0;
    if (filters.search?.trim()) c++;
    if (filters.departmentId) c++;
    if (filters.role) c++;
    if (filters.status && filters.status !== "all") c++;
    if (filters.employeeId?.trim()) c++;
    if (filters.sortBy && filters.sortBy !== "name") c++;
    if (filters.sortDir && filters.sortDir !== "asc") c++;
    return c;
  }, [filters]);

  return (
    <div className="rounded-3xl border border-slate-800 bg-[#181920]/90 p-5 shadow-2xl backdrop-blur-md text-slate-100">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        {/* Search input container */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            className="w-full rounded-xl border border-slate-800 bg-slate-900/90 pl-11 pr-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="Search by name, mobile, email, job title…"
            defaultValue={filters.search ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {/* Dropdowns Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4 xl:w-[720px]">
          <Field label="Department">
            <Select
              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              value={filters.departmentId ?? ""}
              onChange={(e) => commit({ departmentId: e.target.value || undefined })}
            >
              <option value="" className="bg-slate-900 text-slate-300">All</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id} className="bg-slate-900 text-slate-300">{d.name}</option>
              ))}
            </Select>
          </Field>

          <Field label="Role">
            <Select
              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              value={filters.role ?? ""}
              onChange={(e) => commit({ role: (e.target.value as AppRole) || undefined })}
            >
              <option value="" className="bg-slate-900 text-slate-300">All</option>
              <option value="super_admin" className="bg-slate-900 text-slate-300">Super Admin</option>
              <option value="restaurant_admin" className="bg-slate-900 text-slate-300">Restaurant Admin</option>
              <option value="manager" className="bg-slate-900 text-slate-300">Manager</option>
              <option value="supervisor" className="bg-slate-900 text-slate-300">Supervisor</option>
              <option value="employee" className="bg-slate-900 text-slate-300">Employee</option>
            </Select>
          </Field>

          <Field label="Status">
            <Select
              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              value={filters.status ?? "all"}
              onChange={(e) => commit({ status: e.target.value as "active" | "inactive" | "all" })}
            >
              <option value="all" className="bg-slate-900 text-slate-300">All</option>
              <option value="active" className="bg-slate-900 text-slate-300">Active only</option>
              <option value="inactive" className="bg-slate-900 text-slate-300">Inactive only</option>
            </Select>
          </Field>

          <Field label="Employee ID">
            <Input
              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
              placeholder="EMP-0042"
              defaultValue={filters.employeeId ?? ""}
              onChange={(e) => {
                const v = e.target.value.trim();
                commit({ employeeId: v || undefined });
              }}
            />
          </Field>
        </div>
      </div>

      {/* Control Action Buttons */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
          >
            <SlidersHorizontal className="h-4 w-4 text-slate-400" />
            Sort
          </button>

          <button
            type="button"
            className="relative inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
            onClick={() => setPresetsOpen((o) => !o)}
            aria-expanded={presetsOpen}
          >
            <Bookmark className="h-4 w-4 text-slate-400" />
            Presets
            {presets.length ? (
              <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[11px] font-bold text-blue-400 border border-blue-500/30">
                {presets.length}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500"
            onClick={() => setSaveOpen(true)}
          >
            <BookmarkCheck className="h-4 w-4" />
            Save as preset
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
            onClick={resetAll}
          >
            <Eraser className="h-4 w-4 text-slate-400" />
            Clear filters
          </button>

          {activeChipCount > 0 ? (
            <span className="ml-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-400">
              {activeChipCount} active
            </span>
          ) : null}
        </div>

        <div className="text-xs font-medium text-slate-500">
          Results are retrieved server-side — no bulk client download.
        </div>
      </div>

      {/* Expanded Sort Panel */}
      {open ? (
        <div className="mt-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:grid-cols-3">
          <Field label="Sort by">
            <Select
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white"
              value={filters.sortBy ?? "name"}
              onChange={(e) => commit({ sortBy: e.target.value as StaffSortKey })}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-slate-900">{o.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Direction">
            <Select
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white"
              value={filters.sortDir ?? "asc"}
              onChange={(e) => commit({ sortDir: e.target.value as "asc" | "desc" })}
            >
              <option value="asc" className="bg-slate-900">Ascending</option>
              <option value="desc" className="bg-slate-900">Descending</option>
            </Select>
          </Field>
          <div className="flex items-center justify-end gap-2 self-end">
            <Button
              variant="ghost"
              className="rounded-xl border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={() => commit({ sortDir: (filters.sortDir ?? "asc") === "asc" ? "desc" : "asc" })}
              icon={filters.sortDir === "desc" ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpAZ className="h-4 w-4" />}
            >
              Flip
            </Button>
            <Button variant="primary" className="rounded-xl bg-blue-600 text-white hover:bg-blue-500" onClick={() => onRefreshRequest?.()}>
              Apply & refresh
            </Button>
          </div>
        </div>
      ) : null}

      {/* Expanded Presets Panel */}
      {presetsOpen ? (
        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h4 className="text-sm font-semibold text-white">Saved presets</h4>
            <button
              type="button"
              onClick={() => setPresetsOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {!presets.length ? (
            <p className="py-4 text-sm text-slate-400">No presets yet — save your current filters using the button above.</p>
          ) : (
            <ul className="divide-y divide-slate-800/60">
              {presets.map((p) => {
                const f = p.filters as StaffListFilters;
                const chips: string[] = [];
                if (f.search?.trim()) chips.push(`search:${f.search}`);
                if (f.departmentId) {
                  const d = departments.find((x) => x.id === f.departmentId);
                  chips.push(d?.name ?? `dept:${f.departmentId.slice(0, 6)}…`);
                }
                if (f.role) chips.push(f.role.replace(/_/g, " "));
                if (f.status && f.status !== "all") chips.push(f.status);
                if (f.employeeId) chips.push(`ID:${f.employeeId}`);
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 py-3">
                    <button
                      type="button"
                      onClick={() => applyPreset(p)}
                      className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-slate-800/60"
                    >
                      <BookmarkCheck
                        className={clsx(
                          "h-4 w-4 flex-shrink-0",
                          p.isDefault ? "text-amber-400" : "text-slate-500 group-hover:text-blue-400",
                        )}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">
                          {p.name}
                          {p.isDefault ? (
                            <span className="ml-2 rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-400 border border-amber-400/20">
                              Default
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {chips.length ? chips.map((c) => (
                            <span key={c} className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-300 border border-slate-700">{c}</span>
                          )) : <span className="text-[11px] text-slate-500">no filters</span>}
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-50"
                      onClick={() => handleDeletePreset(p.id, p.name)}
                      aria-label={`Delete preset ${p.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {/* Save Preset Modal */}
      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        size="sm"
        title="Save filter preset"
        subtitle="Give this combination a friendly name so you can reapply it later."
        footer={
          <>
            <Button variant="ghost" className="text-slate-400 hover:text-white" onClick={() => setSaveOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="primary" className="bg-blue-600 text-white hover:bg-blue-500" onClick={handleSave} disabled={busy || !saveName.trim()}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-slate-100">
          <Field label="Preset name" error={saveName.length > 0 && (saveName.length < 2 || saveName.length > 40) ? "Must be 2–40 characters" : undefined}>
            <Input
              autoFocus
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
              placeholder="Kitchen day shift"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
            />
          </Field>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 transition hover:bg-slate-800">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500/30"
              checked={saveAsDefault}
              onChange={(e) => setSaveAsDefault(e.target.checked)}
            />
            <div>
              <div className="text-sm font-semibold text-white">Use as my default preset</div>
              <div className="text-xs text-slate-400">
                Automatically applied when you open the staff directory.
              </div>
            </div>
          </label>
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-300">
            <Filter className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" />
            Presets are private — only you can see or load them.
          </div>
        </div>
      </Modal>
    </div>
  );
}
