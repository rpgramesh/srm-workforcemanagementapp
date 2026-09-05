"use client";

import { TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardMetric } from "@/types/domain";
import { cn } from "@/lib/utils";

interface RosterSummaryCardsProps {
  summary: DashboardMetric[];
}

export function RosterSummaryCards({ summary }: RosterSummaryCardsProps) {
  return (
    <section className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {summary.map((metric) => {
        // High-contrast, vibrant text colors suited for the dark surface (#181920)
        const accentClass =
          metric.accent === "emerald"
            ? "text-emerald-400"
            : metric.accent === "sky"
              ? "text-sky-400"
              : metric.accent === "amber"
                ? "text-amber-400"
                : metric.accent === "rose"
                  ? "text-rose-400"
                  : "text-white";

        return (
          <Card key={metric.id} className="bg-[#181920] border-slate-800 shadow-xl text-slate-100">
            <CardContent className="p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                {metric.label}
              </p>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div className="flex items-baseline gap-2">
                  <p
                    className={cn(
                      "text-4xl font-bold tracking-tight",
                      accentClass,
                    )}
                  >
                    {metric.value}
                  </p>
                  {metric.suffix ? (
                    <p className="text-sm font-medium text-slate-400">{metric.suffix}</p>
                  ) : null}
                </div>
                <div className="flex size-10 items-center justify-center rounded-xl border border-slate-700/60 bg-slate-800/80 text-slate-300 shadow-sm">
                  <TrendingUp className="size-4" />
                </div>
              </div>
              {metric.hint ? (
                <p className="mt-3 text-xs text-slate-400">{metric.hint}</p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}