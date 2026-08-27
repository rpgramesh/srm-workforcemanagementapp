import { normalizeAustralianMobile } from "@/features/auth/services/au-mobile";
import { userRepository } from "@/features/users/repositories/supabase-user-repository";
import { operationsRepository } from "@/features/data/repositories/operations-repository";
import { adminCredentials, userCredentials } from "@/lib/auth-config";
import type { VerifiedUser, User, UserPagination } from "@/types/user";
import { defaultDashboardRouteForRole } from "@/types/user";
import type { AppRole } from "@/types/app";
import type { AttendanceSession, ClockInResult as DomainClockInResult } from "@/types/domain";

export interface LoginAttempt {
  mobile: string;
  pin: string;
}

export interface AdminLoginResult {
  success: boolean;
  message: string;
  description?: string;
  verified?: VerifiedUser;
  redirectTo?: string;
  role?: AppRole | null;
}

export interface ClockInResult {
  success: boolean;
  message: string;
  description?: string;
  user?: User;
  session?: AttendanceSession;
  action?: "clocked_in" | "clocked_out";
  hourlyRate?: number | null;
  currentPeriodEarnings?: number | null;
}

export type TerminalClockResult = DomainClockInResult & {
  action?: "clocked_in" | "clocked_out";
  hourlyRate?: number | null;
  currentPeriodEarnings?: number | null;
};

export class UserService {
  constructor(private readonly repo = userRepository) { }

  async adminLogin({ mobile, pin }: LoginAttempt): Promise<AdminLoginResult> {
    const normalized = normalizeAustralianMobile(mobile);

    if (!normalized) {
      return {
        success: false,
        message: "Invalid mobile format",
        description: "Please enter a valid Australian mobile number.",
      };
    }

    if (!/^\d{4}$/.test(pin)) {
      return {
        success: false,
        message: "Incorrect PIN format",
        description: "PIN must be exactly 4 digits.",
      };
    }

    if (adminCredentials && normalized === adminCredentials.normalizedMobile) {
      if (pin === adminCredentials.pin) {
        const envUser: User = {
          id: "env-super-admin",
          firstName: "Super",
          lastName: "Admin",
          fullName: "Super Admin",
          mobile: normalized,
          role: "super_admin",
          employeeId: null,
          jobTitle: "System Owner",
          hourlyRate: null,
          avatarUrl: null,
          color: "#2563EB",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          email: null,
          departmentId: null,
          employmentDate: null,
          address: null,
          emergencyContactName: null,
          emergencyContactPhone: null,
          notes: null,
          permissions: {},
        };
        return {
          success: true,
          message: "Signed in successfully",
          description: `Welcome back, ${envUser.fullName}.`,
          verified: { user: envUser, source: "env_admin" },
          redirectTo: defaultDashboardRouteForRole(envUser.role),
          role: envUser.role,
        };
      }
      return {
        success: false,
        message: "Incorrect PIN",
        description: "The security PIN you entered does not match our records.",
      };
    }

    if (userCredentials && normalized === userCredentials.normalizedMobile) {
      if (pin === userCredentials.pin) {
        const envStaff: User = {
          id: "env-staff-user",
          firstName: "Demo",
          lastName: "Staff",
          fullName: "Demo Staff",
          mobile: normalized,
          role: "employee",
          employeeId: null,
          jobTitle: "Team Member",
          hourlyRate: null,
          avatarUrl: null,
          color: "#0EA5E9",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          email: null,
          departmentId: null,
          employmentDate: null,
          address: null,
          emergencyContactName: null,
          emergencyContactPhone: null,
          notes: null,
          permissions: {},
        };
        return {
          success: true,
          message: "Signed in successfully",
          description: `Welcome back, ${envStaff.fullName}. Use the Clock-In terminal to start your shift.`,
          verified: { user: envStaff, source: "env_staff" },
          redirectTo: defaultDashboardRouteForRole(envStaff.role),
          role: envStaff.role,
        };
      }
      return {
        success: false,
        message: "Incorrect PIN",
        description: "The security PIN you entered does not match our records.",
      };
    }

    let verified: User | null = null;
    try {
      verified = await this.repo.verifyByMobileAndPin(normalized, pin);
    } catch (err) {
      return {
        success: false,
        message: "Sign in failed",
        description:
          err instanceof Error ? err.message : "Unable to reach the authentication service.",
      };
    }

    if (!verified) {
      return {
        success: false,
        message: "Access denied",
        description:
          "Mobile and PIN do not match any active staff account.",
      };
    }

    return {
      success: true,
      message: "Signed in successfully",
      description: `Welcome back, ${verified.fullName}.`,
      verified: { user: verified, source: "supabase" },
      redirectTo: defaultDashboardRouteForRole(verified.role),
      role: verified.role,
    };
  }

