"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { GlobalSearchModal } from "@/features/search/components/global-search-modal";

interface DashboardChromeProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actor?: {
    fullName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    role?: import("@/types/app").AppRole | null;
    userId?: string | null;
  };
}

export function DashboardChrome({ title, subtitle, children, actor }: DashboardChromeProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((s) => !s);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_25%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_28%),linear-gradient(180deg,#020617_0%,#0b1224_40%,#111827_100%)]">
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar title={title} subtitle={subtitle} actor={actor} onSearchOpen={openSearch} />
          <div className="flex-1 px-6 py-8 lg:px-10">{children}</div>
        </div>
      </div>
      <GlobalSearchModal open={searchOpen} onClose={closeSearch} />
    </div>
  );
}
