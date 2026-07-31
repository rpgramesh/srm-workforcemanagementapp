import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ShiftDistribution } from "@/types/domain";

interface ShiftDistributionPanelProps {
  distribution: ShiftDistribution;
}

export function ShiftDistributionPanel({ distribution }: ShiftDistributionPanelProps) {
  const severity = distribution.aiSuggestion?.severity;
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-[-0.03em] text-white">Shift Distribution</h2>
        <p className="mt-1 text-sm text-slate-400">
          {distribution.period === "week"
            ? "Allocated shifts per department for this week."
            : distribution.period === "fortnight"
              ? "Shift share across the last 14 days."
              : "Monthly staffing balance across departments."}
        </p>
      </div>

      <Card className="bg-slate-950/35">
        <CardContent className="space-y-5 p-6">
          {distribution.distribution.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">
              No distribution data available yet.
            </p>
          ) : (
            distribution.distribution.map((d) => (
              <div key={d.departmentId} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-200">{d.departmentName}</span>
                  <span className="font-mono text-slate-300">{d.percentage}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/10">
                  <div
                    className={d.barColorClass ? d.barColorClass : "bg-emerald-300/70"}
                    style={{
                      width: `${Math.min(100, Math.max(0, d.percentage))}%`,
                      height: "100%",
                      borderRadius: "9999px",
                    }}
                  />
                </div>
              </div>
            ))
          )}

          {distribution.aiSuggestion ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start gap-3">
                <span
                  className={`inline-flex size-7 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-slate-950 ${
                    severity === "critical"
                      ? "bg-rose-300"
                      : severity === "warning"
                        ? "bg-amber-300"
                        : "bg-emerald-300"
                  }`}
                >
                  <Sparkles className="size-3.5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Operations Insight
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-200">
                    {distribution.aiSuggestion.text}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
