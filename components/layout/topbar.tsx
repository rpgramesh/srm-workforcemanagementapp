"use client";

import Link from "next/link";
import { Search, Settings } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { AppRole } from "@/types/app";
import { formatUserLabel, initialsFromName } from "@/lib/user-labels";
import { NotificationBell } from "@/features/notifications/components/notification-bell";

interface ActorIdentity {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role?: AppRole | null;
  userId?: string | null;
}

interface TopbarProps {
  title: string;
  subtitle?: string;
  actor?: ActorIdentity;
  onSearchOpen?: () => void;
}

export function Topbar({ title, subtitle, actor, onSearchOpen }: TopbarProps) {
  const fullLabel = actor ? formatUserLabel(actor) : "Admin User (Floor Manager)";
  const initials = actor ? initialsFromName(actor) : "AU";

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
          <button
            type="button"
            onClick={onSearchOpen}
            className="group relative hidden flex-1 lg:block"
          >
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500 group-hover:text-slate-400" />
            <div className="h-11 w-full rounded-full border border-white/10 bg-slate-950/40 px-4 pl-11 text-left text-sm text-slate-400 transition-colors hover:border-white/20">
              <div className="flex h-full items-center justify-between">
                <span>Search roster, staff, or reports...</span>
                <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-slate-900/80 px-1.5 py-0.5 text-[10px] text-slate-400">
                  <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
                  </svg>
                  K
                </span>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={onSearchOpen}
            className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition-colors hover:bg-white/10"
            aria-label="Open search"
          >
            <Search className="size-4" />
          </button>
          <NotificationBell actorUserId={actor?.userId ?? undefined} />
          <Link
            href="/settings"
            className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
          >
            <Settings className="size-4" />
          </Link>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <Avatar className="size-9 rounded-xl">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold text-white">{fullLabel}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
