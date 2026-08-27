import { TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardMetric } from "@/types/domain";
import { cn } from "@/lib/utils";

interface MetricGridProps {
  metrics: DashboardMetric[];
}

export function MetricGrid({ metrics }: MetricGridProps) {
  return (
    <section className="grid gap-4 lg:grid-cols-3">
      {metrics.map((metric) => {
        const accentClass =
          metric.accent === "emerald"
            ? "text-blue-700"
            : metric.accent === "sky"
              ? "text-sky-100"
              : metric.accent === "amber"
                ? "text-amber-100"
                : metric.accent === "rose"
                  ? "text-rose-100"
                  : "text-slate-100";
        return (
          <Card key={metric.id} className="bg-slate-50/35">
            <CardContent className="p-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
                {metric.label}
              </p>
              <div className="mt-4 flex items-end justify-between gap-4">
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
                    <p className="text-sm font-medium text-slate-700">{metric.suffix}</p>
                  ) : null}
                </div>
                <div className="flex size-12 items-center justify-center rounded-2xl border border-slate-200 bg-white/5 text-slate-900">
                  <TrendingUp className="size-4" />
                </div>
              </div>
              {metric.hint ? (
                <p className="mt-3 text-sm text-slate-500">{metric.hint}</p>
              ) : null}
              {typeof metric.progressPercent === "number" ? (
                <div className="mt-5 h-2 w-full rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-blue-600/70"
                    style={{
                      width: `${Math.min(100, Math.max(0, metric.progressPercent))}%`,
                    }}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
