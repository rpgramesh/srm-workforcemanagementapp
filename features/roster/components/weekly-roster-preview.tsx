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
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-white">Weekly Roster</h2>
          <p className="mt-1 text-sm text-slate-400">Upcoming shifts for this week</p>
        </div>
        <button
          type="button"
          onClick={fullMonthHref ? () => (window.location.href = fullMonthHref) : undefined}
          className="text-sm font-semibold text-slate-300 hover:text-white"
        >
          View Full Month
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {shifts.length === 0 ? (
          <Card className="bg-slate-950/35 md:col-span-2 xl:col-span-4">
            <CardContent className="p-6 text-center text-sm text-slate-400">
              No upcoming shifts assigned for this week yet.
            </CardContent>
          </Card>
        ) : (
          shifts.map((s) => {
            const { day, dateNum } = fmtDayAndDate(s.isoDate);
            const border =
              s.state === "emerald"
                ? "border-emerald-400/30"
                : s.state === "amber"
                  ? "border-amber-400/30"
                  : s.state === "rose"
                    ? "border-rose-400/30"
                    : "border-white/10";
            const timeLabel = s.isActiveNow
              ? "ACTIVE NOW"
              : s.startTime && s.endTime
                ? `${s.startTime} – ${s.endTime}`
                : "TBD";
            const timeColor = s.isActiveNow ? "text-emerald-200" : "text-slate-200";
            return (
              <Card key={s.shiftId} className={`bg-slate-950/35 ${border}`}>
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                      {day}
                    </span>
                    <span className="flex size-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-white">
                      {dateNum}
                    </span>
                    <Calendar className="ml-auto size-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{s.title}</p>
                    <p className={`mt-2 font-mono text-xs ${timeColor}`}>
                      {s.isActiveNow ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-block size-1.5 animate-pulse rounded-full bg-emerald-300" />
                          {timeLabel}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <Clock4 className="size-3 text-slate-500" />
                          {timeLabel}
                        </span>
                      )}
                    </p>
                  </div>
                  {s.station ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
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
