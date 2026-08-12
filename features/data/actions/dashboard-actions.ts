"use server";

import { dashboardService, rosterService, staffService, payrollService, attendanceService } from "@/features/data/services/operations-services";
import { userRepository } from "@/features/users/repositories/supabase-user-repository";
import type { AttendanceSession } from "@/types/domain";

export async function getDashboardMetricGrid() {
  return dashboardService.metricGrid();
}

export async function getLiveFloorStrip(limit = 6) {
  return dashboardService.liveFloorStrip(limit);
}

export async function getTodaysRoster() {
  return dashboardService.todaysRosterTable();
}

export async function getShiftSwaps() {
  return dashboardService.shiftSwapsPanel();
}

export async function getRosterSummaryCards() {
  return rosterService.summaryCards();
}

export async function getWeeklyRoster(weekStart?: string | null, numDays: 5 | 7 = 5) {
  return rosterService.weeklyRosterForWeek(weekStart, numDays);
}

export async function getUpcomingWeekPreview(userId: string) {
  return rosterService.upcomingWeekPreview(userId);
}

export async function getStaffDirectory() {
  return staffService.directory();
}

export async function getShiftDistribution(period: "week" | "fortnight" | "month" = "week") {
  return staffService.shiftDistribution(period);
}

export async function getPayrollOverview() {
  return payrollService.overview();
}

export async function getClockStatusCards(userId: string) {
  return attendanceService.clockStatusForUser(userId);
}

export async function getTerminalConfig(defaultCode = "TERM-8821-B") {
  return attendanceService.terminalConfig(defaultCode);
}

export async function recordClockInOut(args: {
  userId: string;
  shiftId?: string | null;
  terminalCode?: string | null;
  inLat?: number;
  inLng?: number;
}): Promise<{ session?: AttendanceSession; action: "clocked_in" | "clocked_out" | "error"; message: string }> {
  const live = await attendanceService["ops"].listLiveAttendance();
  const existing = live.find((a) => a.userId === args.userId);
  if (existing) {
    const closed = await attendanceService["ops"].recordClockOut(existing.id, args.inLat, args.inLng);
    return { session: closed, action: "clocked_out", message: `Clocked out — ${closed.userFullName ?? "Staff"}` };
  }
  const created = await attendanceService["ops"].recordClockIn(args);
  return { session: created, action: "clocked_in", message: `Clocked in — ${created.userFullName ?? "Staff"}` };
}

export async function getStaffClockView(userId: string): Promise<{
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
}> {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(today.getDate() - 13);
  const periodStart = twoWeeksAgo.toISOString().slice(0, 10);
  const periodEnd = todayStr;

  const ops = attendanceService["ops"] as typeof import("@/features/data/repositories/operations-repository").operationsRepository;
  let user: { hourlyRate: number | null } | null = null;
  try {
    user = await userRepository.findById(userId);
  } catch {
    user = null;
  }
  const history: AttendanceSession[] = await ops.listUserAttendanceForWindow(userId, periodStart, periodEnd);
  const live: AttendanceSession[] = await ops.listLiveAttendance();
  const currentSession = live.find((a) => a.userId === userId) ?? null;

  const todayAtt = history.filter((h) => h.clockedInAt.slice(0, 10) === todayStr);
  const todayMinutes = todayAtt.reduce((acc, h) => {
    if (h.workMinutes != null) return acc + h.workMinutes;
    if (h.status === "clocked_in" || h.status === "on_break") {
      const mins = Math.max(0, Math.round((Date.now() - new Date(h.clockedInAt).getTime()) / 60000));
      return acc + mins;
    }
    return acc;
  }, 0);

  const periodMinutes = history.reduce((acc, h) => {
    if (h.workMinutes != null) return acc + h.workMinutes;
    if (h.status === "clocked_in" || h.status === "on_break") {
      const mins = Math.max(0, Math.round((Date.now() - new Date(h.clockedInAt).getTime()) / 60000));
      return acc + mins;
    }
    return acc;
  }, 0);

  const hourlyRate = user?.hourlyRate ?? history[0]?.hourlyRate ?? currentSession?.hourlyRate ?? null;

  const approvedClosed = history.filter(
    (h) => h.status !== "clocked_in" && h.status !== "on_break" && h.workMinutes != null && h.approvalStatus === "approved",
  );
  const approvedMinutes = approvedClosed.reduce((acc, h) => acc + (h.workMinutes ?? 0), 0);
  const periodEarnings = hourlyRate != null ? Math.round((approvedMinutes / 60) * hourlyRate * 100) / 100 : 0;

  return {
    hourlyRate,
    history,
    currentSession,
    todayMinutes,
    periodStart,
    periodEnd,
    periodMinutes,
    periodEarnings,
    periodGrossRate: hourlyRate,
    sessionsTotal: history.length,
  };
}
