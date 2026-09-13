"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Clock8, Clock10, Delete, Pencil, ShieldCheck, TrendingUp, X } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { clockInWithPin, logShiftManually } from "@/features/attendance/actions/clock-in-action";
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
  refresh: () => Promise<StaffClockView>;
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
    const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const weekday = DAYS[d.getDay()];
    const month = MONTHS[d.getMonth()];
    const day = d.getDate();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${weekday}, ${day} ${month} at ${hours}:${minutes}`;
  } catch {
    return iso;
  }
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = d.getDate();
    const month = MONTHS[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return iso;
  }
}

export function ClockInTerminal({ initialUserId, view, refresh }: ClockInTerminalProps) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<StaffClockView | null>(null);
  const [isPending, startTransition] = useTransition();
  const dots = useMemo(() => Array.from({ length: 4 }), []);

  // Manual entry form state
  const [manualMode, setManualMode] = useState(false);
  const [manualDate, setManualDate] = useState("");
  const [manualIn, setManualIn] = useState("");
  const [manualOut, setManualOut] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [isPendingManual, startManualTransition] = useTransition();

  // Populate date and time defaults once on client (avoids SSR mismatch)
  useEffect(() => {
    if (manualDate === "") {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      setManualDate(`${yyyy}-${mm}-${dd}`);
      if (!manualIn) setManualIn("09:00");
      if (!manualOut) setManualOut("17:00");
    }
  }, [manualDate, manualIn, manualOut]);

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
        try {
          const next = await refresh();
          if (next && typeof next === "object") setActiveView(next);
        } catch {
          /* leave current view — backend write still applied */
        }
        router.refresh();
        toast.success(result.message, { description: result.description });
        setActiveUser(result.user);
        setPin("");
      } else {
        toast.error(result.message, { description: result.description });
      }
    });
  };

  const handleManualSubmit = () => {
    if (pin.length !== 4) {
      toast.error("PIN required", { description: "Enter your 4-digit PIN before logging a manual shift." });
      return;
    }
    if (!manualIn || !manualOut) {
      toast.error("Missing times", { description: "Please enter both clock-in and clock-out times." });
      return;
    }
    startManualTransition(async () => {
      // Ensure HH:mm formatting with 2-digit padding
      const padTime = (t: string, defaultVal: string) => {
        const parts = (t || defaultVal).split(":");
        const h = (parts[0] || "00").padStart(2, "0");
        const m = (parts[1] || "00").padStart(2, "0");
        return `${h}:${m}`;
      };

      const cleanIn = padTime(manualIn, "09:00");
      const cleanOut = padTime(manualOut, "17:00");

      const inDate = new Date(`${manualDate}T${cleanIn}:00`);
      let outDate = new Date(`${manualDate}T${cleanOut}:00`);

      // If clock-out is earlier than or equal to clock-in on the same date,
      // it is an overnight shift crossing midnight into the next day.
      if (outDate <= inDate) {
        outDate = new Date(outDate.getTime() + 24 * 60 * 60 * 1000);
      }

      const inStr = inDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
      const outStr = outDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
      const dStr = inDate.toLocaleDateString("en-AU", { day: "numeric", month: "short" });

      const result = await logShiftManually({
        pin,
        clockedInAtISO: inDate.toISOString(),
        clockedOutAtISO: outDate.toISOString(),
        label: `${inStr} → ${outStr} on ${dStr}`,
        note: manualNote || undefined,
      });
      if (result.success) {
        toast.success(result.message, { description: result.description });
        try {
          const next = await refresh();
          if (next && typeof next === "object") setActiveView(next);
        } catch { /* best-effort */ }
        router.refresh();
        setManualIn("");
        setManualOut("");
        setManualNote("");
        setManualMode(false);
        setPin("");
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
    <div className="grid min-w-0 gap-6 xl:grid-cols-[0.95fr_1.15fr]">
      {/* Keypad & Terminal Container */}
      <div className="min-w-0 space-y-6">
        <Card className="rounded-3xl border-2 border-primary/80 bg-white shadow-2xl backdrop-blur-md">
          <CardContent className="min-w-0 p-4 sm:p-8">
            <div className="space-y-6">

              {/* ── Mode header ── */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-slate-900">
                    {manualMode ? "Log Shift Manually" : "Enter PIN"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {manualMode ? "Enter your PIN + shift times" : "Access your shift terminal"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setManualMode((v) => !v)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition cursor-pointer",
                    manualMode
                      ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                      : "border-primary bg-primary text-white ",
                  )}
                >
                  {manualMode ? <><X className="size-3" /> Cancel</> : <><Pencil className="size-3" /> Log Manually</>}
                </button>
              </div>

              {/* ── PIN dots ── */}
              <div className="flex items-center justify-center gap-3">
                {dots.map((_, index) => (
                  <span
                    key={index}
                    className={cn(
                      "size-3 rounded-full border transition-colors",
                      index < pin.length
                        ? "border-blue-500 bg-blue-500 shadow-md shadow-blue-500/50"
                        : "border-slate-700 bg-slate-900",
                    )}
                  />
                ))}
              </div>

              {manualMode ? (
                /* ── Manual entry form ── */
                <div className="space-y-4">
                  {/* PIN keypad (compact) */}
                  <div className="grid grid-cols-3 gap-2">
                    {keypad.map((digit) => (
                      <button
                        key={digit}
                        type="button"
                        onClick={() => handleDigit(digit)}
                        disabled={isPendingManual}
                        className="flex h-14 items-center justify-center rounded-2xl border border-primary/80 bg-slate-900/80 text-base font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                      >
                        {digit}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={handleBackspace}
                      disabled={isPendingManual}
                      className="flex h-14 items-center justify-center rounded-2xl border border-primary/80 bg-slate-900/80 text-slate-400 hover:text-white transition hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                    >
                      <Delete className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDigit("0")}
                      disabled={isPendingManual}
                      className="flex h-14 items-center justify-center rounded-2xl border border-primary/80 bg-slate-900/80 text-base font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                    >
                      0
                    </button>
                    <div />
                  </div>

                  {/* Shift date/time fields */}
                  <div className="rounded-2xl border border-primary/80 bg-slate-900/60 p-4 space-y-3 text-black bg-white">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">Date</label>
                      <input
                        type="date"
                        value={manualDate}
                        max={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setManualDate(e.target.value)}
                        disabled={isPendingManual}
                        className="w-full rounded-xl border border-primary/80 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 disabled:opacity-60 [color-scheme:dark] cursor-pointer"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3" >
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">
                          Clock In <span className="text-slate-500 font-normal lowercase">(24h - HH:mm)</span>
                        </label>
                        <div className="flex items-center gap-1.5 rounded-xl border border-primary/80 bg-slate-900 px-3 py-2 text-sm text-white focus-within:border-blue-500">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={2}
                            placeholder="09"
                            value={manualIn ? manualIn.split(":")[0] : ""}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "");
                              if (val === "") {
                                const min = manualIn ? manualIn.split(":")[1] || "00" : "00";
                                setManualIn(`:${min}`);
                                return;
                              }
                              const num = parseInt(val, 10);
                              if (num >= 0 && num <= 23) {
                                const min = manualIn ? manualIn.split(":")[1] || "00" : "00";
                                setManualIn(`${val}:${min}`);
                              }
                            }}
                            onBlur={() => {
                              const parts = (manualIn || "").split(":");
                              const h = parts[0] ? parts[0].padStart(2, "0") : "09";
                              const m = parts[1] ? parts[1].padStart(2, "0") : "00";
                              setManualIn(`${h}:${m}`);
                            }}
                            disabled={isPendingManual}
                            className="w-8 bg-transparent text-center font-mono font-medium outline-none placeholder:text-slate-600 disabled:opacity-60"
                          />
                          <span className="text-slate-700 font-bold">:</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={2}
                            placeholder="00"
                            value={manualIn && manualIn.includes(":") ? manualIn.split(":")[1] : ""}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "");
                              if (val === "") {
                                const hr = manualIn ? manualIn.split(":")[0] || "09" : "09";
                                setManualIn(`${hr}:`);
                                return;
                              }
                              const num = parseInt(val, 10);
                              if (num >= 0 && num <= 59) {
                                const hr = manualIn ? manualIn.split(":")[0] || "09" : "09";
                                setManualIn(`${hr}:${val}`);
                              }
                            }}
                            onBlur={() => {
                              const parts = (manualIn || "").split(":");
                              const h = parts[0] ? parts[0].padStart(2, "0") : "09";
                              const m = parts[1] ? parts[1].padStart(2, "0") : "00";
                              setManualIn(`${h}:${m}`);
                            }}
                            disabled={isPendingManual}
                            className="w-8 bg-transparent text-center font-mono font-medium outline-none placeholder:text-slate-700 disabled:opacity-60"
                          />
                          <span className="ml-auto text-[10px] font-semibold uppercase text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">24H</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">
                          Clock Out <span className="text-slate-500 font-normal lowercase">(24h - HH:mm)</span>
                        </label>
                        <div className="flex items-center gap-1.5 rounded-xl border border-primary/80 bg-slate-900 px-3 py-2 text-sm text-white focus-within:border-blue-500">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={2}
                            placeholder="17"
                            value={manualOut ? manualOut.split(":")[0] : ""}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "");
                              if (val === "") {
                                const min = manualOut ? manualOut.split(":")[1] || "00" : "00";
                                setManualOut(`:${min}`);
                                return;
                              }
                              const num = parseInt(val, 10);
                              if (num >= 0 && num <= 23) {
                                const min = manualOut ? manualOut.split(":")[1] || "00" : "00";
                                setManualOut(`${val}:${min}`);
                              }
                            }}
                            onBlur={() => {
                              const parts = (manualOut || "").split(":");
                              const h = parts[0] ? parts[0].padStart(2, "0") : "17";
                              const m = parts[1] ? parts[1].padStart(2, "0") : "00";
                              setManualOut(`${h}:${m}`);
                            }}
                            disabled={isPendingManual}
                            className="w-8 bg-transparent text-center font-mono font-medium outline-none placeholder:text-slate-600 disabled:opacity-60"
                          />
                          <span className="text-slate-500 font-bold">:</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={2}
                            placeholder="00"
                            value={manualOut && manualOut.includes(":") ? manualOut.split(":")[1] : ""}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "");
                              if (val === "") {
                                const hr = manualOut ? manualOut.split(":")[0] || "17" : "17";
                                setManualOut(`${hr}:`);
                                return;
                              }
                              const num = parseInt(val, 10);
                              if (num >= 0 && num <= 59) {
                                const hr = manualOut ? manualOut.split(":")[0] || "17" : "17";
                                setManualOut(`${hr}:${val}`);
                              }
                            }}
                            onBlur={() => {
                              const parts = (manualOut || "").split(":");
                              const h = parts[0] ? parts[0].padStart(2, "0") : "17";
                              const m = parts[1] ? parts[1].padStart(2, "0") : "00";
                              setManualOut(`${h}:${m}`);
                            }}
                            disabled={isPendingManual}
                            className="w-8 bg-transparent text-center font-mono font-medium outline-none placeholder:text-slate-600 disabled:opacity-60"
                          />
                          <span className="ml-auto text-[10px] font-semibold uppercase text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">24H</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Note <span className="normal-case text-slate-500">(optional)</span></label>
                      <input
                        type="text"
                        value={manualNote}
                        maxLength={200}
                        placeholder="e.g. forgot to clock in"
                        onChange={(e) => setManualNote(e.target.value)}
                        disabled={isPendingManual}
                        className="w-full rounded-xl border border-primary/80 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500 disabled:opacity-60"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleManualSubmit}
                    disabled={isPendingManual || pin.length !== 4 || !manualIn || !manualOut}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-[0.98] disabled:opacity-50"
                  >
                    {isPendingManual ? (
                      <Clock8 className="size-4 animate-pulse" />
                    ) : (
                      <><CheckCircle2 className="size-4" /> Save Shift</>
                    )}
                  </button>
                  <p className="text-center text-[11px] text-slate-500">
                    Submitted shifts go to <span className="font-medium text-slate-300">Pending</span> review
                  </p>
                </div>
              ) : (
                /* ── Standard PIN keypad ── */
                <div className="grid grid-cols-3 gap-3">
                  {keypad.map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleDigit(digit)}
                      disabled={isPending}
                      className="flex h-14 sm:h-18 items-center justify-center rounded-2xl sm:rounded-3xl border border-primary/80 bg-slate-900/80 text-base sm:text-lg font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleBackspace}
                    disabled={isPending}
                    className="flex h-14 sm:h-18 items-center justify-center rounded-2xl sm:rounded-3xl border border-primary/80 bg-slate-900/80 text-slate-400 hover:text-white transition hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60"
                  >
                    <Delete className="size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDigit("0")}
                    disabled={isPending}
                    className="flex h-14 sm:h-18 items-center justify-center rounded-2xl sm:rounded-3xl border border-primary/80 bg-slate-900/80 text-base sm:text-lg font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isPending}
                    className="flex h-14 sm:h-18 items-center justify-center rounded-2xl sm:rounded-3xl bg-blue-600 text-white transition hover:bg-blue-500 active:scale-[0.98] disabled:opacity-60 shadow-lg shadow-blue-600/30"
                  >
                    {isPending ? <Clock8 className="size-5 animate-pulse" /> : <ArrowRight className="size-5" />}
                  </button>
                </div>
              )}

              {latestUser ? (
                <div className="flex items-center gap-4 rounded-2xl border border-blue-500/30 bg-blue-500/30 p-4">
                  <div
                    className="flex size-18 items-center justify-center rounded-full text-center text-xl font-bold text-slate-950 shadow-inner"
                    style={{ backgroundColor: latestUser.color ?? "#343cd3ff" }}
                  >
                    {/* {initialsFromName(latestUser)} */}
                    {latestUser.employeeId}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {/* <p className="truncate text-sm font-semibold text-white">{latestUser.fullName}</p> */}
                      <Badge tone="rose" size="sm">
                        {latestUser.jobTitle ?? latestUser.role}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {latestUser.employeeId ? `${latestUser.employeeId} · ` : ""}
                      {/* {rate != null ? `Rate ${formatCurrency(rate)}/hr` : "No rate assigned"} */}
                    </p>
                  </div>
                  <CheckCircle2 className="size-15 text-blue-400" />
                </div>
              ) : null}

              <div className="flex items-center justify-center gap-2 text-[11px] font-medium text-slate-500">
                <ShieldCheck className="size-4 text-slate-400" /> Secure terminal session
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats & History Container */}
      <div className="min-w-0 space-y-6">
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          {/* Current Status */}
          <Card className="rounded-3xl border border-primary/80 bg-white shadow-2xl backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-primary/80/60">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Current Status</p>
              {currentSession ? (
                <Badge tone="emerald" size="sm">
                  On Duty
                </Badge>
              ) : (
                <Badge tone="neutral" size="sm" className="bg-red-500/30 text-red-500/90 border border-red-500/60">
                  Off Duty
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <p className="text-sm font-medium text-slate-300">
                {`${fmtDate(periodStart)} → ${fmtDate(periodEnd)}`}
              </p>
              <div className="flex items-center gap-2">
                <Clock10 className="size-5 text-slate-400" />
                <p className="text-lg font-semibold text-slate-400">Shift Started</p>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-600 font-medium">Hours Worked</p>
                  <p className="text-sm font-semibold text-slate-600">{fmtHM(todayMin)}</p>
                </div>
              </div>
              <p className="text-lg text-center text-slate-600 font-semibold">
                {currentSession ? fmtDateTime(currentSession.clockedInAt) : "—"}
              </p>
            </CardContent>
          </Card>

          {/* Today's Earnings
          <Card className="rounded-3xl border border-primary/80  bg-white shadow-2xl backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-primary/80/60">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Today&apos;s Earnings</p>
              <TrendingUp className="size-4 text-blue-400" />
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <p className="text-3xl font-bold text-slate-600">{formatCurrency(todayEarnings)}</p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-600 font-medium">Hours Worked</p>
                  <p className="text-sm font-semibold text-slate-600">{fmtHM(todayMin)}</p>
                </div>
                <Badge tone="emerald" size="sm">
                {rate != null ? `${formatCurrency(rate)}/hr` : "No rate"}
                </Badge>
              </div>
            </CardContent>
          </Card>*/}
        </div>
        {/* Pay Period Summary */}
        {/* <Card className="rounded-3xl border border-primary/80  bg-white shadow-2xl backdrop-blur-md">
          <CardHeader className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-primary/80/60">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Pay Period</p>
              <p className="text-sm font-medium text-slate-300">
                {`${fmtDate(periodStart)} → ${fmtDate(periodEnd)}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Approved Earnings</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(periodEarnings)}</p>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <dl className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-2xl border border-primary/80 bg-slate-900/60 p-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Hours</dt>
                <dd className="mt-1 text-lg font-bold text-white">{fmtHM(periodMinutes)}</dd>
              </div>
              <div className="rounded-2xl border border-primary/80 bg-slate-900/60 p-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Sessions</dt>
                <dd className="mt-1 text-lg font-bold text-white">{history.length}</dd>
              </div>
              <div className="rounded-2xl border border-primary/80 bg-slate-900/60 p-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Hourly Rate</dt>
                <dd className="mt-1 text-lg font-bold">
                  {rate != null ? formatCurrency(rate) : "—"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card> */}

        {/* Clock ristory */}
        <Card className="rounded-3xl border border-primary/80  bg-white shadow-2xl backdrop-blur-md">
          <CardHeader className="flex items-center justify-between pb-2 border-b border-primary/80/60">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Clock History</p>
              <p className="text-sm font-medium text-slate-300">Your recent clock-in / clock-out records</p>
            </div>
            <Badge tone="neutral" size="sm" className="bg-slate-800 text-slate-400 border border-slate-700">
              Self-only view
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-800/60">
              {history.length === 0 ? (
                <div className="p-6 text-center text-sm font-medium text-slate-500">
                  No clock records for this period yet.
                </div>
              ) : (
                history.slice(0, 10).map((s) => {
                  const isOpen = !s.clockedOutAt;
                  const gross = s.workMinutes != null && rate != null ? (s.workMinutes / 60) * rate : s.grossPay ?? null;
                  return (
                    <div key={s.id} className="flex items-center gap-4 px-5 py-3 transition hover:bg-slate-900/40">
                      <div
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-2xl border",
                          isOpen
                            ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                            : "border-primary/80 bg-slate-900 text-slate-400",
                        )}
                      >
                        {isOpen ? <Clock8 className="size-4" /> : <CheckCircle2 className="size-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-600">{fmtDateTime(s.clockedInAt)}</p>
                          {s.approvalStatus === "approved" ? (
                            <Badge tone="emerald" size="sm">Approved</Badge>
                          ) : s.approvalStatus === "rejected" ? (
                            <Badge tone="rose" size="sm">Rejected</Badge>
                          ) : (
                            <Badge tone="amber" size="sm">Pending</Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs font-medium text-slate-400 truncate">
                          {s.clockedOutAt ? `Until ${fmtDateTime(s.clockedOutAt)}` : "Clocked in now"}
                          {s.workMinutes != null ? ` · ${fmtHM(s.workMinutes)}` : ""}
                        </p>
                      </div>
                      {/* <div className="text-right">
                        {gross != null ? (
                          <p className="text-sm font-bold text-slate-600">{formatCurrency(gross)}</p>
                        ) : (
                          <p className="text-xs font-medium text-slate-500">{isOpen ? "In progress" : "No rate"}</p>
                        )}
                        {s.departmentName ? (
                          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            {s.departmentName}
                          </p>
                        ) : null}
                      </div> */}
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