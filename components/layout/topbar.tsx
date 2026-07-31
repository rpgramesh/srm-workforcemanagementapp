"use client";

import { Bell, Search, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface TopbarProps {
  title: string;
  subtitle?: string;
}

export function Topbar({ title, subtitle }: TopbarProps) {
  return (
    <header className="flex flex-col gap-6 border-b border-white/5 bg-slate-950/30 px-8 py-6 backdrop-blur">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-white">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-sm text-slate-400">{subtitle}</p>
          ) : null}
        </div>

        <div className="flex flex-1 items-center gap-3 lg:max-w-xl">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Search roster, staff, or reports..."
              className="pl-11"
            />
          </div>
          <button className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10">
            <Bell className="size-4" />
          </button>
          <button className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10">
            <Settings className="size-4" />
          </button>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <Avatar className="size-9 rounded-xl">
              <AvatarFallback className="text-xs">AU</AvatarFallback>
            </Avatar>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold text-white">Admin User</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-200/90">
                Floor Manager
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
