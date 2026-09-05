"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UserPlus2, RotateCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { AddStaffModal } from "@/features/users/components/add-staff-modal";
import { StaffFilterBar } from "@/features/users/components/staff-filter-bar";
import { StaffDirectoryEnhanced } from "@/features/users/components/staff-directory-enhanced";
import { listStaff, listFilterPresets } from "@/features/users/actions/staff-actions";
import { listDepartments } from "@/features/data/actions/reference-actions";
import type { DepartmentRow } from "@/features/data/actions/reference-actions";
import type { StaffListFilters, User } from "@/types/user";
import type { FilterPreset } from "@/types/preset";
import type { AppRole } from "@/types/app";

interface StaffManagementShellProps {
  viewerRole: AppRole | null;
}

const DEFAULT_FILTERS: StaffListFilters = {
  sortBy: "name",
  sortDir: "asc",
  limit: 60,
  offset: 0,
  status: "active",
};

export function StaffManagementShell({ viewerRole }: StaffManagementShellProps) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [filters, setFilters] = useState<StaffListFilters>(DEFAULT_FILTERS);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { rows, total: t } = await listStaff(filters);
      setUsers(rows);
      setTotal(t);
    } catch (e: unknown) {
      toast.error("Could not load staff directory", {
        description: e instanceof Error ? e.message : "Please try again",
      });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Boot: departments + apply default preset if any
  useEffect(() => {
    (async () => {
      let depts: DepartmentRow[] = [];
      let presets: FilterPreset[] = [];
      try {
        [depts, presets] = await Promise.all([
          listDepartments(),
          listFilterPresets("staff").catch((e) => {
            console.warn("[staff] filter presets unavailable", e instanceof Error ? e.message : String(e));
            return [] as FilterPreset[];
          }),
        ]);
      } catch (e: unknown) {
        toast.error("Could not load reference data", {
          description: e instanceof Error ? e.message : "Please try again",
        });
      }
      setDepartments(depts);
      if (depts.length === 0) {
        toast.warning("No departments available", {
          description: "Run migrations 004 (departments table) + 005 (seed FOH/KIT/BAR/MGT) in Supabase SQL Editor.",
          duration: 10000,
        });
      }
      const def = (presets as FilterPreset[]).find((p) => p.isDefault);
      const override = def?.filters as StaffListFilters | undefined;
      setFilters({ ...DEFAULT_FILTERS, ...(override ?? {}) });
    })();
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onEdit = (id: string) => {
    setEditingId(id);
    setAddOpen(true);
  };

  const onMessage = (recipientId: string, displayName: string) => {
    router.push(`/admin/messages?recipient=${encodeURIComponent(recipientId)}`);
    toast.message(`Opening conversation with ${displayName}`);
  };

  // Count visible vs total for status bar
  const visibleCount = useMemo(() => {
    const limit = filters.limit ?? 60;
    return {
      showing: Math.min(limit, users.length),
      total,
    };
  }, [users.length, total, filters.limit]);

  return (
    <div className="space-y-6">
      {/* Dark Theme Header Banner Container */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 rounded-3xl border border-slate-800 bg-[#181920]/90 backdrop-blur-md p-4 sm:p-6 shadow-2xl text-slate-100">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Staff Directory
            </h1>
            <Badge tone="emerald" size="sm" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              DATABASE-BACKED
            </Badge>
            <Badge tone="indigo" size="sm" className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              AUDIT-LOGGED
            </Badge>
          </div>
          <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm text-slate-400 max-w-2xl">
            Create, filter, and communicate with your team. All edits are permission-checked and recorded.
          </p>
          <div className="mt-2.5 sm:mt-3.5 flex flex-wrap items-center gap-2 text-xs text-slate-400 font-medium">
            <span>
              Showing <span className="font-bold text-white">{visibleCount.showing}</span> of{" "}
              <span className="font-bold text-white">{visibleCount.total}</span> records
            </span>
            <span className="text-slate-700">•</span>
            <span>{departments.length} departments loaded</span>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-2.5 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="flex-1 sm:flex-none justify-center inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 sm:px-3.5 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-blue-400" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setAddOpen(true);
            }}
            disabled={!viewerRole || !(["super_admin", "restaurant_admin", "manager"] as AppRole[]).includes(viewerRole)}
            title={
              viewerRole && (["super_admin", "restaurant_admin", "manager"] as AppRole[]).includes(viewerRole)
                ? "Add a new staff member"
                : "Staff creation is restricted to managers and above"
            }
            className="flex-1 sm:flex-none justify-center inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 sm:px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 active:scale-[0.98] disabled:opacity-50 transition-all shadow-lg shadow-blue-600/20"
          >
            <UserPlus2 className="h-4 w-4" />
            <span>Add staff</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <StaffFilterBar
        filters={filters}
        departments={departments}
        onChange={(next) => setFilters((prev) => ({ ...prev, ...next }))}
        onRefreshRequest={() => void refresh()}
      />

      {/* Grid Content or Skeleton Loader */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-3xl border border-slate-800/80 bg-slate-900/40 p-5 space-y-4"
              aria-hidden
            >
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-full bg-slate-800" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-2/3 rounded bg-slate-800" />
                  <div className="h-3 w-1/3 rounded bg-slate-800/60" />
                </div>
              </div>
              <div className="h-3 w-full rounded bg-slate-800/40" />
              <div className="h-8 w-full rounded-xl bg-slate-800/50" />
            </div>
          ))}
        </div>
      ) : (
        <StaffDirectoryEnhanced
          users={users}
          viewerRole={viewerRole}
          departments={departments}
          onEdit={onEdit}
          onMessage={onMessage}
          onRefresh={() => void refresh()}
        />
      )}

      {/* Modal Container */}
      <AddStaffModal
        open={addOpen}
        editingStaffId={editingId}
        viewerRole={viewerRole}
        onClose={() => {
          setAddOpen(false);
          setEditingId(null);
        }}
        onSaved={() => void refresh()}
      />
    </div>
  );
}