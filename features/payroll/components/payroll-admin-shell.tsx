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

  const summary = useMemo(() => {
    const closed = attendance.filter(
      (a) => a.status !== "clocked_in" && a.status !== "on_break" && a.workMinutes != null,
    );
    const totalMinutes = closed.reduce((acc, a) => acc + (a.workMinutes ?? 0), 0);
    const approved = closed.filter((a) => a.approvalStatus === "approved");
    const approvedMinutes = approved.reduce((acc, a) => acc + (a.workMinutes ?? 0), 0);
    const pendingCount = attendance.filter((a) => a.approvalStatus === "pending").length;
    const approvedGross = approved.reduce((acc, a) => {
      if (a.grossPay != null) return acc + a.grossPay;
      if (a.hourlyRate != null && a.workMinutes != null) {
        return acc + (a.workMinutes / 60) * a.hourlyRate;
      }
      return acc;
    }, 0);
    const payoutGross = payouts.reduce((acc, p) => (p.status !== "void" ? acc + p.grossAmount : acc), 0);
    return { totalMinutes, approvedMinutes, pendingCount, approvedGross, payoutGross };
  }, [attendance, payouts]);

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
