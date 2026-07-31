import { TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardMetric } from "@/types/domain";
import { cn } from "@/lib/utils";

interface RosterSummaryCardsProps {
  summary: DashboardMetric[];
}

export function RosterSummaryCards({ summary }: RosterSummaryCardsProps) {
  return (
    <section className="grid gap-4 lg:grid-cols-4">
      {summary.map((metric) => {
        const accentClass =
          metric.accent === "emerald"
            ? "text-emerald-200"
            : metric.accent === "sky"
              ? "text-sky-100"
              : metric.accent === "amber"
                ? "text-amber-100"
                : metric.accent === "rose"
                  ? "text-rose-100"
                  : "text-slate-100";
        return (
          <Card key={metric.id} className="bg-slate-950/35">
            <CardContent className="p-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400">
                {metric.label}
              </p>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div className="flex items-baseline gap-2">
                  <p
                    className={cn(
                      "text-4xl font-semibold tracking-[-0.06em]",
                      accentClass,
                    )}
                  >
                    {metric.value}
                  </p>
                  {metric.suffix ? (
                    <p className="text-sm font-medium text-slate-300">{metric.suffix}</p>
                  ) : null}
                </div>
                <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200">
                  <TrendingUp className="size-4" />
                </div>
              </div>
              {metric.hint ? (
                <p className="mt-3 text-sm text-slate-400">{metric.hint}</p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
