import { DashboardChrome } from "@/components/layout/dashboard-chrome";
import { MetricGrid } from "@/features/dashboard/components/metric-grid";
import { LiveFloorStrip } from "@/features/dashboard/components/live-floor-strip";
import { TodaysRosterTable } from "@/features/dashboard/components/todays-roster-table";
import { ShiftSwapsPanel } from "@/features/dashboard/components/shift-swaps-panel";
import {
  getDashboardMetricGrid,
  getLiveFloorStrip,
  getTodaysRoster,
  getShiftSwaps,
} from "@/features/data/actions/dashboard-actions";

export default async function AdminDashboardPage() {
  const [metrics, liveMembers, todaysRoster, swaps] = await Promise.all([
    getDashboardMetricGrid(),
    getLiveFloorStrip(),
    getTodaysRoster(),
    getShiftSwaps(),
  ]);

  return (
    <DashboardChrome
      title="Daily Overview"
      subtitle="Real-time performance metrics for today"
    >
      <div className="space-y-10">
        <MetricGrid metrics={metrics} />
        <LiveFloorStrip members={liveMembers} />
        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
          <TodaysRosterTable rows={todaysRoster} fullScheduleHref="/admin/schedule" />
          <ShiftSwapsPanel requests={swaps} />
        </div>
      </div>
    </DashboardChrome>
  );
}
