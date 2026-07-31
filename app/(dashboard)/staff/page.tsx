import { DashboardChrome } from "@/components/layout/dashboard-chrome";
import { StaffDirectoryGrid } from "@/features/employees/components/staff-directory-grid";
import { getStaffDirectory } from "@/features/data/actions/dashboard-actions";

export default async function StaffDirectoryPage() {
  const directory = await getStaffDirectory();

  return (
    <DashboardChrome title="Staff Directory" subtitle="Contact and status overview">
      <StaffDirectoryGrid staff={directory} />
    </DashboardChrome>
  );
}
