"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BadgeDollarSign,
  CalendarDays,
  CircleHelp,
  LayoutGrid,
  LogOut,
  Timer,
  Users,
} from "lucide-react";
import { clsx } from "clsx";
import { buttonVariants } from "@/components/ui/button";
import { unreadCount } from "@/features/messaging/actions/messaging-actions";
import { logout } from "@/features/auth/actions/login-action";
import { toast } from "sonner";
import type { AppRole } from "@/types/app";
import {
  isAdminDashboardRole,
  isSupervisorDashboardRole,
  isStaffPortalRole,
} from "@/types/user";

export interface SidebarProps {
  role?: AppRole | null;
  onNavigate?: () => void;
}

function buildNavigation(role: AppRole | null | undefined) {
  const r: Array<{
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: boolean;
  }> = [];
  if (isAdminDashboardRole(role as AppRole)) {
    r.push({ label: "Dashboard", href: "/admin/dashboard", icon: LayoutGrid });
  }
  if (isAdminDashboardRole(role as AppRole) || isSupervisorDashboardRole(role as AppRole)) {
    r.push({ label: "Schedules", href: "/admin/schedule", icon: CalendarDays });
  }
  if (isStaffPortalRole(role as AppRole) && !isSupervisorDashboardRole(role as AppRole)) {
    r.push({ label: "My Roster", href: "/schedule", icon: CalendarDays });
  }
  if (isAdminDashboardRole(role as AppRole)) {
    r.push({ label: "Staff", href: "/admin/staff", icon: Users });
  }
  if (isAdminDashboardRole(role as AppRole) || isSupervisorDashboardRole(role as AppRole)) {
    r.push({ label: "Payroll", href: "/admin/payroll", icon: BadgeDollarSign });
  }
  // r.push({ label: "Messages", href: "/admin/messages", icon: MessageSquare, badge: true });
  return r;
}

export function Sidebar({ role, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [messagesUnread, setMessagesUnread] = useState(0);
  const navigation = buildNavigation(role);

  useEffect(() => {
    (async () => {
      try {
        setMessagesUnread(await unreadCount());
      } catch {
        /* ignore */
      }
    })();
    const t = setInterval(async () => {
      try {
        setMessagesUnread(await unreadCount());
      } catch {
        /* ignore */
      }
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  const onLogout = async () => {
    try {
      await logout();
      toast.success("Signed out");
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Sign-out failed");
    }
  };

  return (
    <aside className="flex h-full w-72 flex-col gap-8 border-r border-white/[0.07] bg-[#070e1c]/95 px-5 py-8 backdrop-blur-xl">
      {/* Logo */}
      <div className="space-y-1 px-1">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-[0_4px_12px_rgba(59,130,246,0.4)] text-white">
            <Timer className="size-5" />
          </div>
          <div>
            <p className="text-[15px] font-bold tracking-[-0.03em] text-white">
            Noodle Box</p>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
              Management
            </p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/[0.06] -mx-5" />

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
          Navigation
        </p>
        {navigation.map((item) => {
          const active =
            pathname === item.href || (item.href !== "/admin/dashboard" && pathname?.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={clsx(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-blue-600/15 text-blue-300 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.2)]"
                  : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200",
              )}
            >
              <div className={clsx(
                "flex size-7 items-center justify-center rounded-lg transition-all",
                active
                  ? "bg-blue-500/20 text-blue-300"
                  : "bg-white/[0.04] text-slate-500 group-hover:bg-white/[0.07] group-hover:text-slate-300",
              )}>
                <Icon className="size-3.5" />
              </div>
              <span className="flex-1">{item.label}</span>
              {item.badge && messagesUnread > 0 ? (
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white shadow">
                  {messagesUnread > 99 ? "99+" : messagesUnread}
                </span>
              ) : null}
              {active ? (
                <span className="h-4 w-0.5 rounded-full bg-blue-400" />
              ) : null}
            </Link>
          );
        })}

        <div className="space-y-3">
          <Link
            href="/clock-in"
            onClick={onNavigate}
            className={clsx(
              buttonVariants({ variant: "primary", size: "md" }),
              "w-full justify-between rounded-xl",
            )}
          >
            <span className="flex items-center gap-2">
              <Timer className="size-4" />
              Clock In / Out
            </span>
            <span className="rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em]">
              Terminal
            </span>
          </Link>

          <div className="h-px bg-white/[0.06]" />

          <div className="flex items-center justify-between gap-3 px-1 text-xs text-slate-600">
            <button className="flex items-center gap-2 transition-colors hover:text-slate-300" type="button">
              <CircleHelp className="size-3.5" />
              Support
            </button>
            <button
              className="rounded-md bg-white/15 px-2 py-0.5 text-[12px] font-bold uppercase tracking-[0.15em]"
              type="button"
              onClick={onLogout}
            >
              <LogOut className="text-red-400/60" />
              Logout
            </button>
          </div>
        </div>

      </nav>

      {/* Bottom Actions */}

    </aside>
  );
}
