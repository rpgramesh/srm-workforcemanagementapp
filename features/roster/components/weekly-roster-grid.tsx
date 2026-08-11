import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { WeeklyRosterData } from "@/types/domain";
import { initialsFromName, formatUserLabel } from "@/lib/user-labels";

interface WeeklyRosterGridProps {
  data: WeeklyRosterData;
}

export function WeeklyRosterGrid({ data }: WeeklyRosterGridProps) {
  const { employees, dayHeaders } = data;
  return (
    <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.02]">
      <div className="grid min-w-[900px] grid-cols-[1.4fr_repeat(5,1fr)] text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400">
        <div className="border-b border-white/10 px-6 py-4">Employee</div>
        {dayHeaders.map((h) => (
          <div key={h.isoDate} className="border-b border-l border-white/10 px-4 py-4 text-right">
            {h.weekDay}
            <span className="ml-2 text-base font-semibold tracking-normal text-slate-200">
              {String(h.dayNum).padStart(2, "0")}
            </span>
          </div>
        ))}
      </div>

      <div className="min-w-[900px]">
        {employees.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-400">
            No roster published for this week yet.
          </div>
        ) : (
          employees.map((row) => (
            <div
              key={row.userId}
              className="grid grid-cols-[1.4fr_repeat(5,1fr)] items-stretch border-b border-white/5 last:border-0"
            >
              <div className="flex items-center gap-3 px-6 py-5">
                <Avatar className="size-11 rounded-2xl">
                  <AvatarFallback
                    className="text-xs text-slate-950"
                    style={{ backgroundColor: row.color ?? "#A7F3D0" }}
                  >
                    {initialsFromName(row.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {formatUserLabel({ fullName: row.fullName, role: row.badgeLabel })}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                    {row.badgeLabel}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{row.department}</p>
                </div>
              </div>

              {row.shiftsPerDay.map((slot, index) => {
                const highlight = typeof row.highlightDayIndex === "number" && index === row.highlightDayIndex;
                const content = slot.isOff ? (
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">OFF</span>
                ) : (
                  <span className="font-mono text-xs text-slate-100">
                    {slot.startTime} – {slot.endTime}
                  </span>
                );
                return (
                  <div
                    key={`${row.userId}-${index}`}
                    className="border-l border-white/5"
                  >
                    <div className="flex items-center justify-end px-4 py-5">
                      {highlight && !slot.isOff ? (
                        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2">
                          {content}
                        </div>
                      ) : slot.isOff ? (
                        <div className="px-4 py-2">{content}</div>
                      ) : (
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2">
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
    </section>
  );
}
