import { redirect } from "next/navigation";
import { DashboardChrome } from "@/components/layout/dashboard-chrome";
import { PayrollAdminShell, type StaffRow } from "@/features/payroll/components/payroll-admin-shell";
import { currentActorInfo } from "@/features/auth/actions/login-action";
import { listStaff } from "@/features/users/actions/staff-actions";
import { canManagePayroll } from "@/types/user";
import type { AppRole } from "@/types/app";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function AdminPayrollPage() {
  const actor = await currentActorInfo();
  if (!actor) redirect("/login");
  if (!canManagePayroll(actor.role as AppRole)) redirect("/clock-in");

  const { rows } = await listStaff({ limit: 500, sortBy: "name", sortDir: "asc" });
  const slim: StaffRow[] = rows.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    employeeId: u.employeeId,
    role: String(u.role),
    jobTitle: u.jobTitle,
    hourlyRate: u.hourlyRate,
    isActive: u.isActive,
    color: u.color,
  }));

  return (
    <DashboardChrome title="Payroll & Payouts" subtitle="Approve hours, set pay rates, and track payouts" actor={actor}>
      <PayrollAdminShell staff={slim} />
    </DashboardChrome>
  );
}
