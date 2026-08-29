"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { GlobalSearchModal } from "@/features/search/components/global-search-modal";

const dashboardBackground = "/bgimage_login.jpg";

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  return (
    // <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(220, 227, 228, 0.99),transparent_25%),radial-gradient(circle_at_top_right,rgba(232, 239, 239, 0.94),transparent_28%),linear-gradient(180deg,#020617_0%,#0b1224_40%,#111827_100%)]">
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(220, 227, 228, 0.99),transparent_25%),radial-gradient(circle_at_top_right,rgba(232, 239, 239, 0.94),transparent_28%),linear-gradient(180deg,#020617_0%,#0b1224_40%,#111827_100%)] text-slate-100 font-sans">
      <div
        className="fixed inset-0 bg-cover bg-center opacity-30 pointer-events-none"
        style={{ backgroundImage: `url(${dashboardBackground})` }}
      />
      {/* <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md pointer-events-none" /> */}
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        <div className="hidden lg:block">
          <Sidebar role={actor?.role} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar title={title} subtitle={subtitle} actor={actor} onSearchOpen={openSearch} onMenuOpen={() => setMobileNavOpen(true)} />
          <div className="min-h-[calc(100vh-4rem)] flex-1 border-r border-slate-800/80 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">{children}</div>
        </div>
      </div>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          />
          <div className="relative h-full w-[min(18rem,86vw)] shadow-2xl shadow-black/50">
            <Sidebar role={actor?.role} onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      ) : null}

      <GlobalSearchModal open={searchOpen} onClose={closeSearch} />
    </div>
  );
}
