import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeliveryModule } from "@/types/app";

const statusStyles: Record<DeliveryModule["status"], string> = {
  current:
    "border-blue-500/30 bg-blue-500/10 text-blue-700 shadow-[0_0_30px_rgba(52,211,153,0.12)]",
  next: "border-sky-400/20 bg-sky-400/10 text-sky-100",
  planned: "border-slate-200 bg-white/5 text-slate-900",
};

const badgeStyles: Record<DeliveryModule["status"], string> = {
  current: "bg-blue-500/15 text-blue-700",
  next: "bg-sky-400/15 text-sky-100",
  planned: "bg-white/10 text-slate-900",
};

const statusLabel: Record<DeliveryModule["status"], string> = {
  current: "In Progress",
  next: "Up Next",
  planned: "Planned",
};

interface ModuleCardProps {
  module: DeliveryModule;
}

export function ModuleCard({ module }: ModuleCardProps) {
  return (
    <article
      className={cn(
        "group rounded-3xl border p-6 transition-transform duration-200 hover:-translate-y-1",
        statusStyles[module.status],
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <span
          className={cn(
            "rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-[0.24em]",
            badgeStyles[module.status],
          )}
        >
          {statusLabel[module.status]}
        </span>
        <ArrowUpRight className="size-4 text-current/70 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold tracking-[-0.02em] text-slate-900">
          {module.title}
        </h3>
        <p className="text-sm leading-6 text-slate-700">{module.description}</p>
      </div>
    </article>
  );
}
