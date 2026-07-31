import { DashboardChrome } from "@/components/layout/dashboard-chrome";
import { WeeklyRosterPreview } from "@/features/roster/components/weekly-roster-preview";
import { getUpcomingWeekPreview } from "@/features/data/actions/dashboard-actions";
import { userRepository } from "@/features/users/repositories/supabase-user-repository";

export default async function StaffSchedulePage() {
  const users = await userRepository.list({ onlyActive: true, limit: 20 });
  const defaultUser =
    users.find((u) => u.role === "employee" || u.role === "supervisor") ??
    users[0] ??
    null;
  const demoUserId = defaultUser?.id ?? "";
  const previewShifts = demoUserId
    ? await getUpcomingWeekPreview(demoUserId)
    : [];

  return (
    <DashboardChrome title="My Schedule" subtitle="Your upcoming roster">
      <WeeklyRosterPreview shifts={previewShifts} />
    </DashboardChrome>
  );
}
