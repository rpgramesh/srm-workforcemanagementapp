"use server";

import { dashboardService, rosterService, staffService, payrollService, attendanceService } from "@/features/data/services/operations-services";
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
