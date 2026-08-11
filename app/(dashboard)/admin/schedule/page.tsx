import { DashboardChrome } from "@/components/layout/dashboard-chrome";
import { Button } from "@/components/ui/button";
import { RosterSummaryCards } from "@/features/roster/components/roster-summary-cards";
import { WeeklyRosterGrid } from "@/features/roster/components/weekly-roster-grid";
import { CalendarDays, PencilLine } from "lucide-react";
import {
  getRosterSummaryCards,
  getWeeklyRoster,
} from "@/features/data/actions/dashboard-actions";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function AdminSchedulePage() {
  const [summary, roster] = await Promise.all([
    getRosterSummaryCards(),
    getWeeklyRoster(null, 5),
  ]);

  const startLabel = new Date(`${roster.weekStart}T00:00:00Z`).toLocaleDateString(
    "en-AU",
    { month: "short", day: "numeric", year: "numeric" },
  );
  const endLabel = new Date(`${roster.weekEnd}T00:00:00Z`).toLocaleDateString(
    "en-AU",
    { month: "short", day: "numeric", year: "numeric" },
  );

  return (
    <DashboardChrome
      title="Staff Roster"
      subtitle={`Week of ${startLabel} — ${endLabel}`}
    >
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <button className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10">
              <CalendarDays className="size-4" />
              Weekly
            </button>
            <button className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-transparent px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-white/5 hover:text-slate-200">
              Daily
            </button>
          </div>
          <Button variant="primary" className="w-full justify-center lg:w-auto">
            <PencilLine className="size-4" />
            Modify Schedule
          </Button>
        </div>

        <RosterSummaryCards summary={summary} />
        <WeeklyRosterGrid data={roster} />
      </div>
    </DashboardChrome>
  );
}
