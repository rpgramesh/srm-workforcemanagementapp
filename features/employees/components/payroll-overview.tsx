import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { PayrollOverviewData } from "@/types/domain";
import { currency } from "@/features/data/supabase-utils";

interface PayrollOverviewProps {
  data: PayrollOverviewData;
}

export function PayrollOverview({ data }: PayrollOverviewProps) {
  const { period, totalGross, totalHours, overtimeCost, currencyCode } = data;
  const startLabel = new Date(`${period.periodStart}T00:00:00Z`).toLocaleDateString("en-AU", {
    month: "short",
    day: "numeric",
  });
  const endLabel = new Date(`${period.periodEnd}T00:00:00Z`).toLocaleDateString("en-AU", {
    month: "short",
    day: "numeric",
  });

  return (
    <Card className="bg-slate-950/35">
      <CardContent className="p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              Payroll Overview
            </p>
            <p className="text-sm text-slate-300">
              Current Pay Period: {startLabel} — {endLabel}
            </p>
          </div>
          <Button variant="primary" className="w-full justify-center lg:w-auto">
            Process Payroll
          </Button>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
              Total Gross
            </p>
            <p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-white">
              {currency(totalGross, currencyCode)}
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
              Total Hours
            </p>
            <p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-white">
              {totalHours.toFixed(1)}h
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
              Overtime Cost
            </p>
            <p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-rose-100">
              {currency(overtimeCost, currencyCode)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
