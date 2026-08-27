import { redirect } from "next/navigation";
import { DashboardChrome } from "@/components/layout/dashboard-chrome";
import { Button } from "@/components/ui/button";
import { RosterSummaryCards } from "@/features/roster/components/roster-summary-cards";
import { Calendar } from "./calendar";
import { CalendarDays, PencilLine } from "lucide-react";
import { getRosterSummaryCards } from "@/features/data/actions/dashboard-actions";
import { currentActorInfo } from "@/features/auth/actions/login-action";
import { isAdminDashboardRole, isSupervisorDashboardRole } from "@/types/user";
import { operationsRepository } from "@/features/data/repositories/operations-repository";
import { getOpeningHours } from "@/features/settings/services/opening-hours-service";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function AdminSchedulePage() {
  const actor = await currentActorInfo();
  if (!actor) redirect("/login");
  if (!isAdminDashboardRole(actor.role) && !isSupervisorDashboardRole(actor.role)) {
    redirect("/schedule");
  }
  
  const [summary, openingHours, departments, users] = await Promise.all([
    getRosterSummaryCards(),
    getOpeningHours(),
    operationsRepository.listDepartments(),
    operationsRepository.getUsers(["employee", "manager", "supervisor"]),
  ]);

  const today = new Date();
  const startLabel = today.toLocaleDateString("en-AU", { month: "short", day: "numeric", year: "numeric" });
  // Just dummy label for now to keep the layout, actual date range will be managed by calendar view
  const endLabel = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-AU", { month: "short", day: "numeric", year: "numeric" });

  return (
    <DashboardChrome
      title="Staff Roster"
      subtitle={`Week of ${startLabel} — ${endLabel}`}
      actor={actor}
    >
      <div className="space-y-8">
        <RosterSummaryCards summary={summary} />
        
        <div className="mt-8">
          <Calendar
            initialDate={today.toISOString()}
            openingHours={openingHours}
            departments={departments}
            users={users || []}
          />
        </div>
      </div>
    </DashboardChrome>
  );
}
