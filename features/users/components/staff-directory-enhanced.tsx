"use client";

import { memo, useState } from "react";
import Link from "next/link";
import {
  Ban,
  Building2,
  Edit3,
  MessageSquare,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { clsx } from "clsx";
import type { User } from "@/types/user";
import type { DepartmentRow } from "@/features/data/actions/reference-actions.ts";
import { Button } from "@/components/ui/button";
import { deactivateStaff } from "@/features/users/actions/staff-actions";
import type { AppRole } from "@/types/app";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Super Admin",
  restaurant_admin: "Restaurant Admin",
  manager: "Manager",
  supervisor: "Supervisor",
  employee: "Employee",
};

const ROLE_TONE: Record<AppRole, "neutral" | "emerald" | "amber" | "rose" | "sky" | "teal" | "indigo" | "violet" | "slate"> = {
  super_admin: "rose",
  restaurant_admin: "indigo",
  manager: "sky",
  supervisor: "amber",
  employee: "emerald",
};

interface Props {
  users: User[];
  viewerRole: AppRole | null;
  departments: DepartmentRow[];
  onEdit: (userId: string) => void;
  onMessage: (userId: string, displayName: string) => void;
  onRefresh: () => void;
}

export const StaffDirectoryEnhanced = memo(function StaffDirectoryEnhanced({
  users,
  viewerRole,
  departments,
  onEdit,
  onMessage,
  onRefresh,
}: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const managerRoles: AppRole[] = ["super_admin", "restaurant_admin", "manager"];
  const canEdit = viewerRole ? managerRoles.includes(viewerRole) : false;

  const handleDeactivate = async (u: User) => {
    const id = u.id;
    const ok = window.confirm(
      `Deactivate ${u.firstName} ${u.lastName}?\n\nThis removes access and audit-logs the action. They can be reactivated later.`,
    );
    if (!ok) return;
    setDeletingId(id);
    try {
      const r = await deactivateStaff(id);
      if (!r.success) {
        toast.error(r.message, r.description ? { description: r.description } : undefined);
        return;
      }
      toast.success(`${u.firstName} ${u.lastName} deactivated`, {
        description: "Staff access revoked — recorded in the compliance audit log.",
      });
      onRefresh();
    } finally {
      setDeletingId(null);
    }
  };

  if (!users.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 p-12 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400">
          <MoreHorizontal className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-white">No staff match your filters</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">
          Try clearing filters, adjusting your search term, or adding a new staff member.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {users.map((u) => {
        const dept = departments.find((d) => d.id === u.departmentId);
        const name = `${u.firstName} ${u.lastName}`;
        return (
          <div
            key={u.id}
            className={clsx(
              "group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 shadow-xl shadow-slate-950/20 backdrop-blur transition hover:-translate-y-0.5 hover:border-white/15 hover:shadow-2xl",
              !u.isActive && "opacity-60",
            )}
          >
            {!u.isActive ? (
              <div className="absolute right-3 top-3 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-300 ring-1 ring-rose-400/20">
                Inactive
              </div>
            ) : null}
            <div className="flex items-start gap-3 p-4">
              <Avatar
                firstName={u.firstName}
                lastName={u.lastName}
                accent={u.color ?? undefined}
                src={u.avatarUrl ?? undefined}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="truncate text-sm font-semibold text-white">{name}</h4>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone={ROLE_TONE[u.role]} size="sm">{ROLE_LABEL[u.role]}</Badge>
                  {dept ? (
                    <Badge tone="neutral" size="sm" dotColor={dept.color ?? undefined}>
                      <Building2 className="mr-1 h-3 w-3" />
                      {dept.short_label}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-xs text-slate-400">{u.jobTitle ?? u.employeeId ?? "No details yet"}</p>
              </div>
            </div>

            <div className="border-t border-white/5 px-4 py-3 text-xs text-slate-400">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span>{u.mobile}</span>
                {u.employmentDate ? (
                  <span>
                    Since {new Date(u.employmentDate).toLocaleDateString(undefined, { year: "numeric", month: "short" })}
                  </span>
                ) : null}
              </div>
              {u.email ? <div className="mt-1 truncate">{u.email}</div> : null}
            </div>

            <div className="mt-auto flex items-stretch gap-1 border-t border-white/5 p-2">
              <Link
                href={`/admin/messages?recipient=${encodeURIComponent(u.id)}`}
                onClick={(e) => {
                  e.preventDefault();
                  onMessage(u.id, name);
                }}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Message
              </Link>
              <Button
                variant="ghost"
                size="sm"
                icon={<Edit3 className="h-3.5 w-3.5" />}
                onClick={() => onEdit(u.id)}
                disabled={!canEdit}
                title={canEdit ? "Edit staff" : "Insufficient permissions"}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={deletingId === u.id ? <Ban className="h-3.5 w-3.5 animate-pulse text-rose-300" /> : <Trash2 className="h-3.5 w-3.5 text-rose-300" />}
                onClick={() => handleDeactivate(u)}
                disabled={!canEdit || deletingId === u.id}
                title={canEdit ? "Deactivate" : "Insufficient permissions"}
              >
                {deletingId === u.id ? "…" : "Deactivate"}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
});

export { ROLE_LABEL, ROLE_TONE };
