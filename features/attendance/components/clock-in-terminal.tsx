"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Clock8, Clock10, Delete, ShieldCheck, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { clockInWithPin } from "@/features/attendance/actions/clock-in-action";
import { cn, formatCurrency } from "@/lib/utils";
import type { User } from "@/types/user";
import type { AttendanceSession } from "@/types/domain";
import { initialsFromName } from "@/lib/user-labels";

const keypad = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export interface StaffClockView {
  hourlyRate: number | null;
  history: AttendanceSession[];
  currentSession: AttendanceSession | null;
  todayMinutes: number;
  periodStart: string;
  periodEnd: string;
  periodMinutes: number;
  periodEarnings: number;
  periodGrossRate: number | null;
  sessionsTotal: number;
}

interface ClockInTerminalProps {
  initialUserId?: string;
  view: StaffClockView;
  refresh: () => Promise<void>;
}

function fmtHM(totalMinutes: number) {
  const clamped = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

function fmtDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString([], {
      weekday: "short",
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
    return new Date(iso).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export function ClockInTerminal({ initialUserId, view, refresh }: ClockInTerminalProps) {
  const [pin, setPin] = useState("");
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<StaffClockView | null>(null);
  const [isPending, startTransition] = useTransition();
  const dots = useMemo(() => Array.from({ length: 4 }), []);

  useEffect(() => {
    if (initialUserId) {
      setActiveView(view);
    }
  }, [initialUserId, view]);

  const handleDigit = (digit: string) => {
    setPin((current) => (current.length < 4 ? `${current}${digit}` : current));
  };

  const handleBackspace = () => {
    setPin((current) => current.slice(0, -1));
  };

  const handleSubmit = () => {
    if (pin.length !== 4) {
      toast.error("Enter your 4-digit PIN", { description: "PIN is required to clock in." });
      return;
    }

    const submittedPin = pin;
    startTransition(async () => {
      const result = await clockInWithPin(submittedPin);
      if (result.success && result.user) {
        toast.success(result.message, { description: result.description });
        setActiveUser(result.user);
        setPin("");
        await refresh();
      } else {
        toast.error(result.message, { description: result.description });
      }
    });
  };

  const latestUser = activeUser;
  const rate = (latestUser?.hourlyRate ?? activeView?.hourlyRate ?? view.hourlyRate) ?? null;
  const todayMin = latestUser ? activeView?.todayMinutes ?? view.todayMinutes : view.todayMinutes;
  const todayEarnings = rate != null ? (todayMin / 60) * rate : 0;
  const currentSession = latestUser ? activeView?.currentSession ?? view.currentSession : view.currentSession;
  const history = latestUser ? (activeView?.history ?? view.history) : view.history;
  const periodMinutes = latestUser ? activeView?.periodMinutes ?? view.periodMinutes : view.periodMinutes;
  const periodEarnings = latestUser ? activeView?.periodEarnings ?? view.periodEarnings : view.periodEarnings;
  const periodStart = view.periodStart;
  const periodEnd = view.periodEnd;

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.15fr]">
      <div className="space-y-6">
        <Card className="bg-slate-950/35">
          <CardContent className="p-8">
            <div className="space-y-6">
              <div className="space-y-2 text-center">
                <p className="text-sm font-semibold text-white">Enter PIN</p>
                <p className="text-xs text-slate-400">Access your shift terminal</p>
              </div>

              <div className="flex items-center justify-center gap-3">
                {dots.map((_, index) => (
                  <span
                    key={index}
                    className={cn(
                      "size-3 rounded-full border border-white/10 transition-colors",
                      index < pin.length ? "bg-emerald-300/80" : "bg-white/5",
                    )}
                  />
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {keypad.map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleDigit(digit)}
                    disabled={isPending}
                    className="flex h-20 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-lg font-semibold text-slate-100 transition hover:bg-white/10 active:scale-[0.98] disabled:opacity-60"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleBackspace}
                  disabled={isPending}
                  className="flex h-20 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 active:scale-[0.98] disabled:opacity-60"
                >
                  <Delete className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDigit("0")}
                  disabled={isPending}
                  className="flex h-20 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-lg font-semibold text-slate-100 transition hover:bg-white/10 active:scale-[0.98] disabled:opacity-60"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isPending}
                  className="flex h-20 items-center justify-center rounded-3xl bg-emerald-400 text-slate-950 transition hover:bg-emerald-300 active:scale-[0.98] disabled:opacity-60"
                >
                  {isPending ? <Clock8 className="size-5 animate-pulse" /> : <ArrowRight className="size-5" />}
                </button>
              </div>

              {latestUser ? (
                <div className="flex items-center gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                  <div
                    className="flex size-12 items-center justify-center rounded-full text-sm font-bold text-slate-950 shadow-inner"
                    style={{ backgroundColor: latestUser.color ?? "#34D399" }}
                  >
                    {initialsFromName(latestUser)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-white">{latestUser.fullName}</p>
                      <Badge tone="emerald" size="sm">
                        {latestUser.jobTitle ?? latestUser.role}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {latestUser.employeeId ? `${latestUser.employeeId} · ` : ""}
                      {rate != null ? `Rate ${formatCurrency(rate)}/hr` : "No rate assigned"}
                    </p>
                  </div>
                  <CheckCircle2 className="size-5 text-emerald-300" />
                </div>
              ) : null}

              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500">
                <ShieldCheck className="size-4" /> Secure terminal session
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="bg-white/[0.03]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Current Status</p>
              {currentSession ? (
                <Badge tone="emerald" size="sm">
                  On Duty
                </Badge>
              ) : (
                <Badge tone="slate" size="sm">
                  Off Duty
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock10 className="size-5 text-slate-400" />
                <p className="text-sm text-slate-400">Shift Started</p>
              </div>
              <p className="text-lg font-semibold text-white">
                {currentSession ? fmtDateTime(currentSession.clockedInAt) : "—"}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white/[0.03]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Today&apos;s Earnings</p>
              <TrendingUp className="size-4 text-emerald-300" />
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-3xl font-bold text-white">{formatCurrency(todayEarnings)}</p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Hours Worked</p>
                  <p className="text-sm font-semibold text-slate-200">{fmtHM(todayMin)}</p>
                </div>
                <Badge tone="emerald" size="sm">
                  {rate != null ? `${formatCurrency(rate)}/hr` : "No rate"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white/[0.03]">
          <CardHeader className="flex flex-wrap items-center justify-between gap-3 pb-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Pay Period</p>
              <p className="text-sm text-slate-300">
                {fmtDate(periodStart)} → {fmtDate(periodEnd)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Approved Earnings</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(periodEarnings)}</p>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-2xl bg-slate-900/60 p-3">
                <dt className="text-[11px] uppercase tracking-wider text-slate-500">Hours</dt>
                <dd className="mt-1 text-lg font-semibold text-white">{fmtHM(periodMinutes)}</dd>
              </div>
              <div className="rounded-2xl bg-slate-900/60 p-3">
                <dt className="text-[11px] uppercase tracking-wider text-slate-500">Sessions</dt>
                <dd className="mt-1 text-lg font-semibold text-white">{history.length}</dd>
              </div>
              <div className="rounded-2xl bg-slate-900/60 p-3">
                <dt className="text-[11px] uppercase tracking-wider text-slate-500">Hourly Rate</dt>
                <dd className="mt-1 text-lg font-semibold text-white">
                  {rate != null ? formatCurrency(rate) : "—"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="bg-white/[0.03]">
          <CardHeader className="flex items-center justify-between pb-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Clock History</p>
              <p className="text-sm text-slate-300">Your recent clock-in / clock-out records</p>
            </div>
            <Badge tone="slate" size="sm">
              Self-only view
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-white/5">
              {history.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  No clock records for this period yet.
                </div>
              ) : (
                history.slice(0, 10).map((s) => {
                  const isOpen = !s.clockedOutAt;
                  const gross = s.workMinutes != null && rate != null ? (s.workMinutes / 60) * rate : s.grossPay ?? null;
                  return (
                    <div key={s.id} className="flex items-center gap-4 px-5 py-3">
                      <div
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-2xl",
                          isOpen ? "bg-emerald-400/15 text-emerald-300" : "bg-slate-800/60 text-slate-300",
                        )}
                      >
                        {isOpen ? <Clock8 className="size-4" /> : <CheckCircle2 className="size-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-white">{fmtDateTime(s.clockedInAt)}</p>
                          {s.approvalStatus === "approved" ? (
                            <Badge tone="emerald" size="sm">Approved</Badge>
                          ) : s.approvalStatus === "rejected" ? (
                            <Badge tone="rose" size="sm">Rejected</Badge>
                          ) : (
                            <Badge tone="slate" size="sm">Pending</Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400 truncate">
                          {s.clockedOutAt ? `Until ${fmtDateTime(s.clockedOutAt)}` : "Clocked in now"}
                          {s.workMinutes != null ? ` · ${fmtHM(s.workMinutes)}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        {gross != null ? (
                          <p className="text-sm font-semibold text-white">{formatCurrency(gross)}</p>
                        ) : (
                          <p className="text-xs text-slate-500">{isOpen ? "In progress" : "No rate"}</p>
                        )}
                        {s.departmentName ? (
                          <p className="mt-0.5 text-[11px] uppercase tracking-wider text-slate-500">
                            {s.departmentName}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
