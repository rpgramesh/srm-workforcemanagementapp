"use server";

import { z } from "zod";
import { getCurrentActor } from "@/lib/server-session";
import { canManagePayroll, canManageStaff } from "@/types/user";
import type { AppRole } from "@/types/app";
import { userRepository } from "@/features/users/repositories/supabase-user-repository";
import { operationsRepository } from "@/features/data/repositories/operations-repository";
import type { AttendanceApprovalStatus, AttendanceSession, PayoutPreview, StaffPayout } from "@/types/domain";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function ensureActor() {
  return getCurrentActor();
}

function isUuid(id: string) {
  return UUID_RE.test(id);
}

type ListAttendanceParams = Parameters<typeof operationsRepository.listAllAttendance>[0];

export async function adminListAttendance(params: {
  from?: string; to?: string; userId?: string;
  approvalStatus?: AttendanceApprovalStatus[];
  status?: AttendanceSession["status"][];
} = {}): Promise<AttendanceSession[]> {
  const actor = await ensureActor();
  if (!actor) throw new Error("Authentication required");
  if (!canManageStaff(actor.role as AppRole) && !canManagePayroll(actor.role as AppRole)) {
    throw new Error("Not authorised to review attendance");
  }
  return operationsRepository.listAllAttendance(params as ListAttendanceParams);
}

const attendanceEditSchema = z.object({
  id: z.string().regex(UUID_RE, "Invalid session id"),
  clockedInAt: z.string().datetime({ offset: true }).optional(),
  clockedOutAt: z.string().datetime({ offset: true }).optional().or(z.literal("")),
  status: z.enum(["clocked_in","clocked_out","on_break","auto_closed","abandoned"]).optional(),
  note: z.string().max(500).optional().nullable(),
  reason: z.string().max(500).optional(),
});

export async function adminUpdateAttendance(raw: unknown) {
  const actor = await ensureActor();
  if (!actor) return { ok: false as const, error: "Authentication required" };
  if (!canManageStaff(actor.role as AppRole) && !canManagePayroll(actor.role as AppRole)) {
    return { ok: false as const, error: "Not authorised to edit attendance" };
  }
  const parsed = attendanceEditSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues.map(i => i.message).join("; ") };
  }
  const payload = parsed.data;
  try {
    const patch: Partial<{ clockedInAt: string; clockedOutAt: string | null; status: AttendanceSession["status"]; note: string | null }> = { status: payload.status };
    if (payload.clockedInAt) patch.clockedInAt = payload.clockedInAt;
    if (payload.clockedOutAt !== undefined) patch.clockedOutAt = payload.clockedOutAt || null;
    if (payload.note !== undefined) patch.note = payload.note ?? null;
    const updated = await operationsRepository.updateAttendance(
      payload.id,
      patch,
      isUuid(actor.userId) ? actor.userId : undefined,
      payload.reason,
    );
    return { ok: true as const, session: updated };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Update failed" };
  }
}

export async function adminSetAttendanceApproval(
  id: string,
  status: AttendanceApprovalStatus,
) {
  const actor = await ensureActor();
  if (!actor) return { ok: false as const, error: "Authentication required" };
  if (!canManagePayroll(actor.role as AppRole) && !canManageStaff(actor.role as AppRole)) {
    return { ok: false as const, error: "Not authorised" };
  }
  if (!UUID_RE.test(id)) return { ok: false as const, error: "Invalid id" };
  if (!["pending","approved","rejected"].includes(status)) return { ok: false as const, error: "Invalid status" };
  try {
    const updated = await operationsRepository.setAttendanceApproval(id, status, actor.userId);
    return { ok: true as const, session: updated };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Approval failed" };
  }
}

export async function adminBulkApproveAttendance(ids: string[]) {
  const actor = await ensureActor();
  if (!actor) return { ok: false as const, error: "Authentication required" };
  if (!canManagePayroll(actor.role as AppRole) && !canManageStaff(actor.role as AppRole)) {
    return { ok: false as const, error: "Not authorised" };
  }
  const validIds = ids.filter((i) => UUID_RE.test(i));
  if (validIds.length === 0) return { ok: false as const, error: "No valid session IDs provided" };
  try {
    const count = await operationsRepository.bulkApproveAttendance(validIds, actor.userId);
    return { ok: true as const, count };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Bulk approve failed" };
  }
}

