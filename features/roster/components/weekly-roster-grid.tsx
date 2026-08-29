import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { WeeklyRosterData } from "@/types/domain";
import { initialsFromName, formatUserLabel } from "@/lib/user-labels";

interface WeeklyRosterGridProps {
  data: WeeklyRosterData;
}

export function WeeklyRosterGrid({ data }: WeeklyRosterGridProps) {
  const { employees, dayHeaders } = data;
  return (
    <section>
      <div className="mb-4 flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-white">Weekly Roster</h2>
          <p className="mt-1 text-sm text-slate-400">Upcoming shifts for this week</p>
        </div>
        <a
          href="/admin/schedule"
          className="text-sm font-semibold text-slate-400 hover:text-white transition-colors"
        >
          View Full Month
        </a>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-[#181920]/90 shadow-2xl backdrop-blur-md">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[1.4fr_repeat(5,1fr)] text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            <div className="border-b border-slate-800/60 px-6 py-4">Employee</div>
            {dayHeaders.map((h) => (
              <div key={h.isoDate} className="border-b border-l border-slate-800/60 px-4 py-4 text-right">
                {h.weekDay}
                <span className="ml-2 text-base font-semibold tracking-normal text-white">
                  {String(h.dayNum).padStart(2, "0")}
                </span>
              </div>
            ))}
          </div>

          {employees.length === 0 ? (
            <div className="p-6 text-center text-sm font-medium text-slate-500">
              No roster published for this week yet.
            </div>
          ) : (
            employees.map((row) => (
              <div
                key={row.userId}
                className="grid grid-cols-[1.4fr_repeat(5,1fr)] items-stretch border-b border-slate-800/60 last:border-0 hover:bg-slate-900/40 transition-colors"
              >
                <div className="flex items-center gap-3 px-6 py-5">
                  <Avatar className="size-11 rounded-2xl border border-slate-700/50">
                    <AvatarFallback
                      className="text-xs font-bold text-slate-950"
                      style={{ backgroundColor: row.color ?? "#A7F3D0" }}
                    >
                      {initialsFromName(row.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {formatUserLabel({ fullName: row.fullName, role: row.badgeLabel })}
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                      {row.badgeLabel}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-400">{row.department}</p>
                  </div>
                </div>

                {row.shiftsPerDay.map((slot, index) => {
                  const highlight = typeof row.highlightDayIndex === "number" && index === row.highlightDayIndex;
                  const content = slot.isOff ? (
                    <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">OFF</span>
                  ) : (
                    <span className="font-mono text-xs text-slate-200">
                      {slot.startTime} – {slot.endTime}
                    </span>
                  );
                  return (
                    <div
                      key={`${row.userId}-${index}`}
                      className="border-l border-slate-800/60"
                    >
                      <div className="flex items-center justify-end px-4 py-5">
                        {highlight && !slot.isOff ? (
                          <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-2">
                            {content}
                          </div>
                        ) : slot.isOff ? (
                          <div className="px-4 py-2">{content}</div>
                        ) : (
                          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-2">
                            {content}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}