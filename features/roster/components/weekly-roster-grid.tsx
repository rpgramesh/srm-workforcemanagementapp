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
    <section className="w-full max-w-full">
      {/* Header Controls */}
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-1">
        <div>
          <h2 className="text-2xl sm:text-[30px] font-bold tracking-[-0.03em] text-slate-800">
            Weekly Roster
          </h2>
          <p className="text-sm sm:text-[18px] font-semibold text-slate-600">
            Upcoming shifts for this week
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Week Navigator */}
          <div className="flex items-center gap-1 rounded-2xl border border-slate-700/60 bg-slate-900/80 p-1 shadow-lg backdrop-blur-md">
            <Link
              href={`?week=${prevWeek}&days=${numDays}`}
              className="flex size-8 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              title="Previous week"
            >
              <ChevronLeft className="size-4" />
            </Link>
            <Link
              href="?"
              className="px-2 py-1 text-xs font-semibold text-slate-200 transition-colors hover:text-white sm:px-2.5"
              title="Jump to current week"
            >
              {rangeLabel}
            </Link>
            <Link
              href={`?week=${nextWeek}&days=${numDays}`}
              className="flex size-8 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              title="Next week"
            >
              <ChevronRight className="size-4" />
            </Link>
          </div>

          {/* 5D / 7D view toggle */}
          <Link
            href={`?week=${weekStart}&days=${numDays === 5 ? 7 : 5}`}
            className="rounded-2xl border border-slate-700/60 bg-slate-900/80 px-3 py-2 text-xs font-semibold text-slate-300 shadow-lg transition-colors hover:bg-slate-800 hover:text-white"
            title="Toggle between 5-day and 7-day view"
          >
            {numDays === 5 ? "Show 7 Days" : "Show 5 Days"}
          </Link>

          {viewAllHref ? (
            <a
              href={viewAllHref}
              className="text-base sm:text-[20px] font-semibold text-blue-800 hover:underline"
            >
              View Full Month &rarr;
            </a>
          ) : null}
        </div>
      </div>

      {/* Mobile View: Vertical Card Layout (< md breakpoint) */}
      <div className="block space-y-4 md:hidden">
        {employees.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-[#181920]/90 p-6 text-center text-sm font-medium text-slate-500">
            No roster published for this week yet.
          </div>
        ) : (
          employees.map((row) => (
            <div
              key={row.userId}
              className="rounded-2xl border border-slate-800 bg-[#181920]/90 p-4 shadow-xl backdrop-blur-md"
            >
              {/* Employee Header */}
              <div className="mb-3 flex items-center gap-3 border-b border-slate-800/80 pb-3 text-white">
                <Avatar className="size-10 rounded-xl border border-slate-700/50">
                  <AvatarFallback
                    className="text-xs font-bold text-slate-950 "
                    style={{ backgroundColor: row.color ?? "#bbd3caff" }}
                  >
                    {initialsFromName(row.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">
                    {row.first_name} - {row.mobile}
                    {/* {formatUserLabel({ fullName: row.fullName, role: row.role, mobile: row.mobile ?? "" })} */}
                  </p>
                </div>
              </div>

              {/* Day Shifts Breakdown */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {row.shiftsPerDay.map((slot, index) => {
                  const header = dayHeaders[index];
                  const highlight = typeof row.highlightDayIndex === "number" && index === row.highlightDayIndex;

                  return (
                    <div
                      key={`${row.userId}-mobile-${index}`}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs text-white
                        ${highlight && !slot.isOff
                          ? "bg-primary text-white"
                          : "border-slate-800/80 bg-slate-900/40 text-white"
                        }`}
                    >
                      <span className="font-bold text-white">
                        {header?.weekDay} {String(header?.dayNum).padStart(2, "0")}
                      </span>
                      {slot.isOff ? (
                        <span className="font-bold uppercase tracking-wider text-white">OFF</span>
                      ) : (
                        <span className="font-bold text-white">
                          {slot.startTime} – {slot.endTime}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop View: Horizontal Grid (>= md breakpoint) */}
      <div className="hidden md:block overflow-x-auto touch-scroll rounded-3xl border border-slate-800 bg-[#181920]/90 shadow-2xl backdrop-blur-md">
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
                className="grid items-stretch border-b border-slate-800/60 last:border-0 hover:bg-slate-900/40 transition-colors text-white"
                style={{ gridTemplateColumns: `1.4fr repeat(${dayHeaders.length}, 1fr)` }}
              >
                <div className="flex items-center gap-3 px-6 py-5">
                  <Avatar className="size-11 rounded-2xl">
                    <AvatarFallback
                      className="text-xs font-bold bg-white"
                      style={{ backgroundColor: row.color ?? "#dde3e7ff" }}
                    >
                      {initialsFromName(row.fullName) || ""}

                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {row.first_name} - {row.mobile}
                      {/* {formatUserLabel({ fullName: row.fullName, role: row.role, mobile: row.mobile ?? "" })} */}
                    </p>
                  </div>
                </div>

                {row.shiftsPerDay.map((slot, index) => {
                  const highlight = typeof row.highlightDayIndex === "number" && index === row.highlightDayIndex;
                  const content = slot.isOff ? (
                    <span className="text-lg font-medium uppercase tracking-[0.18em] text-slate-500 text-white">OFF</span>
                  ) : (
                    <span className="font-mono text-lg">
                      {slot.startTime} – {slot.endTime}
                    </span>
                  );
                  return (
                    <div key={`${row.userId}-${index}`} className="border-l border-slate-800/60 text-white">
                      <div className="flex items-center justify-end px-4 py-5">
                        {highlight && !slot.isOff ? (
                          <div className="rounded-2xl border bg-primary px-4 py-2">
                            {content}
                          </div>
                        ) : slot.isOff ? (
                          <div className="px-4 py-2">
                            {content}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/60 px-4 py-2">
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