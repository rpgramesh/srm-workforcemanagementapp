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
  MessageSquare,
  Timer,
  Users,
} from "lucide-react";
import { clsx } from "clsx";
import { buttonVariants } from "@/components/ui/button";
import { unreadCount } from "@/features/messaging/actions/messaging-actions";
import { logout } from "@/features/auth/actions/login-action";
import { toast } from "sonner";

const navigation = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutGrid },
  { label: "Schedules", href: "/admin/schedule", icon: CalendarDays },
  { label: "Staff", href: "/admin/staff", icon: Users },
  { label: "Payroll", href: "/admin/payroll", icon: BadgeDollarSign },
  { label: "Messages", href: "/admin/messages", icon: MessageSquare, badge: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [messagesUnread, setMessagesUnread] = useState(0);

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
    <aside className="flex h-full w-72 flex-col gap-8 border-r border-white/5 bg-slate-950/80 px-6 py-8 backdrop-blur">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-200">
            <Timer className="size-5" />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-[-0.03em] text-white">
              ShiftMaster
            </p>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
              Roster & Workforce
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-2">
        {navigation.map((item) => {
          const active =
            pathname === item.href || (item.href !== "/admin/dashboard" && pathname?.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-300 transition-colors",
                active
                  ? "bg-emerald-400/12 text-emerald-100 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.22)]"
                  : "hover:bg-white/5 hover:text-slate-100",
              )}
            >
              <Icon className="size-4 text-current/70" />
              <span className="flex-1">{item.label}</span>
              {item.badge && messagesUnread > 0 ? (
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white shadow">
                  {messagesUnread > 99 ? "99+" : messagesUnread}
                </span>
              ) : null}
              {active ? (
                <span className="h-6 w-1 rounded-full bg-emerald-300/70" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3">
        <Link
          href="/clock-in"
          className={clsx(
            buttonVariants({ variant: "primary", size: "md" }),
            "w-full justify-between",
          )}
        >
          <span className="flex items-center gap-3">
            <Timer className="size-4" />
            Clock In/Out
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.2em]">
            Terminal
          </span>
        </Link>

        <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
          <button className="flex items-center gap-2 hover:text-slate-200" type="button">
            <CircleHelp className="size-4" />
            Support
          </button>
          <button
            className="flex items-center gap-2 hover:text-rose-300"
            type="button"
            onClick={onLogout}
          >
            <LogOut className="size-4" />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
