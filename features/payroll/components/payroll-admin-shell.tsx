"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  BadgeDollarSign,
  BadgeCheck,
  Ban,
  CheckCircle2,
  Clock4,
  DollarSign,
  FileCheck2,
  Filter,
  PenLine,
  Pencil,
  PlusCircle,
  RefreshCcw,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, TextArea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  adminBulkApproveAttendance,
  adminCreatePayout,
  adminListAttendance,
  adminListPayouts,
  adminSetAttendanceApproval,
  adminSetPayoutStatus,
  adminSetStaffHourlyRate,
  adminUpdateAttendance,
  calcPayoutPreview,
} from "@/features/attendance/actions/payroll-actions";
import { cn, formatCurrency } from "@/lib/utils";
import type { AttendanceApprovalStatus, AttendanceSession, PayoutPreview, StaffPayout } from "@/types/domain";
import type { User } from "@/types/user";
import { initialsFromName } from "@/lib/user-labels";

export interface StaffRow {
  id: string;
  fullName: string;
  employeeId: string | null;
  role: string;
  jobTitle: string | null;
  hourlyRate: number | null;
  isActive: boolean;
  color: string | null;
}

function fmtHM(totalMinutes: number) {
  const clamped = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-AU", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-AU", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

const DATE_INPUT_FMT = (d: Date) => d.toISOString().slice(0, 10);

export interface PayrollAdminShellProps {
  staff: StaffRow[];
}

function defaultPeriodStart() {
  const d = new Date();
  d.setDate(d.getDate() - 13);
  return DATE_INPUT_FMT(d);
}
function defaultPeriodEnd() {
  return DATE_INPUT_FMT(new Date());
}

export function PayrollAdminShell({ staff }: PayrollAdminShellProps) {
  const [periodStart, setPeriodStart] = useState(defaultPeriodStart());
  const [periodEnd, setPeriodEnd] = useState(defaultPeriodEnd());
  const [userIdFilter, setUserIdFilter] = useState<string>("");
  const [approvalFilter, setApprovalFilter] = useState<AttendanceApprovalStatus[]>([]);
  const [statusFilter, setStatusFilter] = useState<AttendanceSession["status"][]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [attendance, setAttendance] = useState<AttendanceSession[]>([]);
  const [payouts, setPayouts] = useState<StaffPayout[]>([]);
  const [preview, setPreview] = useState<PayoutPreview | null>(null);
  const [isLoading, startTransition] = useTransition();

  const [editAttendanceId, setEditAttendanceId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    clockedInAt: string;
    clockedOutAt: string;
    status: AttendanceSession["status"];
    note: string;
    reason: string;
  } | null>(null);
  const [payForUserId, setPayForUserId] = useState<string>("");
  const [payHourlyRate, setPayHourlyRate] = useState<string>("");
  const [payReference, setPayReference] = useState<string>("");
  const [payNotes, setPayNotes] = useState<string>("");
  const [newPayModalOpen, setNewPayModalOpen] = useState(false);
  const [rateUserId, setRateUserId] = useState<string>("");
  const [rateValue, setRateValue] = useState<string>("");
  const [rateModalOpen, setRateModalOpen] = useState(false);

  const fetchAll = useCallback(() => {
    startTransition(async () => {
      const [att, pOut, prev] = await Promise.all([
        adminListAttendance({
          from: periodStart,
          to: periodEnd,
          userId: userIdFilter || undefined,
          approvalStatus: approvalFilter.length ? approvalFilter : undefined,
          status: statusFilter.length ? statusFilter : undefined,
        }).catch((err) => {
          toast.error("Could not load attendance", { description: err instanceof Error ? err.message : undefined });
          return [];
        }),
        adminListPayouts({ from: periodStart, to: periodEnd }).catch(() => []),
        payForUserId
          ? calcPayoutPreview({ userId: payForUserId, periodStart, periodEnd }).catch(() => ({
            ok: false as const,
            error: "Preview unavailable",
          }))
          : Promise.resolve(null),
      ]);
      setAttendance(att);
      setPayouts(pOut);
      if (prev && prev.ok) setPreview({ totalMinutes: prev.totalMinutes, totalHours: prev.totalHours, hourlyRate: prev.hourlyRate, grossAmount: prev.grossAmount, sessionCount: prev.sessionCount, approvedCount: prev.approvedCount });
    });
  }, [periodStart, periodEnd, userIdFilter, approvalFilter, statusFilter, payForUserId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const toggleApprovalFilter = (s: AttendanceApprovalStatus) => {
    setApprovalFilter((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };
  const toggleStatusFilter = (s: AttendanceSession["status"]) => {
    setStatusFilter((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const openEdit = (session: AttendanceSession) => {
    const toLocal = (iso: string | null) => {
      if (!iso) return "";
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setEditAttendanceId(session.id);
    setEditValues({
      clockedInAt: toLocal(session.clockedInAt),
      clockedOutAt: toLocal(session.clockedOutAt),
      status: session.status,
      note: session.note ?? "",
      reason: "",
    });
  };

  const saveEdit = async () => {
    if (!editAttendanceId || !editValues) return;
    const iso = (s: string) => (s ? new Date(s).toISOString() : "");
    const res = await adminUpdateAttendance({
      id: editAttendanceId,
      clockedInAt: editValues.clockedInAt ? iso(editValues.clockedInAt) : undefined,
      clockedOutAt: editValues.clockedOutAt === "" ? "" : iso(editValues.clockedOutAt),
      status: editValues.status,
      note: editValues.note,
      reason: editValues.reason,
    });
    if (res.ok) {
      toast.success("Attendance updated");
      setEditAttendanceId(null);
      setEditValues(null);
      fetchAll();
    } else {
      toast.error("Update failed", { description: res.error });
    }
  };

  const setApproval = async (id: string, status: AttendanceApprovalStatus) => {
    const res = await adminSetAttendanceApproval(id, status);
    if (res.ok) {
      toast.success(status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Reset to pending");
      fetchAll();
    } else {
      toast.error("Approval failed", { description: res.error });
    }
  };

  const bulkApprove = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      toast.error("Select sessions first");
      return;
    }
    const res = await adminBulkApproveAttendance(ids);
    if (res.ok) {
      toast.success(`Approved ${res.count} session(s)`);
      setSelected(new Set());
      fetchAll();
    } else {
      toast.error("Bulk approve failed", { description: res.error });
    }
  };

  const openRate = (u: StaffRow | User | { id: string; hourlyRate: number | null; fullName: string }) => {
    setRateUserId(u.id);
    setRateValue(String(u.hourlyRate ?? ""));
    setRateModalOpen(true);
  };

  const saveRate = async () => {
    if (!rateUserId) return;
    const parsed = rateValue.trim() === "" ? null : Number(rateValue);
    if (parsed !== null && !Number.isFinite(parsed)) {
      toast.error("Invalid hourly rate");
      return;
    }
    const res = await adminSetStaffHourlyRate(rateUserId, parsed);
    if (res.ok) {
      toast.success("Hourly rate updated");
      setRateModalOpen(false);
      fetchAll();
    } else {
      toast.error("Update failed", { description: res.error });
    }
  };

  const openPayout = (userId?: string) => {
    const targetUserId = userId ?? userIdFilter;
    setPayForUserId(targetUserId);
    const staffMatch = staff.find((s) => s.id === targetUserId);
    setPayHourlyRate(String(staffMatch?.hourlyRate ?? ""));
    setPayReference("");
    setPayNotes("");
    setNewPayModalOpen(true);
  };

  useEffect(() => {
    if (!newPayModalOpen || !payForUserId) return;
    startTransition(async () => {
      const p = await calcPayoutPreview({ userId: payForUserId, periodStart, periodEnd });
      if (p.ok) setPreview({ totalMinutes: p.totalMinutes, totalHours: p.totalHours, hourlyRate: p.hourlyRate, grossAmount: p.grossAmount, sessionCount: p.sessionCount, approvedCount: p.approvedCount });
    });
  }, [payForUserId, periodStart, periodEnd, newPayModalOpen]);

  const createPayout = async () => {
    if (!payForUserId) {
      toast.error("Select a staff member");
      return;
    }
    const rate = Number(payHourlyRate);
    if (!Number.isFinite(rate) || rate < 0) {
      toast.error("Enter a valid hourly rate");
      return;
    }
    const res = await adminCreatePayout({
      userId: payForUserId,
      periodStart,
      periodEnd,
      hourlyRate: rate,
      reference: payReference || null,
      notes: payNotes || null,
    });
    if (res.ok) {
      toast.success("Payout generated");
      setNewPayModalOpen(false);
      fetchAll();
    } else {
      toast.error("Generation failed", { description: res.error });
    }
  };

  const markPayout = async (id: string, status: StaffPayout["status"]) => {
    const res = await adminSetPayoutStatus(id, status);
    if (res.ok) {
      toast.success(`Payout ${status}`);
      fetchAll();
    } else {
      toast.error("Status update failed", { description: res.error });
    }
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalSelected = selected.size;
  const rateLookup = new Map(staff.map((s) => [s.id, s]));

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border border-slate-800 bg-[#181920]/95 shadow-2xl backdrop-blur-md text-slate-100 overflow-hidden">
        <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div className="min-w-0 shrink">
            <h3 className="text-xl font-bold text-white tracking-tight">Attendance &amp; Approval</h3>
            <p className="text-xs sm:text-sm text-slate-400">Review, approve, and adjust every clock session</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto shrink-0">
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCcw className="size-4 shrink-0" />}
              onClick={fetchAll}
              disabled={isLoading}
              className="h-auto py-2 px-3 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60 justify-center whitespace-normal text-xs sm:text-sm"
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<CheckCircle2 className="size-4 shrink-0" />}
              onClick={bulkApprove}
              disabled={totalSelected === 0}
              className="h-auto py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-medium justify-center whitespace-normal text-xs sm:text-sm"
            >
              Approve {totalSelected > 0 ? `(${totalSelected})` : "selected"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<FileCheck2 className="size-4 shrink-0" />}
              onClick={() => openPayout()}
              className="h-auto py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium justify-center whitespace-normal text-xs sm:text-sm"
            >
              Generate payout
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-5">
          {/* Filter Controls Bar */}
          <div className="flex flex-col lg:grid lg:grid-cols-4 gap-4 items-start lg:items-end bg-slate-900/60 p-3 sm:p-4 rounded-xl border border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:col-span-2">
              <Field label="Period start">
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white focus:border-blue-500 [color-scheme:dark] w-full"
                />
              </Field>
              <Field label="Period end">
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white focus:border-blue-500 [color-scheme:dark] w-full"
                />
              </Field>
            </div>
            <div className="w-full lg:col-span-1">
              <Field label="Staff member">
                <Select
                  value={userIdFilter}
                  onChange={(e) => setUserIdFilter(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white focus:border-blue-500 w-full"
                >
                  <option value="">All staff</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName}{s.employeeId ? ` · ${s.employeeId}` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="w-full lg:col-span-1">
              <Field label="Filters">
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {(["pending", "approved", "rejected"] as AttendanceApprovalStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleApprovalFilter(s)}
                      className={cn(
                        "h-7 rounded-full px-2.5 text-xs font-medium border transition capitalize",
                        approvalFilter.includes(s)
                          ? "border-blue-500 bg-blue-500/20 text-blue-300 font-semibold"
                          : "border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white",
                      )}
                    >
                      {s}
                    </button>
                  ))}
                  {(["clocked_in", "clocked_out", "on_break", "auto_closed", "abandoned"] as AttendanceSession["status"][]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleStatusFilter(s)}
                      className={cn(
                        "h-7 rounded-full px-2.5 text-xs font-medium border transition capitalize",
                        statusFilter.includes(s)
                          ? "border-sky-500 bg-sky-500/20 text-sky-300 font-semibold"
                          : "border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white",
                      )}
                    >
                      {s.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </div>

          {/* Table Layout */}
          <div className="overflow-x-auto touch-scroll rounded-2xl border border-slate-800">
            <Table className="w-full min-w-[1060px] text-left">
              <THead className="bg-slate-900/90 border-b border-slate-800">
                <TR>
                  <TH className="w-12 px-4 py-3.5"></TH>
                  <TH className="w-56 min-w-[220px] px-4 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Actions</TH>
                  <TH className="w-48 px-4 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Staff</TH>
                  <TH className="w-36 px-4 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Clock-in</TH>
                  <TH className="w-36 px-4 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Clock-out</TH>
                  <TH className="w-24 px-4 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Hours</TH>
                  <TH className="w-24 px-4 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Rate</TH>
                  <TH className="w-28 px-4 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Gross</TH>
                  <TH className="w-28 px-4 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Approval</TH>
                </TR>
              </THead>
              <TBody className="divide-y divide-slate-800/60">
                {attendance.length === 0 ? (
                  <TR>
                    <TD colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                      No attendance matches these filters.
                    </TD>
                  </TR>
                ) : (
                  attendance.map((a) => {
                    const s = rateLookup.get(a.userId);
                    const displayRate = a.hourlyRate ?? s?.hourlyRate ?? null;
                    const gross =
                      a.grossPay ?? (displayRate != null && a.workMinutes != null ? Math.round((a.workMinutes / 60) * displayRate * 100) / 100 : null);
                    const checked = selected.has(a.id);
                    return (
                      <TR key={a.id} className={cn("transition-colors hover:bg-slate-800/40", checked && "bg-blue-950/20")}>
                        <TD className="w-12 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelected(a.id)}
                            className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
                            aria-label="Select session"
                          />
                        </TD>
                        <TD className="w-56 min-w-[220px] px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                            {a.approvalStatus !== "approved" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={<BadgeCheck className="size-3.5 shrink-0" />}
                                onClick={() => setApproval(a.id, "approved")}
                                className="shrink-0 h-8 py-1 px-2.5 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 border border-emerald-500/20 transition-all active:scale-95 whitespace-nowrap"
                              >
                                Approve
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={<Ban className="size-3.5 shrink-0" />}
                                onClick={() => setApproval(a.id, "pending")}
                                className="shrink-0 h-8 py-1 px-2.5 text-xs font-semibold rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 border border-amber-500/20 transition-all active:scale-95 whitespace-nowrap"
                              >
                                Reopen
                              </Button>
                            )}
                            {a.approvalStatus !== "rejected" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={<XCircle className="size-3.5 shrink-0" />}
                                onClick={() => setApproval(a.id, "rejected")}
                                className="shrink-0 h-8 py-1 px-2.5 text-xs font-semibold rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 border border-rose-500/20 transition-all active:scale-95 whitespace-nowrap"
                              >
                                Reject
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<PenLine className="size-3.5 shrink-0" />}
                              onClick={() => openEdit(a)}
                              className="shrink-0 h-8 py-1 px-2.5 text-xs font-semibold rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-all active:scale-95 whitespace-nowrap"
                            >
                              Edit
                            </Button>
                          </div>
                        </TD>
                        <TD className="w-48 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-slate-950 shadow-sm"
                              style={{ backgroundColor: a.userColor ?? s?.color ?? "#94A3B8" }}
                            >
                              {a.userFullName ? initialsFromName(a.userFullName) : "·"}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">{a.userFullName ?? s?.fullName ?? "Unknown"}</p>
                              <p className="truncate text-xs text-slate-400">
                                {a.userJobTitle ?? s?.jobTitle ?? s?.role ?? ""}
                                {a.departmentName ? ` · ${a.departmentName}` : ""}
                              </p>
                            </div>
                          </div>
                        </TD>
                        <TD className="w-36 px-4 py-3 text-sm text-slate-300 whitespace-wrap">{fmtDateTime(a.clockedInAt)}</TD>
                        <TD className="w-36 px-4 py-3 text-sm text-slate-300 whitespace-wrap">{a.clockedOutAt ? fmtDateTime(a.clockedOutAt) : "—"}</TD>
                        <TD className="w-24 px-4 py-3 text-sm font-mono text-slate-200 whitespace-nowrap">{a.workMinutes != null ? fmtHM(a.workMinutes) : a.status}</TD>
                        <TD className="w-24 px-4 py-3 text-sm text-slate-300 whitespace-wrap">{displayRate != null ? formatCurrency(displayRate) : "—"}</TD>
                        <TD className="w-28 px-4 py-3 text-sm font-semibold text-white text-right whitespace-wrap">{gross != null ? formatCurrency(gross) : "—"}</TD>
                        <TD className="w-28 px-4 py-3">
                          {a.approvalStatus === "approved" ? (
                            <span className="inline-flex items-center rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/30">Approved</span>
                          ) : a.approvalStatus === "rejected" ? (
                            <span className="inline-flex items-center rounded-md bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-400 border border-rose-500/30">Rejected</span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-400 border border-amber-500/30">Pending</span>
                          )}
                        </TD>
                      </TR>
                    );
                  })
                )}
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-slate-800 bg-[#181920]/95 shadow-2xl backdrop-blur-md text-slate-100 overflow-hidden">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">Payouts</h3>
            <p className="text-xs sm:text-sm text-slate-400">Generated payout records with full financial trail</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={<PlusCircle className="size-4" />}
              onClick={() => openPayout()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
            >
              New payout
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto touch-scroll">
            <Table className="w-full min-w-[980px] text-left">
              <THead className="bg-slate-900/90 border-b border-slate-800">
                <TR>
                  <TH className="w-48 px-4 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Staff</TH>
                  <TH className="w-40 px-4 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Period</TH>
                  <TH className="w-24 px-4 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Hours</TH>
                  <TH className="w-24 px-4 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Rate</TH>
                  <TH className="w-28 px-4 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Gross</TH>
                  <TH className="w-44 px-4 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Ref / Notes</TH>
                  <TH className="w-28 px-4 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</TH>
                  <TH className="w-48 min-w-[180px] px-4 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Actions</TH>
                </TR>
              </THead>
              <TBody className="divide-y divide-slate-800/60">
                {payouts.length === 0 ? (
                  <TR>
                    <TD colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                      No payouts generated yet for this period.
                    </TD>
                  </TR>
                ) : (
                  payouts.map((p) => (
                    <TR key={p.id} className="transition-colors hover:bg-slate-800/40">
                      <TD className="w-48 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-slate-950 shadow-sm"
                            style={{ backgroundColor: p.userColor ?? "#94A3B8" }}
                          >
                            {p.userFullName ? initialsFromName(p.userFullName) : "·"}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">{p.userFullName ?? "Unknown"}</p>
                            <p className="truncate text-xs text-slate-400">{p.userEmployeeId ?? ""}</p>
                          </div>
                        </div>
                      </TD>
                      <TD className="w-40 px-4 py-3 text-sm text-slate-300 whitespace-wrap">
                        {fmtDate(p.periodStart)} → {fmtDate(p.periodEnd)}
                      </TD>
                      <TD className="w-24 px-4 py-3 text-sm font-mono text-slate-200 whitespace-wrap">{fmtHM(p.totalMinutes)}</TD>
                      <TD className="w-24 px-4 py-3 text-sm text-slate-300 whitespace-wrap">{formatCurrency(p.hourlyRate)}</TD>
                      <TD className="w-28 px-4 py-3 text-sm font-semibold text-white text-right whitespace-wrap">{formatCurrency(p.grossAmount)}</TD>
                      <TD className="w-44 px-4 py-3 text-xs text-slate-400">
                        {p.reference ? <p className="font-semibold text-slate-200">#{p.reference}</p> : null}
                        {p.notes ? <p className="truncate max-w-[180px]">{p.notes}</p> : null}
                      </TD>
                      <TD className="w-28 px-4 py-3 whitespace-wrap">
                        {p.status === "paid" ? (
                          <span className="inline-flex items-center rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/30">Paid</span>
                        ) : p.status === "processing" ? (
                          <span className="inline-flex items-center rounded-md bg-sky-500/15 px-2.5 py-1 text-xs font-semibold text-sky-400 border border-sky-500/30">Processing</span>
                        ) : p.status === "void" ? (
                          <span className="inline-flex items-center rounded-md bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-400 border border-rose-500/30">Void</span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300 border border-slate-700">Draft</span>
                        )}
                      </TD>
                      <TD className="w-48 min-w-[180px] px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {p.status === "draft" && (
                            <Button variant="ghost" size="sm" onClick={() => markPayout(p.id, "processing")} className="text-sky-400 hover:bg-sky-500/10 hover:text-sky-300">
                              Mark processing
                            </Button>
                          )}
                          {p.status === "processing" && (
                            <Button variant="primary" size="sm" onClick={() => markPayout(p.id, "paid")} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                              Mark paid
                            </Button>
                          )}
                          {p.status !== "void" && (
                            <Button variant="ghost" size="sm" onClick={() => markPayout(p.id, "void")} className="text-rose-400 hover:bg-rose-500/10 hover:text-rose-300">
                              Void
                            </Button>
                          )}
                        </div>
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-slate-800 bg-[#181920]/95 shadow-2xl backdrop-blur-md text-slate-100 overflow-hidden">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">Hourly pay rates</h3>
            <p className="text-xs sm:text-sm text-slate-400">Set the per-hour rate used in payout calculations</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto touch-scroll">
            <Table className="w-full text-left">
              <THead className="bg-slate-900/90 border-b border-slate-800">
                <TR>
                  <TH className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Staff</TH>
                  <TH className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Role</TH>
                  <TH className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</TH>
                  <TH className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Hourly rate</TH>
                  <TH className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Action</TH>
                </TR>
              </THead>
              <TBody className="divide-y divide-slate-800/60">
                {staff.map((s) => (
                  <TR key={s.id} className="transition-colors hover:bg-slate-800/40">
                    <TD className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex size-9 items-center justify-center rounded-full text-xs font-bold text-slate-950 shadow-sm"
                          style={{ backgroundColor: s.color ?? "#94A3B8" }}
                        >
                          {initialsFromName(s.fullName)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{s.fullName}</p>
                          <p className="truncate text-xs text-slate-400">
                            {s.employeeId ? `${s.employeeId} · ` : ""}{s.jobTitle ?? s.role}
                          </p>
                        </div>
                      </div>
                    </TD>
                    <TD className="px-4 py-3 text-sm text-slate-300 capitalize">{s.role.replace("_", " ")}</TD>
                    <TD className="px-4 py-3">
                      {s.isActive ? (
                        <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">Active</span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-400 border border-slate-700">Inactive</span>
                      )}
                    </TD>
                    <TD className="px-4 py-3 text-sm font-semibold text-white text-right font-mono">
                      {s.hourlyRate != null ? formatCurrency(s.hourlyRate) : "—"}
                    </TD>
                    <TD className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Pencil className="size-4" />}
                        onClick={() => openRate(s)}
                        className="text-slate-300 hover:bg-slate-800 hover:text-white"
                      >
                        Set rate
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Modal
        open={!!editAttendanceId && !!editValues}
        onClose={() => {
          setEditAttendanceId(null);
          setEditValues(null);
        }}
        title="Edit attendance record"
        subtitle="Adjust clock times, status, or add notes. Every change is audited."
        footer={
          <>
            <Button variant="ghost" onClick={() => { setEditAttendanceId(null); setEditValues(null); }}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveEdit}>
              Save changes
            </Button>
          </>
        }
      >
        {editValues ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Clocked in">
              <Input type="datetime-local" value={editValues.clockedInAt} onChange={(e) => setEditValues({ ...editValues, clockedInAt: e.target.value })} />
            </Field>
            <Field label="Clocked out">
              <Input type="datetime-local" value={editValues.clockedOutAt} onChange={(e) => setEditValues({ ...editValues, clockedOutAt: e.target.value })} />
            </Field>
            <Field label="Status">
              <Select value={editValues.status} onChange={(e) => setEditValues({ ...editValues, status: e.target.value as AttendanceSession["status"] })}>
                {(["clocked_in", "clocked_out", "on_break", "auto_closed", "abandoned"] as AttendanceSession["status"][]).map((s) => (
                  <option key={s} value={s}>{s.replace("_", " ")}</option>
                ))}
              </Select>
            </Field>
            <Field label="Reason for edit (audited)" hint="Visible in attendance_edits audit log">
              <Input value={editValues.reason} onChange={(e) => setEditValues({ ...editValues, reason: e.target.value })} placeholder="e.g. Forgot to clock out manually" />
            </Field>
            <div className="md:col-span-2">
              <Field label="Note">
                <TextArea value={editValues.note} onChange={(e) => setEditValues({ ...editValues, note: e.target.value })} placeholder="Optional note visible on this session" />
              </Field>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={rateModalOpen}
        onClose={() => setRateModalOpen(false)}
        title="Set hourly pay rate"
        subtitle="Used for payout calculations (hours × rate). Changes apply to future approvals and payout runs."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRateModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={saveRate}>Save rate</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Staff member">
            <Select value={rateUserId} disabled>
              {staff.filter((s) => s.id === rateUserId).map((s) => (
                <option key={s.id} value={s.id}>{s.fullName}{s.employeeId ? ` · ${s.employeeId}` : ""}</option>
              ))}
            </Select>
          </Field>
          <Field label="Hourly rate (AUD)" hint="Leave blank to clear assigned rate. Two decimal places recommended.">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={rateValue}
              onChange={(e) => setRateValue(e.target.value)}
              placeholder="e.g. 28.75"
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={newPayModalOpen}
        onClose={() => setNewPayModalOpen(false)}
        title="Generate payout"
        subtitle="Calculated as: total approved minutes ÷ 60 × hourly rate"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewPayModalOpen(false)}>Cancel</Button>
            <Button variant="primary" icon={<BadgeDollarSign className="size-4" />} onClick={createPayout}>
              Create payout
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Staff member">
              <Select value={payForUserId} onChange={(e) => setPayForUserId(e.target.value)}>
                <option value="">Choose staff…</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}{s.employeeId ? ` · ${s.employeeId}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Pay period">
              <div className="flex items-center gap-2">
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                <span className="text-slate-500">→</span>
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </div>
            </Field>
            <Field label="Hourly rate (AUD)" hint="Defaults to this staff member&apos;s assigned pay rate">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={payHourlyRate}
                onChange={(e) => setPayHourlyRate(e.target.value)}
              />
            </Field>
            <Field label="Reference (optional)">
              <Input value={payReference} onChange={(e) => setPayReference(e.target.value)} placeholder="e.g. PAYRUN-042" />
            </Field>
            <div className="md:col-span-2">
              <Field label="Notes (optional)">
                <TextArea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Any notes for this payout record" />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Calculation preview</p>
            {preview ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Sessions</p>
                  <p className="text-sm font-semibold text-slate-900">{preview.sessionCount} total · {preview.approvedCount} approved</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Hours</p>
                  <p className="text-lg font-semibold text-slate-900">{preview.totalHours.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Rate</p>
                  <p className="text-lg font-semibold text-slate-900">{preview.hourlyRate != null ? formatCurrency(preview.hourlyRate) : "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Gross</p>
                  <p className="text-lg font-bold text-blue-600">{formatCurrency(preview.grossAmount)}</p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Choose a staff member to see the calculation preview.</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}