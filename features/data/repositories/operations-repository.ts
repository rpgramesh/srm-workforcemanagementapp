/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  Department,
  Location,
  Shift,
  RosterPeriod,
  AttendanceSession,
  ShiftSwapRequest,
  PayrollPeriod,
  Terminal,
} from "@/types/domain";
import { sb, parseDateOnly, parseTimeOnly } from "@/features/data/supabase-utils";
import type { AppRole } from "@/types/app";

interface DepartmentRow {
  id: string;
  code: string;
  name: string;
  short_label: string;
  accent_class: string;
  sort_order: number;
  is_active: boolean;
}
interface LocationRow {
  id: string; code: string; name: string; sort_order: number; is_active: boolean;
}
interface ShiftRow extends Record<string, any> {
  id: string;
  roster_period_id: string | null;
  user_id: string;
  department_id: string;
  location_id: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  status: Shift["status"];
  station_label: string | null;
  hourly_rate: string | number | null;
  department_name?: string | null;
  department_short?: string | null;
  department_accent?: string | null;
  location_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  employee_id?: string | null;
  color?: string | null;
  job_title?: string | null;
  avatar_url?: string | null;
}
interface RosterPeriodRow {
  id: string; week_start: string; week_end: string; status: RosterPeriod["status"];
  budget_amount: string | number | null; published_at: string | null;
}
interface AttendanceRow extends Record<string, any> {
  id: string; user_id: string; shift_id: string | null; terminal_id: string | null;
  clocked_in_at: string; clocked_out_at: string | null;
  status: AttendanceSession["status"]; work_minutes: number | null;
  gross_pay: string | number | null;
  in_gps_lat: number | null; in_gps_lng: number | null;
  out_gps_lat: number | null; out_gps_lng: number | null;
  full_name?: string | null; job_title?: string | null; color?: string | null;
  department_name?: string | null; location_name?: string | null;
  seconds_on_shift?: number | null;
}
interface SwapRow extends Record<string, any> {
  id: string; requester_user_id: string; shift_id: string; offered_to_user_id: string | null;
  status: ShiftSwapRequest["status"]; reason: string | null;
  reviewer_user_id: string | null; reviewed_at: string | null; submitted_at: string;
  requester_name?: string | null; offered_name?: string | null;
  shift_date?: string | null; start_time?: string | null; end_time?: string | null; station_label?: string | null;
}
interface PayrollRow {
  id: string; period_start: string; period_end: string; status: PayrollPeriod["status"];
  total_hours: string | number | null; total_gross: string | number | null;
  overtime_cost: string | number | null;
}
interface TerminalRow {
  id: string; terminal_code: string; display_name: string | null; location_id: string | null;
  sync_status: Terminal["syncStatus"]; last_sync_at: string | null; is_active: boolean;
}

const mapDepartment = (r: DepartmentRow): Department => ({
  id: r.id,
  code: r.code,
  name: r.name,
  shortLabel: r.short_label,
  accentClass: r.accent_class,
  sortOrder: r.sort_order,
  isActive: r.is_active,
});

const mapLocation = (r: LocationRow): Location => ({
  id: r.id, code: r.code, name: r.name, sortOrder: r.sort_order, isActive: r.is_active,
});

