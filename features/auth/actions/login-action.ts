"use server";

import { userService } from "@/features/users/services/user-service";
import type { AdminLoginResult } from "@/features/users/services/user-service";
import { setActorSession, clearActorSession, getCurrentActor } from "@/lib/server-session";
import { canAccessAdminDashboard } from "@/types/user";

export async function adminLogin(
  mobile: string,
  pin: string,
): Promise<AdminLoginResult> {
  const r = await userService.adminLogin({ mobile, pin });
  if (r.success && r.verified) {
    await setActorSession({
      userId: r.verified.user.id,
      role: r.verified.user.role,
      fullName: r.verified.user.fullName,
    });
  }
  return r;
}

export async function currentActorInfo() {
  const a = await getCurrentActor();
  if (!a) return null;
  if (!canAccessAdminDashboard(a.role)) return null;
  return a;
}

export async function logout(): Promise<void> {
  await clearActorSession();
}
