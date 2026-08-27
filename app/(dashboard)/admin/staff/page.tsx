import { redirect } from "next/navigation";
import { DashboardChrome } from "@/components/layout/dashboard-chrome";
import { StaffManagementShell } from "@/features/users/components/staff-management-shell";
import { currentActorInfo, dashboardRouteForActor } from "@/features/auth/actions/login-action";
import { isAdminDashboardRole } from "@/types/user";

export const dynamic = "force-dynamic";

export default async function AdminStaffPage() {
  const actor = await currentActorInfo();
  if (!actor) redirect("/login");
  if (!isAdminDashboardRole(actor.role)) redirect(await dashboardRouteForActor(actor.role));

  return (
    <DashboardChrome title="Staff" subtitle="Directory, roles, permissions & messaging" actor={actor}>
      <StaffManagementShell viewerRole={actor.role} />
    </DashboardChrome>
  );
}
