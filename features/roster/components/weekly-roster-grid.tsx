import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { WeeklyRosterData } from "@/types/domain";
import { initialsFromName, formatUserLabel } from "@/lib/user-labels";

interface WeeklyRosterGridProps {
  data: WeeklyRosterData;
  viewAllHref?: string;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatWeekRange(startIso: string, endIso: string): string {
  const s = new Date(`${startIso}T00:00:00Z`);
  const e = new Date(`${endIso}T00:00:00Z`);
  const sStr = s.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  const eStr = e.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  return `${sStr} – ${eStr}`;
}

export function WeeklyRosterGrid({ data, viewAllHref = "/admin/schedule" }: WeeklyRosterGridProps) {
  const { employees, dayHeaders, weekStart, weekEnd, numDays } = data;
  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);
  const rangeLabel = formatWeekRange(weekStart, weekEnd);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-[30px] text-slate-800 font-bold tracking-[-0.03em]">Weekly Roster</h2>
          <p className="text-[18px] text-slate-600 font-semibold">Upcoming shifts for this week</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Week Navigator */}
          <div className="flex items-center gap-1 rounded-2xl border border-slate-700/60 bg-slate-900/80 p-1 backdrop-blur-md shadow-lg">
            <Link
              href={`?week=${prevWeek}&days=${numDays}`}
              className="flex size-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              title="Previous week"
            >
              <ChevronLeft className="size-4" />
            </Link>
            <Link
              href="?"
              className="px-2.5 py-1 text-xs font-semibold text-slate-200 hover:text-white transition-colors"
              title="Jump to current week"
            >
              {rangeLabel}
            </Link>
            <Link
              href={`?week=${nextWeek}&days=${numDays}`}
              className="flex size-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              title="Next week"
            >
              <ChevronRight className="size-4" />
            </Link>
          </div>

          {/* 5D / 7D view toggle */}
          <Link
            href={`?week=${weekStart}&days=${numDays === 5 ? 7 : 5}`}
            className="rounded-2xl border border-slate-700/60 bg-slate-900/80 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors shadow-lg"
            title="Toggle between 5-day and 7-day view"
          >
            {numDays === 5 ? "Show 7 Days" : "Show 5 Days"}
          </Link>

          {viewAllHref ? (
            <a
              href={viewAllHref}
              className="text-[20px] text-blue-800 font-semibold hover:underline"
            >
              View Full Month &rarr;
            </a>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto touch-scroll rounded-3xl border border-slate-800 bg-[#181920]/90 shadow-2xl backdrop-blur-md">
        <div className={dayHeaders.length > 5 ? "min-w-[960px]" : "min-w-[860px]"}>
          <div
            className="grid text-[12px] font-semibold uppercase tracking-[0.24em] text-slate-400"
            style={{ gridTemplateColumns: `1.4fr repeat(${dayHeaders.length}, 1fr)` }}
          >
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
                className="grid items-stretch border-b border-slate-800/60 last:border-0 hover:bg-slate-900/40 transition-colors"
                style={{ gridTemplateColumns: `1.4fr repeat(${dayHeaders.length}, 1fr)` }}
              >
                <div className="flex items-center gap-3 px-6 py-5">
                  <Avatar className="size-11 rounded-2xl border border-slate-700/50">
                    <AvatarFallback
                      className="text-xs font-bold text-slate-950"
                      style={{ backgroundColor: row.color ?? "#2c4c40ff" }}
                    >
                      {initialsFromName(row.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {formatUserLabel({ fullName: row.fullName, role: row.role })}
                    </p>
                    {/* <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                      {row.badgeLabel}
                    </p> */}
                    {/* <p className="mt-1 text-xs font-medium text-slate-400">{row.department}</p> */}
                  </div>
                </div>

                {row.shiftsPerDay.map((slot, index) => {
                  const highlight = typeof row.highlightDayIndex === "number" && index === row.highlightDayIndex;
                  const content = slot.isOff ? (
                    <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">OFF</span>
                  ) : (
                    <span className="font-mono text-xs ">
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