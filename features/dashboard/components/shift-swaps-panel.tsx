"use client";
import { ArrowRightLeft, Calendar, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ShiftSwapRequest } from "@/types/domain";

interface ShiftSwapsPanelProps {
  requests: ShiftSwapRequest[];
  onRefresh?: () => void;
}

function formatDateRange(r: ShiftSwapRequest): string {
  if (!r.shiftDate) return "Pending shift details";
  const base = new Date(`${r.shiftDate}T00:00:00Z`);
  const datePart = base.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
  const start = r.shiftStart ?? "";
  const end = r.shiftEnd ?? "";
  return start && end ? `${datePart} · ${start} – ${end}` : datePart;
}

export function ShiftSwapsPanel({ requests, onRefresh }: ShiftSwapsPanelProps) {
  const visible = requests.slice(0, 4);
  const placeholders = Array.from({ length: Math.max(0, 4 - visible.length) });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-[-0.03em] text-white">Shift Swaps</h2>
        <button
          type="button"
          onClick={onRefresh}
          className="text-sm font-semibold text-slate-300 hover:text-white"
        >
          Refresh
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {visible.map((r) => {
          const variant =
            r.status === "approved"
              ? "border-emerald-400/30 bg-emerald-500/10"
              : r.status === "rejected"
                ? "border-rose-400/30 bg-rose-500/10"
                : r.status === "completed"
                  ? "border-sky-400/30 bg-sky-500/10"
                  : "border-amber-400/30 bg-amber-500/5";
          const statusBadge =
            r.status === "approved"
              ? { text: "Approved", cls: "text-emerald-200" }
              : r.status === "rejected"
                ? { text: "Rejected", cls: "text-rose-200" }
                : r.status === "completed"
                  ? { text: "Completed", cls: "text-sky-200" }
                  : r.status === "withdrawn"
                    ? { text: "Withdrawn", cls: "text-slate-300" }
                    : { text: "Pending", cls: "text-amber-200" };

          return (
            <Card key={r.id} className={`bg-slate-950/35 ${variant}`}>
              <CardContent className="flex items-start gap-4 p-5">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200">
                  <ArrowRightLeft className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-white">
                      {r.requesterFullName ?? `Request #${r.id.slice(0, 6)}`}
                      {r.offeredToFullName ? (
                        <span className="text-slate-400"> ↔ {r.offeredToFullName}</span>
                      ) : null}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                    <Calendar className="size-3.5 shrink-0" />
                    <span className="truncate">{formatDateRange(r)}</span>
                    {r.stationLabel ? (
                      <span className="truncate text-slate-500">· {r.stationLabel}</span>
                    ) : null}
                  </div>
                  {r.reason ? (
                    <p className="mt-3 line-clamp-2 text-xs text-slate-300/90">{r.reason}</p>
                  ) : null}
                  <div className="mt-3 flex items-center justify-between">
                    <span className={`text-xs font-semibold uppercase tracking-[0.2em] ${statusBadge.cls}`}>
                      {statusBadge.text}
                    </span>
                    {r.status === "approved" ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-200">
                        <CheckCircle2 className="size-3.5" /> Ready
                      </span>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {placeholders.map((_, i) => (
          <Card key={`placeholder-${i}`} className="bg-slate-950/20">
            <CardContent className="flex min-h-[140px] items-center justify-center border border-dashed border-white/10 p-5 text-center text-xs text-slate-500">
              Fetching latest requests…
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
