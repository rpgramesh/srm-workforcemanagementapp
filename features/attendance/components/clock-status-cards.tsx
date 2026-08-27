import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ClockStatusCardsData } from "@/types/domain";
import { currency, floorMinToHuman } from "@/features/data/supabase-utils";

interface ClockStatusCardsProps {
  data: ClockStatusCardsData;
}

export function ClockStatusCards({ data }: ClockStatusCardsProps) {
  const {
    shiftStatus,
    shiftStartTime,
    todayEarnings,
    hoursWorkedMinutes,
    earningsDeltaPercent,
    currencyCode,
  } = data;

  const statusLabel =
    shiftStatus === "on_shift"
      ? "On Shift"
      : shiftStatus === "on_break"
        ? "On Break"
        : "Off Duty";
  const statusDotClass =
    shiftStatus === "on_shift"
      ? "bg-blue-600/80"
      : shiftStatus === "on_break"
        ? "bg-amber-300/80"
        : "bg-slate-400/60";
  const startLabel = shiftStartTime
    ? new Date(shiftStartTime).toLocaleTimeString("en-AU", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "—";
  const hoursLabel = floorMinToHuman(hoursWorkedMinutes);
  const deltaVariant = earningsDeltaPercent >= 0 ? "emerald" : "rose";
  const deltaText = `${earningsDeltaPercent >= 0 ? "+" : ""}${earningsDeltaPercent}%`;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="bg-slate-50/35">
        <CardContent className="p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Current Status
          </p>
          <div className="mt-4 flex items-center gap-3">
            <span className={`size-2 rounded-full ${statusDotClass}`} />
            <p className="text-sm font-semibold text-slate-900">{statusLabel}</p>
          </div>
          <p className="mt-6 text-xs text-slate-500">Shift Started</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900">
            {startLabel}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-slate-50/35">
        <CardContent className="p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Today&apos;s Earnings
          </p>
          <p className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-slate-900">
            {currency(todayEarnings, currencyCode)}
          </p>
          <div className="mt-6 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500">Hours Worked</p>
              <p className="mt-2 font-mono text-lg font-semibold text-slate-100">
                {hoursLabel}
              </p>
            </div>
            <Badge variant={deltaVariant}>{deltaText}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
