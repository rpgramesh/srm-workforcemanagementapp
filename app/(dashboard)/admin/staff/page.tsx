import { redirect } from "next/navigation";
import { DashboardChrome } from "@/components/layout/dashboard-chrome";
import { StaffManagementShell } from "@/features/users/components/staff-management-shell";
import { currentActorInfo } from "@/features/auth/actions/login-action";

export const dynamic = "force-dynamic";

export default async function AdminStaffPage() {
  const actor = await currentActorInfo();
  if (!actor) redirect("/login");

  return (
    <DashboardChrome title="Staff" subtitle="Directory, roles, permissions & messaging">
      <StaffManagementShell viewerRole={actor.role} />
    </DashboardChrome>
  );
}
