"use server";

import { userService } from "@/features/users/services/user-service";
import type { ClockInResult } from "@/features/users/services/user-service";
import { operationsRepository } from "@/features/data/repositories/operations-repository";
import { userRepository } from "@/features/users/repositories/supabase-user-repository";
import type { AttendanceSession } from "@/types/domain";

export async function clockInWithPin(pin: string): Promise<ClockInResult> {
  return userService.clockInWithPin(pin);
}

export interface ManualShiftResult {
  success: boolean;
  message: string;
  description?: string;
  session?: AttendanceSession;
}

export async function logShiftManually(args: {
  pin: string;
  /** UTC ISO string built by the browser — e.g. new Date("2026-08-25T09:00:00").toISOString() */
  clockedInAtISO: string;
  /** UTC ISO string built by the browser */
  clockedOutAtISO: string;
  /** Human-readable label for success toast, e.g. "09:00 → 17:00 on 25 Aug" */
  label: string;
  note?: string;
}): Promise<ManualShiftResult> {
  const { pin, clockedInAtISO, clockedOutAtISO, label, note } = args;

  // --- Validate PIN format ---
  if (!/^\d{4}$/.test(pin)) {
    return { success: false, message: "Invalid PIN", description: "PIN must be exactly 4 digits." };
  }

  // --- Validate the ISO strings the browser sent ---
  const clockedInAt = new Date(clockedInAtISO);
  const clockedOutAt = new Date(clockedOutAtISO);
  const now = new Date();

  if (isNaN(clockedInAt.getTime()) || isNaN(clockedOutAt.getTime())) {
    return { success: false, message: "Invalid date or time", description: "Could not parse the provided date/time values." };
  }
  if (clockedInAt >= clockedOutAt) {
    return { success: false, message: "Invalid time range", description: "Clock-out time must be after clock-in time." };
  }
  const spanMs = clockedOutAt.getTime() - clockedInAt.getTime();
  if (spanMs > 24 * 60 * 60 * 1000) {
    return { success: false, message: "Shift too long", description: "A single shift cannot exceed 24 hours." };
  }
  // Allow up to 5 minutes in the future to account for clock skew
  if (clockedInAt.getTime() > now.getTime() + 5 * 60 * 1000) {
    return { success: false, message: "Future times not allowed", description: "Clock-in time cannot be in the future." };
  }
  if (clockedOutAt.getTime() > now.getTime() + 5 * 60 * 1000) {
    return { success: false, message: "Future times not allowed", description: "Clock-out time cannot be in the future." };
  }
  if (note && note.length > 500) {
    return { success: false, message: "Note too long", description: "Note must be 500 characters or fewer." };
  }

  // --- Verify PIN (lookup only — does not toggle the live clock) ---
  let userId: string | null = null;
  let userName: string | null = null;
  try {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const user = await userRepository.verifyByClockInPin(pin);
    if (!user) {
      return {
        success: false,
        message: "PIN not recognised",
        description: "No active staff member matched that PIN. Try again.",
      };
    }
    if (!UUID_RE.test(user.id)) {
      return {
        success: false,
        message: "Demo account",
        description: "Manual entries cannot be saved for demo/env accounts.",
      };
    }
    userId = user.id;
    userName = user.fullName;
  } catch (err) {
    return {
      success: false,
      message: "PIN verification failed",
      description: err instanceof Error ? err.message : "Unable to verify PIN.",
    };
  }

  // --- Write the backdated session ---
  try {
    const session = await operationsRepository.recordClockIn({
      userId,
      clockedInAt: clockedInAt.toISOString(),
    });
    const closed = await operationsRepository.recordClockOut(
      session.id,
      undefined,
      undefined,
      clockedOutAt.toISOString(),
    );
    // Persist note if provided
    if (note?.trim()) {
      try {
        await operationsRepository.updateAttendance(session.id, { note: note.trim() });
      } catch {
        // Note is best-effort; never block core update
      }
    }
    return {
      success: true,
      message: `Shift logged — ${userName}`,
      description: `${label} saved as pending review.`,
      session: closed,
    };
  } catch (err) {
    return {
      success: false,
      message: "Could not save shift",
      description: err instanceof Error ? err.message : "An error occurred writing the attendance record.",
    };
  }
}
