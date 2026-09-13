import { redirect } from "next/navigation";
import { DashboardChrome } from "@/components/layout/dashboard-chrome";
import { WeeklyRosterPreview } from "@/features/roster/components/weekly-roster-preview";
import { WeeklyRosterGrid } from "@/features/roster/components/weekly-roster-grid";
import { getUpcomingWeekPreview, getWeeklyRoster } from "@/features/data/actions/dashboard-actions";
import { getCurrentActor } from "@/lib/server-session";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function StaffSchedulePage(props: {
  searchParams?: Promise<{ week?: string; days?: string }>;
}) {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");

  const searchParams = await props.searchParams;
  const weekStart = searchParams?.week ?? null;
  const numDays = (searchParams?.days === "5" ? 5 : 7) as 5 | 7;

  const [previewShifts, weeklyRoster] = await Promise.all([
    actor.userId ? getUpcomingWeekPreview(actor.userId) : [],
    getWeeklyRoster(weekStart, numDays),
  ]);

  return (
    <DashboardChrome title="My Schedule" subtitle="Your upcoming roster & team schedule" actor={actor}>
      <div className="space-y-8">
        <WeeklyRosterPreview shifts={previewShifts} />
        {/* <WeeklyRosterGrid data={weeklyRoster} viewAllHref="" /> */}
      </div>
    </DashboardChrome>
  );
}
