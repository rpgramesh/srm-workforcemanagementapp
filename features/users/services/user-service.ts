import { normalizeAustralianMobile } from "@/features/auth/services/au-mobile";
import { userRepository } from "@/features/users/repositories/supabase-user-repository";
import { adminCredentials, userCredentials } from "@/lib/auth-config";
import type { VerifiedUser, User, UserPagination } from "@/types/user";
import { canAccessAdminDashboard } from "@/types/user";
import type { AppRole } from "@/types/app";

export interface LoginAttempt {
  mobile: string;
  pin: string;
}

export interface AdminLoginResult {
  success: boolean;
  message: string;
  description?: string;
  verified?: VerifiedUser;
}

export interface ClockInResult {
  success: boolean;
  message: string;
  description?: string;
  user?: User;
}

export class UserService {
  constructor(private readonly repo = userRepository) {}

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
          color: "#10B981",
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
        return {
          success: false,
          message: "Dashboard access denied",
          description:
            "This account is a staff (Employee) account. Please use the Clock-In terminal at /clock-in to start your shift, or contact your manager for dashboard access.",
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
          "Mobile and PIN do not match any active administrator account.",
      };
    }

    if (!canAccessAdminDashboard(verified.role)) {
      return {
        success: false,
        message: "Dashboard access denied",
        description:
          "Your role does not have permission to access the admin dashboard. Use the Clock-In terminal instead.",
      };
    }

    return {
      success: true,
      message: "Signed in successfully",
      description: `Welcome back, ${verified.fullName}.`,
      verified: { user: verified, source: "supabase" },
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
      return {
        success: true,
        message: `Clocked in — ${envUser.fullName}`,
        description: envUser.jobTitle
          ? `${envUser.jobTitle} · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
          : `Successfully clocked in at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        user: envUser,
      };
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
        color: "#10B981",
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
        message: `Clocked in — ${envUser.fullName}`,
        description: `Successfully clocked in at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        user: envUser,
      };
    }

    let user: User | null = null;
    try {
      user = await this.repo.verifyByClockInPin(pin);
    } catch (err) {
      return {
        success: false,
        message: "Clock-in failed",
        description:
          err instanceof Error ? err.message : "Unable to reach the clock-in service.",
      };
    }

    if (!user) {
      return {
        success: false,
        message: "PIN not recognised",
        description: "No active staff member matched that PIN. Try again.",
      };
    }

    return {
      success: true,
      message: `Clocked in — ${user.fullName}`,
      description: user.jobTitle
        ? `${user.jobTitle} · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : `Successfully clocked in at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      user,
    };
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
