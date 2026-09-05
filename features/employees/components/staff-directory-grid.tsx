"use client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CalendarDays, Filter, MessageCircle, Plus, TrendingDown, TrendingUp } from "lucide-react";
import type { StaffDirectoryCard } from "@/types/domain";
import { initialsFromName, formatUserLabel } from "@/lib/user-labels";
import { cn } from "@/lib/utils";

interface StaffDirectoryGridProps {
  staff: StaffDirectoryCard[];
  onAddStaff?: () => void;
  onFilter?: () => void;
  onMessageStaff?: (userId: string) => void;
}

function statusLabel(status: StaffDirectoryCard["status"]): string {
  switch (status) {
    case "clocked_in": return "Clocked In";
    case "on_leave": return "On Leave";
    case "overtime_risk": return "Overtime Risk";
    case "absent": return "Absent";
    default: return "Off Duty";
  }
}

function formatWeeklyHours(hours: number): string {
  return `${hours.toFixed(1)}h`;
}

export function StaffDirectoryGrid({ staff, onAddStaff, onFilter, onMessageStaff }: StaffDirectoryGridProps) {
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold tracking-[-0.03em] text-white">Staff Directory</h2>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-400">
            Manage team roles and schedule compliance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onFilter ? (
            <button
              type="button"
              onClick={onFilter}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Filter className="size-4" />
              Filter
            </button>
          ) : null}
          {onAddStaff ? (
            <button
              type="button"
              onClick={onAddStaff}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition-all"
            >
              <Plus className="size-4" />
              Add Staff
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {staff.length === 0 ? (
          <Card className="border-slate-800 bg-[#181920]/90 grid-cols-1 sm:col-span-2 xl:col-span-4">
            <CardContent className="p-10 text-center text-sm text-slate-400">
              No staff members are set up yet. Click &quot;Add Staff&quot; to create the first record.
            </CardContent>
          </Card>
        ) : (
          staff.map((card) => (
            <Card key={card.userId} className="bg-slate-50/35">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start gap-3">
                  <Avatar className="size-12 rounded-2xl">
                    <AvatarFallback
                      className="text-xs text-slate-950"
                      style={{ backgroundColor: card.color ?? "#A7F3D0" }}
                    >
                      {initialsFromName(card.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {formatUserLabel({ fullName: card.fullName, role: card.role })}
                    </p>
                    {card.department ? (
                      <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                        {card.department}
                      </p>
                    ) : null}
                  </div>
                  <Badge variant={card.statusVariant}>{statusLabel(card.status)}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-white/5 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      This week
                    </p>
                    <p className="mt-1 flex items-end gap-1 text-lg font-semibold tracking-[-0.02em] text-slate-900">
                      {formatWeeklyHours(card.weeklyHours)}
                      {card.weeklyHours >= 44 ? (
                        <TrendingUp className="size-3 text-rose-300" />
                      ) : (
                        <TrendingDown className="size-3 text-blue-600" />
                      )}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/5 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      Next shift
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-900">
                      <CalendarDays className={cn("size-3.5", card.status === "on_leave" ? "text-amber-300" : "text-slate-500")} />
                      <span className="line-clamp-1">
                        {card.nextShiftLabel ?? "None scheduled"}
                      </span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onMessageStaff ? () => onMessageStaff(card.userId) : undefined}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/5 py-2 text-xs font-semibold text-slate-900 hover:bg-white/10"
                >
                  <MessageCircle className="size-3.5" />
                  Message
                </button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}