  async clockInWithPin(pin: string): Promise<ClockInResult> {
    if (!/^\d{4}$/.test(pin)) {
      return {
        success: false,
        message: "Enter your 4-digit PIN",
        description: "PIN must be exactly 4 digits to clock in.",
      };
    }

    const tryToggle = async (user: User): Promise<ClockInResult> => {
      const ops = operationsRepository;
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      const weeklyStart = new Date();
      weeklyStart.setDate(weeklyStart.getDate() - 13);
      const weeklyStartStr = weeklyStart.toISOString().slice(0, 10);
      const weeklyEndStr = new Date().toISOString().slice(0, 10);

      try {
        const live = await ops.listLiveAttendance();
        const existing = (Array.isArray(live) ? live : []).find(
          (a: AttendanceSession) => a.userId === user.id,
        );
        let session: AttendanceSession | undefined;
        let action: "clocked_in" | "clocked_out";
        if (existing) {
          session = await ops.recordClockOut(existing.id);
          action = "clocked_out";
        } else {
          session = await ops.recordClockIn({ userId: user.id });
          action = "clocked_in";
        }

        let currentPeriodEarnings: number | null = null;
        try {
          const preview = await ops.calcPeriodPayoutPreview(user.id, weeklyStartStr, weeklyEndStr);
          currentPeriodEarnings = preview?.grossAmount ?? 0;
        } catch {
          currentPeriodEarnings = null;
        }

        return {
          success: true,
          message:
            action === "clocked_in"
              ? `Clocked in — ${user.fullName}`
              : `Clocked out — ${user.fullName}`,
          description: `${user.jobTitle ?? "Staff"} · ${new Date().toLocaleTimeString("en-AU", {
            hour: "2-digit",
            minute: "2-digit",
          })}`,
          user,
          session,
          action,
          hourlyRate: user.hourlyRate ?? null,
          currentPeriodEarnings,
        };
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : err && typeof err === "object" && typeof (err as Record<string, unknown>).message === "string"
              ? (err as Record<string, unknown>).message as string
              : "Unable to record clock action.";
        if (msg.includes("real staff user")) {
          return {
            success: true,
            message: `PIN recognised — ${user.fullName}`,
            description: `${user.jobTitle ?? "Staff"} · Demo mode — no clock record written (sign in as a seeded staff member to write records).`,
            user,
            action: undefined,
            hourlyRate: user.hourlyRate ?? null,
            currentPeriodEarnings: null,
          };
        }
        return {
          success: false,
          message: "Clock action failed",
          description: msg,
          user,
          hourlyRate: user.hourlyRate ?? null,
        };
      }
    };

    let user: User | null = null;
    let verifyError: ClockInResult | null = null;
    try {
      user = await this.repo.verifyByClockInPin(pin);
    } catch (err) {
      verifyError = {
        success: false,
        message: "Clock-in failed",
        description:
          err instanceof Error
            ? err.message
            : err && typeof err === "object" && typeof (err as Record<string, unknown>).message === "string"
              ? (err as Record<string, unknown>).message as string
              : "Unable to reach the clock-in service.",
      };
    }

    if (user) {
      return tryToggle(user);
    }

    if (verifyError) {
      return verifyError;
    }

    if (userCredentials && pin === userCredentials.pin) {
      const envUser: User = {
        id: "env-staff-user",
        firstName: "Anmol",
        lastName: "",
        fullName: "Anmol",
        mobile: userCredentials.normalizedMobile,
        role: "employee",
        employeeId: "EMP-1004",
        jobTitle: "Senior Waiter",
        hourlyRate: 28.75,
        avatarUrl: null,
        color: "#FBBF24",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        email: null,
        departmentId: null,
        employmentDate: null,
        address: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        notes: null,
        permissions: {},
      };
      return tryToggle(envUser);
    }

    if (adminCredentials && pin === adminCredentials.pin) {
      const envUser: User = {
        id: "env-super-admin",
        firstName: "Super",
        lastName: "Admin",
        fullName: "Super Admin",
        mobile: adminCredentials.normalizedMobile,
        role: "super_admin",
        employeeId: null,
        jobTitle: "System Owner",
        hourlyRate: null,
        avatarUrl: null,
        color: "#2563EB",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        email: null,
        departmentId: null,
        employmentDate: null,
        address: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        notes: null,
        permissions: {},
      };
      return tryToggle(envUser);
    }

    if (!user) {
      return {
        success: false,
        message: "PIN not recognised",
        description: "No active staff member matched that PIN. Try again.",
      };
    }

    return tryToggle(user);
  }

  listUsers(params?: UserPagination) {
    return this.repo.list(params);
  }

  countUsers(params?: Omit<UserPagination, "limit" | "offset">) {
    return this.repo.count(params);
  }

  getUser(id: string) {
    return this.repo.findById(id);
  }

  getUserByMobile(mobile: string) {
    return this.repo.findByMobile(mobile);
  }

  getUsersByRole(...roles: AppRole[]) {
    return this.repo.list({ roles, onlyActive: true });
  }
}

export const userService = new UserService();
