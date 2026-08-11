"use client";

import * as React from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationCenter } from "./notification-center";

interface NotificationBellProps {
  actorUserId?: string;
  className?: string;
  initialUnreadCount?: number;
}

export function NotificationBell({
  actorUserId,
  className,
  initialUnreadCount = 0,
}: NotificationBellProps) {
  const [open, setOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(initialUnreadCount);
  const bellRef = React.useRef<HTMLButtonElement>(null);

  const handleToggle = React.useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const handleClose = React.useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <>
      <button
        ref={bellRef}
        type="button"
        onClick={handleToggle}
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
        className={cn(
          "relative flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
          className,
        )}
      >
        <Bell className={cn("size-4", open ? "text-white" : "")} />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-[0_0_0_2px_rgba(2,6,23,1)]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      <NotificationCenter
        open={open}
        onClose={handleClose}
        actorUserId={actorUserId}
        anchorRef={bellRef as React.RefObject<HTMLElement>}
        onUnreadChange={setUnreadCount}
      />
    </>
  );
}
