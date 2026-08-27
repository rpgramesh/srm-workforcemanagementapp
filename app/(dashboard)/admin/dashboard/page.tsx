import { redirect } from "next/navigation";
import { DashboardChrome } from "@/components/layout/dashboard-chrome";
import { MetricGrid } from "@/features/dashboard/components/metric-grid";
import { LiveFloorStrip } from "@/features/dashboard/components/live-floor-strip";
import { WeeklyRosterGrid } from "@/features/roster/components/weekly-roster-grid";
import {
  getDashboardMetricGrid,
  getLiveFloorStrip,
  getWeeklyRoster,
  getShiftSwaps,
} from "@/features/data/actions/dashboard-actions";
import { currentActorInfo, dashboardRouteForActor } from "@/features/auth/actions/login-action";
import { isAdminDashboardRole } from "@/types/user";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function AdminDashboardPage() {
  const actor = await currentActorInfo();
  if (!actor) redirect("/login");
  if (!isAdminDashboardRole(actor.role)) redirect(await dashboardRouteForActor(actor.role));
  const [metrics, liveMembers, weeklyRoster, swaps] = await Promise.all([
    getDashboardMetricGrid(),
    getLiveFloorStrip(),
    getWeeklyRoster(),
    getShiftSwaps(),
  ]);

  return (
    <DashboardChrome
      title="Daily Overview"
      subtitle="Real-time performance metrics for today"
      actor={actor}
    >

      <div className="space-y-10">
        {/* <MetricGrid metrics={metrics} /> */}
        {/* <LiveFloorStrip members={liveMembers} /> */}
        <div className="grid gap-6">
          <WeeklyRosterGrid data={weeklyRoster} />
          {/* <ShiftSwapsPanel requests={swaps} /> */}
        </div>
      </div>


    </DashboardChrome>
  );
}
