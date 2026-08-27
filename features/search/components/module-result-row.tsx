"use client";

import Link from "next/link";
import {
  Users,
  CalendarClock,
  Building2,
  MessageSquare,
  FileText,
  Banknote,
  ListTodo,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SearchHit, SearchModuleId } from "@/types/platform";
import { cn } from "@/lib/utils";

const MODULE_ICON: Record<SearchModuleId, React.ComponentType<{ className?: string }>> = {
  staff: Users,
  shifts: CalendarClock,
  messages: MessageSquare,
  audit_logs: FileText,
  departments: Building2,
  payroll: Banknote,
  roster: ListTodo,
};

const MODULE_TONE: Record<SearchModuleId, "emerald" | "sky" | "amber" | "rose" | "indigo" | "teal" | "violet"> = {
  staff: "emerald",
  shifts: "sky",
  messages: "violet",
  audit_logs: "amber",
  departments: "teal",
  payroll: "rose",
  roster: "indigo",
};

const MODULE_LABEL: Record<SearchModuleId, string> = {
  staff: "Staff",
  shifts: "Shifts",
  messages: "Messages",
  audit_logs: "Audit",
  departments: "Departments",
  payroll: "Payroll",
  roster: "Roster",
};

interface ModuleResultRowProps {
  hit: SearchHit;
  active?: boolean;
  onClick?: () => void;
}

export function ModuleResultRow({ hit, active, onClick }: ModuleResultRowProps) {
  const Icon = MODULE_ICON[hit.module] ?? FileText;
  const tone = MODULE_TONE[hit.module];
  const moduleLabel = MODULE_LABEL[hit.module] ?? hit.module;

  const content = (
    <div
      className={cn(
        "group flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors",
        active
          ? "border-blue-500/30 bg-blue-500/10"
          : "border-transparent hover:border-slate-200 hover:bg-white/5",
      )}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/5",
          tone === "emerald" && "border-blue-500/20 bg-blue-500/10 text-blue-600",
          tone === "sky" && "border-sky-400/20 bg-sky-400/10 text-sky-300",
          tone === "amber" && "border-amber-400/20 bg-amber-400/10 text-amber-300",
          tone === "rose" && "border-rose-400/20 bg-rose-400/10 text-rose-300",
          tone === "indigo" && "border-indigo-400/20 bg-indigo-400/10 text-indigo-300",
          tone === "teal" && "border-teal-400/20 bg-teal-400/10 text-teal-300",
          tone === "violet" && "border-violet-400/20 bg-violet-400/10 text-violet-300",
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-slate-900">{hit.title}</p>
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">{hit.subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Badge tone={tone as any} size="sm">
          {moduleLabel}
        </Badge>
        <ChevronRight
          className={cn(
            "size-4 shrink-0 text-slate-500 transition-transform",
            "group-hover:text-slate-700 group-hover:translate-x-0.5",
            active && "translate-x-0.5 text-blue-600",
          )}
        />
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left">
        {content}
      </button>
    );
  }

  return (
    <Link href={hit.href} className="block w-full">
      {content}
    </Link>
  );
}
