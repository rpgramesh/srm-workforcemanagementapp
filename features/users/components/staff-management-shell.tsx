"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UserPlus2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/70 via-slate-900/50 to-emerald-500/5 p-6 shadow-xl shadow-slate-950/30 backdrop-blur">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-[-0.02em] text-white">
              Staff Directory
            </h1>
            <Badge tone="emerald" size="sm">Database-backed</Badge>
            <Badge tone="indigo" size="sm">Audit-logged</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Create, filter, and communicate with your team. All edits are permission-checked and recorded.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>Showing <span className="font-medium text-slate-200">{visibleCount.showing}</span> of <span className="font-medium text-slate-200">{visibleCount.total}</span> records</span>
            <span className="text-slate-600">•</span>
            <span>{departments.length} departments loaded</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => void refresh()}>Refresh</Button>
          <Button
            variant="primary"
            icon={<UserPlus2 className="h-4 w-4" />}
            onClick={() => {
              setEditingId(null);
              setAddOpen(true);
            }}
            disabled={!viewerRole || !(["super_admin", "restaurant_admin", "manager"] as AppRole[]).includes(viewerRole)}
            title={viewerRole && (["super_admin", "restaurant_admin", "manager"] as AppRole[]).includes(viewerRole) ? "Add a new staff member" : "Staff creation is restricted to managers and above"}
          >
            Add staff
          </Button>
        </div>
      </div>

      <StaffFilterBar
        filters={filters}
        departments={departments}
        onChange={(next) => setFilters((prev) => ({ ...prev, ...next }))}
        onRefreshRequest={() => void refresh()}
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl border border-white/10 bg-slate-900/50"
              aria-hidden
            />
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
