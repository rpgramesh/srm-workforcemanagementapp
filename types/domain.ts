export type BadgeVariant = "emerald" | "slate" | "amber" | "rose" | "sky";

export type RosterStatus =
  | "clocked_in"
  | "clocked_out"
  | "on_break"
  | "upcoming"
  | "late"
  | "absent";

export type StaffStatus =
  | "clocked_in"
  | "off_duty"
  | "on_leave"
  | "overtime_risk"
  | "absent";

export type SwapStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "completed"
  | "withdrawn";

export type ShiftStatus = "scheduled" | "cancelled" | "completed" | "open" | "swapped";

export interface Department {
  id: string;
  code: string;
  name: string;
  shortLabel: string;
  accentClass: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Location {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Shift {
  id: string;
  rosterPeriodId: string | null;
  userId: string;
  departmentId: string;
  locationId: string | null;
  shiftDate: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  status: ShiftStatus;
  stationLabel: string | null;
  hourlyRate: number | null;
  departmentName: string | null;
  departmentShort: string | null;
  departmentAccent: string | null;
  locationName: string | null;
  userFirstName: string | null;
  userLastName: string | null;
  userFullName: string | null;
  userEmployeeId: string | null;
  userColor: string | null;
  userJobTitle: string | null;
  userAvatarUrl: string | null;
}

export interface RosterPeriod {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: "draft" | "published" | "locked" | "archived";
  budgetAmount: number | null;
  publishedAt: string | null;
}

export type AttendanceApprovalStatus = "pending" | "approved" | "rejected";

export interface AttendanceSession {
  id: string;
  userId: string;
  shiftId: string | null;
  terminalId: string | null;
  clockedInAt: string;
  clockedOutAt: string | null;
  status: "clocked_in" | "clocked_out" | "on_break" | "auto_closed" | "abandoned";
  workMinutes: number | null;
  grossPay: number | null;
  inLat: number | null;
  inLng: number | null;
  outLat: number | null;
  outLng: number | null;
  userFullName: string | null;
  userJobTitle: string | null;
  userColor: string | null;
  departmentName: string | null;
  locationName: string | null;
  secondsOnShift: number | null;
  approvalStatus: AttendanceApprovalStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  note: string | null;
  hourlyRate: number | null;
}

export interface ShiftSwapRequest {
  id: string;
  requesterUserId: string;
  shiftId: string;
  offeredToUserId: string | null;
  status: SwapStatus;
  reason: string | null;
  reviewerUserId: string | null;
  reviewedAt: string | null;
  submittedAt: string;
  requesterFullName: string | null;
  offeredToFullName: string | null;
  shiftDate: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  stationLabel: string | null;
}

export interface PayrollPeriod {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: "open" | "processing" | "closed";
  totalHours: number | null;
  totalGross: number | null;
  overtimeCost: number | null;
}

export interface Terminal {
  id: string;
  terminalCode: string;
  displayName: string | null;
  locationId: string | null;
  syncStatus: "active" | "connecting" | "offline";
  lastSyncAt: string | null;
  isActive: boolean;
}

export type MetricAccent = "emerald" | "sky" | "rose" | "amber" | "slate";

export interface DashboardMetric {
  id: string;
  label: string;
  value: string | number;
  suffix?: string;
  hint?: string;
  accent: MetricAccent;
  progressPercent?: number;
}

export interface LiveFloorMember {
  userId: string;
  fullName: string;
  role: string;
  department?: string;
  durationMinutes: number;
  avatarUrl?: string | null;
  color?: string | null;
}

export interface TodaysRosterRow {
  shiftId: string;
  userId: string;
  fullName: string;
  initials: string;
  role: string;
  shiftStart: string;
  shiftEnd: string;
  status: RosterStatus;
  statusVariant: BadgeVariant;
  avatarUrl?: string | null;
  color?: string | null;
}

export interface StaffDirectoryCard {
  userId: string;
  fullName: string;
  role: string;
  status: StaffStatus;
  statusVariant: BadgeVariant;
  weeklyHours: number;
  nextShiftStart: string | null;
  nextShiftLabel: string | null;
  avatarUrl?: string | null;
  color?: string | null;
  department?: string | null;
}

export interface DepartmentShiftShare {
  departmentId: string;
  departmentName: string;
  percentage: number;
  barColorClass: string;
}

export interface ShiftDistribution {
  distribution: DepartmentShiftShare[];
  aiSuggestion: { id: string; text: string; severity: "info" | "warning" | "critical" } | null;
  period: "week" | "fortnight" | "month";
}

export interface ShiftSlot {
  shiftId: string | null;
  startTime: string | null;
  endTime: string | null;
  isOff: boolean;
}

export interface RosterEmployeeRow {
  userId: string;
  fullName: string;
  department: string;
  badgeLabel: string;
  shiftsPerDay: ShiftSlot[];
  highlightDayIndex?: number;
  avatarUrl?: string | null;
  color?: string | null;
}

export interface WeeklyRosterData {
  weekStart: string;
  weekEnd: string;
  numDays: 5 | 7;
  employees: RosterEmployeeRow[];
  dayHeaders: Array<{ weekDay: string; dayNum: number; isoDate: string }>;
  totalHours: number;
  laborCost: number;
  staffClockedIn: number;
  staffTotal: number;
  openShifts: number;
  budgetAmount: number | null;
}

export interface UpcomingShiftPreview {
  shiftId: string;
  isoDate: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  station: string | null;
  isActiveNow: boolean;
  state: "emerald" | "slate" | "amber" | "rose";
}

export interface ClockStatusCardsData {
  shiftStatus: "on_shift" | "off_shift" | "on_break";
  shiftStartTime: string | null;
  todayEarnings: number;
  hoursWorkedMinutes: number;
  earningsDeltaPercent: number;
  currencyCode: string;
  nextShiftStart: string | null;
  weeklyHours: number;
  weeklyBudgetHours: number;
}

export interface PayrollOverviewData {
  period: PayrollPeriod;
  totalGross: number;
  totalHours: number;
  overtimeCost: number;
  currencyCode: string;
}

export interface ClockInResult {
  success: boolean;
  message: string;
  description?: string;
  session?: AttendanceSession;
  user?: import("./user").User | null;
}

export type StaffPayoutStatus = "draft" | "processing" | "paid" | "void";

export interface StaffPayout {
  id: string;
  payrollPeriodId: string | null;
  userId: string;
  periodStart: string;
  periodEnd: string;
  totalMinutes: number;
  totalHours: number;
  hourlyRate: number;
  grossAmount: number;
  status: StaffPayoutStatus;
  paidAt: string | null;
  paidBy: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  userFullName: string | null;
  userEmployeeId: string | null;
  userColor: string | null;
}

export interface PayoutPreview {
  totalMinutes: number;
  totalHours: number;
  hourlyRate: number | null;
  grossAmount: number;
  sessionCount: number;
  approvedCount: number;
}

