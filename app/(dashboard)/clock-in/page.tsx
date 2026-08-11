import { DashboardChrome } from "@/components/layout/dashboard-chrome";
import { ClockInTerminal } from "@/features/attendance/components/clock-in-terminal";
import { ClockStatusCards } from "@/features/attendance/components/clock-status-cards";
import { WeeklyRosterPreview } from "@/features/roster/components/weekly-roster-preview";
import {
  getClockStatusCards,
  getTerminalConfig,
  getUpcomingWeekPreview,
} from "@/features/data/actions/dashboard-actions";
import { userRepository } from "@/features/users/repositories/supabase-user-repository";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function ClockInPage() {
  const users = await userRepository.list({ onlyActive: true, limit: 20 });
  const defaultUser =
    users.find((u) => u.role === "employee" || u.role === "supervisor") ??
    users[0] ??
    null;
  const demoUserId = defaultUser?.id ?? "";

  const [terminal, clockStatus, previewShifts] = await Promise.all([
    getTerminalConfig(),
    demoUserId ? getClockStatusCards(demoUserId) : null,
    demoUserId ? getUpcomingWeekPreview(demoUserId) : [],
  ]);

  return (
    <DashboardChrome
      title="Clock In / Out"
      subtitle="Enter your PIN to start or end your shift"
    >
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <ClockInTerminal />
        <div className="space-y-6">
          {clockStatus ? <ClockStatusCards data={clockStatus} /> : null}
          <WeeklyRosterPreview shifts={previewShifts} fullMonthHref="/schedule" />
        </div>
      </div>
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <p>Terminal ID: #{terminal.terminalCode.split("-").slice(1).join("-") || terminal.terminalCode}</p>
        <p>{terminal.syncLabel}</p>
      </div>
    </DashboardChrome>
  );
}