const float = (v: string | number | null): number | null => {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

const mapShift = (r: ShiftRow): Shift => ({
  id: r.id,
  rosterPeriodId: r.roster_period_id,
  userId: r.user_id,
  departmentId: r.department_id,
  locationId: r.location_id,
  shiftDate: parseDateOnly(r.shift_date)!,
  startTime: parseTimeOnly(r.start_time)!,
  endTime: parseTimeOnly(r.end_time)!,
  breakMinutes: Number(r.break_minutes ?? 0),
  status: r.status,
  stationLabel: r.station_label ?? null,
  hourlyRate: float(r.hourly_rate),
  departmentName: r.department_name ?? null,
  departmentShort: r.department_short ?? null,
  departmentAccent: r.department_accent ?? null,
  locationName: r.location_name ?? null,
  userFirstName: r.first_name ?? null,
  userLastName: r.last_name ?? null,
  userFullName:
    r.first_name || r.last_name
      ? [r.first_name, r.last_name].filter(Boolean).join(" ").trim()
      : null,
  userEmployeeId: r.employee_id ?? null,
  userColor: r.color ?? null,
  userJobTitle: r.job_title ?? null,
  userAvatarUrl: r.avatar_url ?? null,
});

const mapRosterPeriod = (r: RosterPeriodRow): RosterPeriod => ({
  id: r.id,
  weekStart: parseDateOnly(r.week_start)!,
  weekEnd: parseDateOnly(r.week_end)!,
  status: r.status,
  budgetAmount: float(r.budget_amount),
  publishedAt: r.published_at ?? null,
});

const mapAttendance = (r: AttendanceRow): AttendanceSession => ({
  id: r.id,
  userId: r.user_id,
  shiftId: r.shift_id,
  terminalId: r.terminal_id ?? null,
  clockedInAt: r.clocked_in_at,
  clockedOutAt: r.clocked_out_at ?? null,
  status: r.status,
  workMinutes: r.work_minutes ?? null,
  grossPay: float(r.gross_pay),
  inLat: r.in_gps_lat ?? null,
  inLng: r.in_gps_lng ?? null,
  outLat: r.out_gps_lat ?? null,
  outLng: r.out_gps_lng ?? null,
  userFullName: r.full_name ?? null,
  userJobTitle: r.job_title ?? null,
  userColor: r.color ?? null,
  departmentName: r.department_name ?? null,
  locationName: r.location_name ?? null,
  secondsOnShift: r.seconds_on_shift ?? null,
});

const mapSwap = (r: SwapRow): ShiftSwapRequest => ({
  id: r.id,
  requesterUserId: r.requester_user_id,
  shiftId: r.shift_id,
  offeredToUserId: r.offered_to_user_id ?? null,
  status: r.status,
  reason: r.reason ?? null,
  reviewerUserId: r.reviewer_user_id ?? null,
  reviewedAt: r.reviewed_at ?? null,
  submittedAt: r.submitted_at,
  requesterFullName: r.requester_name ?? null,
  offeredToFullName: r.offered_name ?? null,
  shiftDate: parseDateOnly(r.shift_date),
  shiftStart: parseTimeOnly(r.start_time),
  shiftEnd: parseTimeOnly(r.end_time),
  stationLabel: r.station_label ?? null,
});

const mapPayroll = (r: PayrollRow): PayrollPeriod => ({
  id: r.id,
  periodStart: parseDateOnly(r.period_start)!,
  periodEnd: parseDateOnly(r.period_end)!,
  status: r.status,
  totalHours: float(r.total_hours),
  totalGross: float(r.total_gross),
  overtimeCost: float(r.overtime_cost),
});

const mapTerminal = (r: TerminalRow): Terminal => ({
  id: r.id,
  terminalCode: r.terminal_code,
  displayName: r.display_name,
  locationId: r.location_id,
  syncStatus: r.sync_status,
  lastSyncAt: r.last_sync_at,
  isActive: r.is_active,
});

export class OperationsRepository {
  async listDepartments(onlyActive = true) {
    let q = sb().from("departments").select("*");
    if (onlyActive) q = q.eq("is_active", true);
    const { data, error } = await q.order("sort_order");
    if (error) throw error;
    return (data as DepartmentRow[]).map(mapDepartment);
  }

  async listLocations(onlyActive = true) {
    let q = sb().from("locations").select("*");
    if (onlyActive) q = q.eq("is_active", true);
    const { data, error } = await q.order("sort_order");
    if (error) throw error;
    return (data as LocationRow[]).map(mapLocation);
  }

  async getCurrentRosterPeriod() {
    const { data, error } = await sb()
      .from("roster_periods")
      .select("*")
      .lte("week_start", new Date().toISOString().slice(0, 10))
      .gte("week_end", new Date().toISOString().slice(0, 10))
      .maybeSingle();
    if (error) throw error;
    return data ? mapRosterPeriod(data as RosterPeriodRow) : null;
  }

  async listShifts(params: {
    from?: string;
    to?: string;
    userId?: string;
    periodId?: string;
    withUserJoins?: boolean;
    onlyActiveUsers?: boolean;
  }) {
    let q: any = sb()
      .from("shifts")
      .select(
        params.withUserJoins
          ? `
          *,
          department_name:departments(name),
          department_short:departments(short_label),
          department_accent:departments(accent_class),
          location_name:locations(name),
          first_name:users(first_name),
          last_name:users(last_name),
          employee_id:users(employee_id),
          color:users(color),
          job_title:users(job_title),
          avatar_url:users(avatar_url)
        `
          : "*",
      );

    if (params.from) q = q.gte("shift_date", params.from);
    if (params.to) q = q.lte("shift_date", params.to);
    if (params.userId) q = q.eq("user_id", params.userId);
    if (params.periodId) q = q.eq("roster_period_id", params.periodId);
    if (params.onlyActiveUsers) {
      q = q.eq("users.is_active", true);
    }
    q = q.order("shift_date").order("start_time");

    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []).map((r: any) => {
      const row: ShiftRow = {
        ...r,
        department_name: typeof r.department_name === "object" ? (r.department_name as any)?.name ?? null : r.department_name,
        department_short: typeof r.department_short === "object" ? (r.department_short as any)?.short_label ?? null : r.department_short,
        department_accent: typeof r.department_accent === "object" ? (r.department_accent as any)?.accent_class ?? null : r.department_accent,
        location_name: typeof r.location_name === "object" ? (r.location_name as any)?.name ?? null : r.location_name,
        first_name: typeof r.first_name === "object" ? (r.first_name as any)?.first_name ?? null : r.first_name,
        last_name: typeof r.last_name === "object" ? (r.last_name as any)?.last_name ?? null : r.last_name,
        employee_id: typeof r.employee_id === "object" ? (r.employee_id as any)?.employee_id ?? null : r.employee_id,
        color: typeof r.color === "object" ? (r.color as any)?.color ?? null : r.color,
        job_title: typeof r.job_title === "object" ? (r.job_title as any)?.job_title ?? null : r.job_title,
        avatar_url: typeof r.avatar_url === "object" ? (r.avatar_url as any)?.avatar_url ?? null : r.avatar_url,
      };
      return mapShift(row);
    });
    return rows;
  }

  async listLiveAttendance() {
    const { data, error } = await sb()
      .from("v_live_floor")
      .select("*")
      .order("clocked_in_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r: any) => mapAttendance(r as AttendanceRow));
  }

  async listTodaysRosterWithStatus() {
    const { data: shifts } = await sb()
      .from("v_today_active_shifts")
      .select("*")
      .order("start_time");
    const { data: attendance } = await sb()
      .from("v_live_floor")
      .select("user_id, shift_id, clocked_in_at, attendance_status, seconds_on_shift, in_gps_lat, in_gps_lng");

    const rows: any[] = (shifts ?? []) as any[];
    const attendMap = new Map<string, any>();
    for (const a of attendance ?? []) attendMap.set(a.user_id, a);

    const result: Shift[] = [];
    for (const s of rows) {
      result.push(
        mapShift({
          ...s,
          id: s.shift_id,
          first_name: s.first_name,
          last_name: s.last_name,
          user_id: (s as any).user_id,
          department_name: s.department_name,
          department_short: s.department_short,
          department_accent: s.department_accent,
          location_name: s.location_name,
          employee_id: s.employee_id,
          color: s.user_color,
          job_title: s.job_title,
          avatar_url: s.avatar_url,
          break_minutes: s.break_minutes ?? 0,
          status: s.shift_status ?? "scheduled",
        }),
      );
    }
    return { shifts: result, liveUserIds: new Set(attendMap.keys()) };
  }

  async listShiftSwapRequests(limit = 20) {
    const { data, error } = await sb()
      .from("shift_swap_requests")
      .select(
        `
        *,
        requester_name:users!shift_swap_requests_requester_user_id_fkey(first_name,last_name),
        offered_name:users!shift_swap_requests_offered_to_user_id_fkey(first_name,last_name),
        shift_date:shifts(shift_date),
        start_time:shifts(start_time),
        end_time:shifts(end_time),
        station_label:shifts(station_label)
      `,
      )
      .order("submitted_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((r: any) => {
      const row: SwapRow = {
        ...r,
        requester_name:
          typeof r.requester_name === "object"
            ? [r.requester_name?.first_name, r.requester_name?.last_name].filter(Boolean).join(" ")
            : r.requester_name,
        offered_name:
          typeof r.offered_name === "object"
            ? [r.offered_name?.first_name, r.offered_name?.last_name].filter(Boolean).join(" ")
            : r.offered_name,
        shift_date: typeof r.shift_date === "object" ? (r.shift_date as any)?.shift_date ?? null : r.shift_date,
        start_time: typeof r.start_time === "object" ? (r.start_time as any)?.start_time ?? null : r.start_time,
        end_time: typeof r.end_time === "object" ? (r.end_time as any)?.end_time ?? null : r.end_time,
        station_label: typeof r.station_label === "object" ? (r.station_label as any)?.station_label ?? null : r.station_label,
      };
      return mapSwap(row);
    });
  }

  async getCurrentPayrollPeriod() {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await sb()
      .from("payroll_periods")
      .select("*")
      .lte("period_start", today)
      .gte("period_end", today)
      .maybeSingle();
    if (error) throw error;
    return data ? mapPayroll(data as PayrollRow) : null;
  }

  async getTerminalByCode(code: string) {
    const { data, error } = await sb()
      .from("terminals")
      .select("*")
      .eq("terminal_code", code)
      .maybeSingle();
    if (error) throw error;
    return data ? mapTerminal(data as TerminalRow) : null;
  }

  async listTerminals(onlyActive = true) {
    let q = sb().from("terminals").select("*");
    if (onlyActive) q = q.eq("is_active", true);
    const { data, error } = await q.order("terminal_code");
    if (error) throw error;
    return (data as TerminalRow[]).map(mapTerminal);
  }

  async recordClockIn(
    args: { userId: string; shiftId?: string | null; terminalCode?: string | null; inLat?: number; inLng?: number },
  ): Promise<AttendanceSession> {
    const { data, error } = await sb()
      .from("attendance_sessions")
      .insert({
        user_id: args.userId,
        shift_id: args.shiftId ?? null,
        terminal_id: args.terminalCode ?? null,
        in_gps_lat: args.inLat ?? null,
        in_gps_lng: args.inLng ?? null,
        status: "clocked_in",
      })
      .select()
      .single();
    if (error) throw error;
    return mapAttendance(data as AttendanceRow);
  }

  async recordClockOut(sessionId: string, outLat?: number, outLng?: number): Promise<AttendanceSession> {
    const { data, error } = await sb()
      .from("attendance_sessions")
      .update({
        clocked_out_at: new Date().toISOString(),
        out_gps_lat: outLat ?? null,
        out_gps_lng: outLng ?? null,
        status: "clocked_out",
      })
      .eq("id", sessionId)
      .select()
      .single();
    if (error) throw error;
    return mapAttendance(data as AttendanceRow);
  }

  async listUserAttendanceForWindow(userId: string, from: string, to: string) {
    const { data, error } = await sb()
      .from("attendance_sessions")
      .select("*")
      .eq("user_id", userId)
      .gte("clocked_in_at", `${from}T00:00:00.000Z`)
      .lte("clocked_in_at", `${to}T23:59:59.999Z`)
      .order("clocked_in_at", { ascending: false });
    if (error) throw error;
    return (data as AttendanceRow[]).map(mapAttendance);
  }

  async getUsers(roles?: AppRole[], onlyActive = true) {
    let q: any = sb()
      .from("users")
      .select("*");
    if (roles && roles.length > 0) q = q.in("role", roles);
    if (onlyActive) q = q.eq("is_active", true);
    const { data, error } = await q.order("last_name").order("first_name");
    if (error) throw error;
    return data;
  }
}

export const operationsRepository = new OperationsRepository();
