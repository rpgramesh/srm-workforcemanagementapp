"use server";

import { userService } from "@/features/users/services/user-service";
import type { ClockInResult } from "@/features/users/services/user-service";

export async function clockInWithPin(pin: string): Promise<ClockInResult> {
  return userService.clockInWithPin(pin);
}
