"use client";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { TodaysRosterRow } from "@/types/domain";

interface TodaysRosterTableProps {
  rows: TodaysRosterRow[];
  fullScheduleHref?: string;
}

export function TodaysRosterTable({ rows, fullScheduleHref }: TodaysRosterTableProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-[-0.03em] text-white">Today&apos;s Roster</h2>
        <button
          type="button"
          onClick={fullScheduleHref ? () => (window.location.href = fullScheduleHref) : undefined}
          className="text-sm font-semibold text-slate-300 hover:text-white"
        >
          View full schedule
        </button>
      </div>

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Staff Member</TH>
            <TH>Role</TH>
            <TH>Shift Time</TH>
            <TH>Status</TH>
            <TH className="w-12 text-right" />
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TR>
              <TD colSpan={5} className="py-10 text-center text-sm text-slate-400">
                No shifts are scheduled for today.
              </TD>
            </TR>
          ) : (
            rows.map((row) => (
              <TR key={row.shiftId}>
                <TD>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-10 rounded-2xl">
                      <AvatarFallback
                        className="text-xs text-slate-950"
                        style={{ backgroundColor: row.color ?? "#A7F3D0" }}
                      >
                        {row.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold text-white">{row.fullName}</p>
                      <p className="text-xs text-slate-500">Shift assigned</p>
                    </div>
                  </div>
                </TD>
                <TD className="text-slate-200">{row.role}</TD>
                <TD className="font-mono text-slate-200">
                  {row.shiftStart} – {row.shiftEnd}
                </TD>
                <TD>
                  <Badge variant={row.statusVariant}>
                    {row.status === "clocked_in"
                      ? "Clocked In"
                      : row.status === "clocked_out"
                        ? "Clocked Out"
                        : row.status === "late"
                          ? "Late"
                          : row.status === "absent"
                            ? "Absent"
                            : "Upcoming"}
                  </Badge>
                </TD>
                <TD className="text-right">
                  <button className="inline-flex size-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10">
                    <MoreHorizontal className="size-4" />
                  </button>
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>
    </section>
  );
}
