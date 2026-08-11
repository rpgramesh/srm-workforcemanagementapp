import { redirect } from "next/navigation";
import { DashboardChrome } from "@/components/layout/dashboard-chrome";
import { StaffDirectoryGrid } from "@/features/employees/components/staff-directory-grid";
import { getStaffDirectory } from "@/features/data/actions/dashboard-actions";
import { getCurrentActor } from "@/lib/server-session";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function StaffDirectoryPage() {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  const directory = await getStaffDirectory();

  return (
    <DashboardChrome title="Staff Directory" subtitle="Contact and status overview" actor={actor}>
      <StaffDirectoryGrid staff={directory} />
    </DashboardChrome>
  );
}
