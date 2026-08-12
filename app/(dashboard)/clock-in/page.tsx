import { redirect } from "next/navigation";
import { DashboardChrome } from "@/components/layout/dashboard-chrome";
import { ClockInTerminal, type StaffClockView } from "@/features/attendance/components/clock-in-terminal";
import { WeeklyRosterPreview } from "@/features/roster/components/weekly-roster-preview";
import {
  getStaffClockView,
  getTerminalConfig,
  getUpcomingWeekPreview,
} from "@/features/data/actions/dashboard-actions";
import { getCurrentActor } from "@/lib/server-session";
import { canManageStaff } from "@/types/user";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function ClockInPage(props: { searchParams?: Promise<Record<string, unknown>> }) {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");

  const searchParams = (await (props.searchParams ?? Promise.resolve({}))) as { user?: string };
  const requestedUser = typeof searchParams?.user === "string" ? searchParams.user : null;
  const actorIsAdmin = canManageStaff(actor.role);

  let targetUserId: string = actor.userId;
  if (requestedUser && UUID_RE.test(requestedUser)) {
    if (actorIsAdmin) {
      targetUserId = requestedUser;
    } else {
      // staff can NEVER request another user's view
      if (requestedUser !== actor.userId) redirect("/clock-in");
    }
  }
  if (!UUID_RE.test(targetUserId)) {
    // Synthetic (env) actor: gracefully degrade with a demo zeroed view instead of crashing
    // (no real attendance records can be inserted because repo recordClockIn UUID-guards).
  }

  const [terminal, view, previewShifts] = await Promise.all([
    getTerminalConfig(),
    getStaffClockView(targetUserId) as Promise<StaffClockView>,
    UUID_RE.test(targetUserId) ? getUpcomingWeekPreview(targetUserId) : [],
  ]);

  async function refreshView(): Promise<void> {
    "use server";
    await getStaffClockView(targetUserId);
  }

  return (
    <DashboardChrome
      title="Clock In / Out"
      subtitle="Enter your PIN to start or end your shift"
      actor={actor}
    >
      <ClockInTerminal
        initialUserId={UUID_RE.test(targetUserId) ? targetUserId : undefined}
        view={view}
        refresh={refreshView}
      />
      {previewShifts && previewShifts.length > 0 ? (
        <div className="mt-8">
          <WeeklyRosterPreview shifts={previewShifts} fullMonthHref="/schedule" />
        </div>
      ) : null}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <p>Terminal ID: #{terminal.terminalCode.split("-").slice(1).join("-") || terminal.terminalCode}</p>
        <p>{terminal.syncLabel}</p>
      </div>
    </DashboardChrome>
  );
}
