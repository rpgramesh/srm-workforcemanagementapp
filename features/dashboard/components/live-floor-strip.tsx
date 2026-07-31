"use client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import type { LiveFloorMember } from "@/types/domain";
import { initials, floorMinToHuman } from "@/features/data/supabase-utils";

interface LiveFloorStripProps {
  members: LiveFloorMember[];
  floorMapHref?: string;
}

export function LiveFloorStrip({ members, floorMapHref }: LiveFloorStripProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-[-0.03em] text-white">Live Floor</h2>
        <button
          type="button"
          onClick={floorMapHref ? () => (window.location.href = floorMapHref) : undefined}
          className="text-sm font-semibold text-emerald-200 hover:text-emerald-100"
        >
          View Floor Map
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {members.length === 0 ? (
          <div className="md:col-span-2 xl:col-span-5">
            <Card className="bg-slate-950/35">
              <CardContent className="p-6 text-center text-sm text-slate-400">
                No staff members are currently clocked in. The next scheduled shift will appear here.
              </CardContent>
            </Card>
          </div>
        ) : (
          members.map((member) => (
            <Card key={member.userId} className="bg-slate-950/35">
              <CardContent className="flex items-center gap-4 p-4">
                <Avatar className="size-12 rounded-2xl">
                  <AvatarFallback
                    className="text-xs text-slate-950"
                    style={{ backgroundColor: member.color ?? "#6EE7F7" }}
                  >
                    {initials(member.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{member.fullName}</p>
                  <p className="text-xs text-slate-400">{member.role}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs font-semibold text-slate-200">
                    {floorMinToHuman(member.durationMinutes)}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">On shift</p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}