export async function adminSetStaffHourlyRate(userId: string, hourlyRate: number | null) {
  const actor = await ensureActor();
  if (!actor) return { ok: false as const, error: "Authentication required" };
  if (!canManageStaff(actor.role as AppRole)) return { ok: false as const, error: "Not authorised" };
  if (!UUID_RE.test(userId)) return { ok: false as const, error: "Invalid user id" };
  const existing = await userRepository.findById(userId);
  if (!existing) return { ok: false as const, error: "Staff not found" };
  if (hourlyRate != null) {
    if (!Number.isFinite(hourlyRate)) return { ok: false as const, error: "Invalid hourly rate" };
    if (hourlyRate < 0) return { ok: false as const, error: "Hourly rate cannot be negative" };
    if (hourlyRate > 10000) return { ok: false as const, error: "Hourly rate too high" };
  }
  try {
    const rounded = hourlyRate == null ? null : Math.round(hourlyRate * 100) / 100;
    const updated = await userRepository.update({ id: userId, hourlyRate: rounded });
    return { ok: true as const, user: updated };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Update failed" };
  }
}

const periodSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  userId: z.string().regex(UUID_RE, "Invalid user id"),
});

export async function calcPayoutPreview(args: unknown): Promise<PayoutPreview & { ok: true } | { ok: false; error: string }> {
  const parsed = periodSchema.safeParse(args);
  if (!parsed.success) {
    return { ok: false, error: "Invalid date range / user" };
  }
  const actor = await ensureActor();
  if (!actor) return { ok: false, error: "Authentication required" };
  const selfAccess = isUuid(actor.userId) && actor.userId === parsed.data.userId;
  const adminAccess = canManagePayroll(actor.role as AppRole) || canManageStaff(actor.role as AppRole);
  if (!selfAccess && !adminAccess) {
    return { ok: false, error: "Not authorised" };
  }
  if (parsed.data.periodStart > parsed.data.periodEnd) {
    return { ok: false, error: "Start date must be before end date" };
  }
  const preview = await operationsRepository.calcPeriodPayoutPreview(
    parsed.data.userId,
    parsed.data.periodStart,
    parsed.data.periodEnd,
  );
  return { ok: true, ...preview };
}

const createPayoutSchema = periodSchema.extend({
  hourlyRate: z.number().min(0).max(10000),
  reference: z.string().max(64).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export async function adminCreatePayout(raw: unknown) {
  const actor = await ensureActor();
  if (!actor) return { ok: false as const, error: "Authentication required" };
  if (!canManagePayroll(actor.role as AppRole)) return { ok: false as const, error: "Not authorised" };
  const parsed = createPayoutSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues.map(i => i.message).join("; ") };
  }
  try {
    const user = await userRepository.findById(parsed.data.userId);
    if (!user) return { ok: false as const, error: "Staff not found" };
    const rate = Math.round(parsed.data.hourlyRate * 100) / 100;
    await operationsRepository.createPayout({
      userId: parsed.data.userId,
      periodStart: parsed.data.periodStart,
      periodEnd: parsed.data.periodEnd,
      hourlyRate: rate,
      reference: parsed.data.reference ?? null,
      notes: parsed.data.notes ?? null,
    });
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Payout creation failed" };
  }
}

export async function adminListPayouts(params: { from?: string; to?: string; userId?: string; status?: string[] } = {}): Promise<StaffPayout[]> {
  const actor = await ensureActor();
  if (!actor) throw new Error("Authentication required");
  const adminAccess = canManagePayroll(actor.role as AppRole) || canManageStaff(actor.role as AppRole);
  if (!adminAccess) {
    if (!isUuid(actor.userId)) return [];
    return operationsRepository.listPayouts({ userId: actor.userId });
  }
  return operationsRepository.listPayouts(params);
}

export async function myPayoutHistory(): Promise<StaffPayout[]> {
  const actor = await ensureActor();
  if (!actor) return [];
  if (!isUuid(actor.userId)) return [];
  return operationsRepository.listPayouts({ userId: actor.userId });
}

export async function adminSetPayoutStatus(id: string, status: StaffPayout["status"]) {
  const actor = await ensureActor();
  if (!actor) return { ok: false as const, error: "Authentication required" };
  if (!canManagePayroll(actor.role as AppRole)) return { ok: false as const, error: "Not authorised" };
  if (!UUID_RE.test(id)) return { ok: false as const, error: "Invalid payout id" };
  if (!["draft","processing","paid","void"].includes(status)) return { ok: false as const, error: "Invalid status" };
  try {
    await operationsRepository.setPayoutStatus(
      id,
      status,
      isUuid(actor.userId) ? actor.userId : undefined,
    );
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Status update failed" };
  }
}
