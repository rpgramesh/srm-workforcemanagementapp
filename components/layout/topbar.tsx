"use client";

import Link from "next/link";
import { Menu, Search, Settings } from "lucide-react";
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
  onMenuOpen?: () => void;
}

export function Topbar({ title, subtitle, actor, onSearchOpen, onMenuOpen }: TopbarProps) {
  const fullLabel = actor ? formatUserLabel(actor) : "Admin User (Floor Manager)";
  const initials = actor ? initialsFromName(actor) : "AU";

  return (
    <header className="sticky top-0 z-30 flex flex-col gap-0 border-b border-white/[0.07] bg-[#060d1f]/85 px-3 sm:px-6 lg:px-8 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2.5 sm:gap-4 py-3 sm:py-4">
        {/* Title */}
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={onMenuOpen}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:border-white/[0.14] hover:bg-white/[0.07] hover:text-white lg:hidden active:scale-95"
            aria-label="Open navigation"
          >
            <Menu className="size-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold tracking-[-0.03em] text-white truncate">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-[11px] sm:text-xs text-slate-400 truncate max-w-[200px] sm:max-w-md mt-0.5">{subtitle}</p>
            ) : null}
          </div>
        </div>

        {/* Right controls */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          {/* Search bar (desktop) */}
          <button
            type="button"
            onClick={onSearchOpen}
            className="group relative hidden lg:flex items-center h-9 w-60 gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-slate-500 transition-all hover:border-white/[0.14] hover:bg-white/[0.07] hover:text-slate-400"
          >
            <Search className="size-3.5 flex-shrink-0" />
            <span className="flex-1 text-left text-xs">Search roster, staff...</span>
            <span className="inline-flex items-center gap-0.5 rounded-md border border-white/[0.1] bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
              <svg className="size-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
              </svg>
              K
            </span>
          </button>

          {/* Search icon (mobile) */}
          <button
            type="button"
            onClick={onSearchOpen}
            className="flex size-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-400 transition-all hover:border-white/[0.14] hover:bg-white/[0.07] hover:text-slate-200 lg:hidden"
            aria-label="Open search"
          >
            <Search className="size-4" />
          </button>

          {/* Notifications */}
          <div className="flex size-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-400 transition-all hover:border-white/[0.14] hover:bg-white/[0.07] hover:text-slate-200">
            <NotificationBell actorUserId={actor?.userId ?? undefined} />
          </div>

          {/* Settings */}
          <Link
            href="/settings"
            className="flex size-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-400 transition-all hover:border-white/[0.14] hover:bg-white/[0.07] hover:text-slate-200"
          >
            <Settings className="size-4" />
          </Link>

          {/* User pill */}
          <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 transition-all hover:border-white/[0.14] hover:bg-white/[0.07] sm:px-3">
            <Avatar className="size-7 rounded-lg">
              <AvatarFallback className="rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 text-[10px] font-bold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold text-slate-200 leading-tight">{fullLabel}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
