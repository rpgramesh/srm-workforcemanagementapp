"use client";
import { Calendar, Clock4, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { UpcomingShiftPreview } from "@/types/domain";

interface WeeklyRosterPreviewProps {
  shifts: UpcomingShiftPreview[];
  fullMonthHref?: string;
}

function fmtDayAndDate(isoDate: string): { day: string; dateNum: string } {
  const d = new Date(isoDate.includes("T") ? isoDate : `${isoDate}T00:00:00Z`);
  return {
    day: d.toLocaleDateString("en-AU", { weekday: "short" }).toUpperCase(),
    dateNum: d.toLocaleDateString("en-AU", { day: "2-digit" }),
  };
}

export function WeeklyRosterPreview({ shifts, fullMonthHref }: WeeklyRosterPreviewProps) {
  return (
    <section className="space-y-4 bg-blue-950">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-white">Weekly Roster</h2>
          <p className="mt-1 text-sm text-slate-400">Upcoming shifts for this week</p>
        </div>
        <button
          type="button"
          onClick={fullMonthHref ? () => (window.location.href = fullMonthHref) : undefined}
          className="rounded-md bg-red/15 px-2 py-0.5 text-[12px] font-bold uppercase tracking-[0.15em] text-red-400 hover:text-red-200 hover:bg-red/20 transition-colors"
        >
          View Full Month
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {shifts.length === 0 ? (
          <Card className="rounded-3xl border border-slate-800 bg-[#181920]/90 shadow-2xl backdrop-blur-md md:col-span-2 xl:col-span-4">
            <CardContent className="p-6 text-center text-sm font-medium text-slate-500">
              No upcoming shifts assigned for this week yet.
            </CardContent>
          </Card>
        ) : (
          shifts.map((s) => {
            const { day, dateNum } = fmtDayAndDate(s.isoDate);
            const border =
              s.state === "emerald"
                ? "border-blue-500/30"
                : s.state === "amber"
                  ? "border-amber-400/30"
                  : s.state === "rose"
                    ? "border-rose-400/30"
                    : "border-slate-800";
            const timeLabel = s.isActiveNow
              ? "ACTIVE NOW"
              : s.startTime && s.endTime
                ? `${s.startTime} – ${s.endTime}`
                : "TBD";
            const timeColor = s.isActiveNow ? "text-blue-400 font-semibold" : "text-slate-300";
            return (
              <Card
                key={s.shiftId}
                className={`rounded-3xl border bg-[#181920]/90 shadow-2xl backdrop-blur-md transition-colors hover:bg-slate-900/60 ${border}`}
              >
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                      {day}
                    </span>
                    <span className="flex size-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-sm font-semibold text-white">
                      {dateNum}
                    </span>
                    <Calendar className="ml-auto size-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{s.title}</p>
                    <p className={`mt-2 font-mono text-xs ${timeColor}`}>
                      {s.isActiveNow ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-block size-1.5 animate-pulse rounded-full bg-blue-500" />
                          {timeLabel}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <Clock4 className="size-3.5 text-slate-400" />
                          {timeLabel}
                        </span>
                      )}
                    </p>
                  </div>
                  {s.station ? (
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                      <MapPin className="size-3.5 shrink-0" />
                      <span className="truncate">{s.station}</span>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </section>
  );
}
