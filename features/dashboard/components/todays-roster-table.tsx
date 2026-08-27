"use client";

import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import type { TodaysRosterRow } from "@/types/domain";
import { formatUserLabel, initialsFromName } from "@/lib/user-labels";

interface TodaysRosterTableProps {
  rows: TodaysRosterRow[];
  fullScheduleHref?: string;
}

export function TodaysRosterTable({ rows, fullScheduleHref }: TodaysRosterTableProps) {
  return (
    <Card className="bg-[#181920] border-slate-800 shadow-xl text-slate-100 p-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Today&apos;s Roster</h2>
          <p className="text-xs text-slate-400">Real-time shift activity for today</p>
        </div>
        {fullScheduleHref && (
          <button
            type="button"
            onClick={() => (window.location.href = fullScheduleHref)}
            className="text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            View full schedule
          </button>
        )}
      </div>

      <div className="overflow-x-auto mt-2">
        <Table className="w-full text-left">
          <THead className="bg-slate-900/80 border-b border-slate-800">
            <TR className="hover:bg-transparent">
              <TH className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Staff Member</TH>
              <TH className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Role</TH>
              <TH className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Shift Time</TH>
              <TH className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</TH>
              <TH className="w-12 px-4 py-3 text-right" />
            </TR>
          </THead>
          <TBody className="divide-y divide-slate-800/60">
            {rows.length === 0 ? (
              <TR>
                <TD colSpan={5} className="py-12 text-center text-sm text-slate-400 font-medium">
                  No shifts are scheduled for today.
                </TD>
              </TR>
            ) : (
              rows.map((row) => (
                <TR key={row.shiftId} className="transition-colors hover:bg-slate-800/40">
                  <TD className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-9 rounded-full">
                        <AvatarFallback
                          className="text-xs font-bold text-slate-950 shadow-sm"
                          style={{ backgroundColor: row.color ?? "#94A3B8" }}
                        >
                          {initialsFromName(row.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {formatUserLabel({ fullName: row.fullName, role: row.role })}
                        </p>
                        <p className="truncate text-xs text-slate-400">Shift assigned</p>
                      </div>
                    </div>
                  </TD>
                  <TD className="px-4 py-3 text-sm text-slate-300">{row.role}</TD>
                  <TD className="px-4 py-3 text-sm font-mono text-slate-200">
                    {row.shiftStart} – {row.shiftEnd}
                  </TD>
                  <TD className="px-4 py-3">
                    {row.status === "clocked_in" ? (
                      <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                        Clocked In
                      </span>
                    ) : row.status === "clocked_out" ? (
                      <span className="inline-flex items-center rounded-md bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-400 border border-slate-700">
                        Clocked Out
                      </span>
                    ) : row.status === "late" ? (
                      <span className="inline-flex items-center rounded-md bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-400 border border-rose-500/20">
                        Late
                      </span>
                    ) : row.status === "absent" ? (
                      <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400 border border-amber-500/20">
                        Absent
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-400 border border-sky-500/20">
                        Upcoming
                      </span>
                    )}
                  </TD>
                  <TD className="px-4 py-3 text-right">
                    <button
                      type="button"
                      aria-label="More options"
                      className="inline-flex size-8 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </div>
    </Card>
  );
}