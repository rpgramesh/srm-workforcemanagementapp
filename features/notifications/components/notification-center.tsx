"use client";

import * as React from "react";
import {
  X,
  Check,
  CheckCheck,
  Settings,
  Bell,
  BellOff,
  Mail,
  MessageCircle,
  Phone,
  Calendar,
  CalendarX2,
  DollarSign,
  Megaphone,
  Clock,
  AlertTriangle,
  UserPlus,
  UserRound,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPast } from "../lib/timeago";
import {
  listUserNotifications,
  markRead,
  markAllRead,
  dismiss,
  updatePreferences,
  getNotificationPreferences,
} from "../actions/notification-actions";
import type { NotificationPriority, PreferencesUpdate } from "../actions/notification-actions";
import type {
  Notification,
  NotificationType,
  NotificationPreferences,
  NotificationChannel,
} from "@/types/platform";

type TabKey = "all" | "unread" | "preferences";

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
  actorUserId?: string;
  anchorRef?: React.RefObject<HTMLElement>;
  onUnreadChange?: (count: number) => void;
}

const PRIORITY_DOT: Record<NotificationPriority, string> = {
  info: "bg-slate-400",
  success: "bg-blue-500",
  warning: "bg-amber-400",
  critical: "bg-rose-500",
};

const PRIORITY_BADGE_TONE: Record<NotificationPriority, "slate" | "emerald" | "amber" | "rose" | "sky"> = {
  info: "slate",
  success: "emerald",
  warning: "amber",
  critical: "rose",
};

const TYPE_ICON: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  shift_assigned: Calendar,
  shift_updated: RefreshCw,
  shift_changed: RefreshCw,
  shift_cancelled: CalendarX2,
  shift_swap_requested: RefreshCw,
  shift_swap_approved: CheckCircle2,
  shift_swap_declined: XCircle,
  roster_published: Calendar,
  clock_in_reminder: Clock,
  clock_in_missed: Clock,
  leave_approved: CheckCircle2,
  leave_declined: XCircle,
  message_received: MessageCircle,
  staff_added: UserPlus,
  staff_role_changed: UserRound,
  audit_alert: AlertTriangle,
  system_maintenance: AlertTriangle,
  announcement: Megaphone,
  payroll_ready: DollarSign,
};

const TYPE_LABELS: Record<NotificationType, string> = {
  shift_assigned: "Shift Assigned",
  shift_updated: "Shift Updated",
  shift_changed: "Shift Changed",
  shift_cancelled: "Shift Cancelled",
  shift_swap_requested: "Shift Swap Request",
  shift_swap_approved: "Swap Approved",
  shift_swap_declined: "Swap Declined",
  roster_published: "Roster Published",
  clock_in_reminder: "Clock-In Reminder",
  clock_in_missed: "Missed Clock-In",
  leave_approved: "Leave Approved",
  leave_declined: "Leave Declined",
  message_received: "New Message",
  staff_added: "Staff Added",
  staff_role_changed: "Staff Role Updated",
  audit_alert: "Audit Alert",
  system_maintenance: "System Maintenance",
  announcement: "Announcement",
  payroll_ready: "Payroll Ready",
};

const CHANNEL_ICON: Record<NotificationChannel, React.ComponentType<{ className?: string }>> = {
  in_app: Bell,
  push: BellOff,
  email: Mail,
  sms: Phone,
};

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  in_app: "In-App",
  push: "Push",
  email: "Email",
  sms: "SMS",
};

const NOTIFICATION_TYPE_ORDER: NotificationType[] = [
  "shift_assigned",
  "shift_updated",
  "shift_changed",
  "shift_cancelled",
  "shift_swap_requested",
  "shift_swap_approved",
  "shift_swap_declined",
  "roster_published",
  "clock_in_reminder",
  "clock_in_missed",
  "leave_approved",
  "leave_declined",
  "message_received",
  "staff_added",
  "staff_role_changed",
  "audit_alert",
  "system_maintenance",
  "announcement",
  "payroll_ready",
];

function ToggleSwitch({
  checked,
  onCheckedChange,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/50 disabled:cursor-not-allowed disabled:opacity-40",
        checked ? "bg-blue-500" : "bg-white/10",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function ChannelToggle({
  channel,
  enabled,
  onChange,
}: {
  channel: NotificationChannel;
  enabled: boolean;
  onChange: (ch: NotificationChannel, value: boolean) => void;
}) {
  const Icon = CHANNEL_ICON[channel];
  return (
    <button
      type="button"
      onClick={() => onChange(channel, !enabled)}
      className={cn(
        "group flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-colors",
        enabled
          ? "border-blue-500/30 bg-blue-500/10 text-blue-700"
          : "border-slate-200 bg-white/5 text-slate-500 hover:border-white/15 hover:bg-white/10",
      )}
    >
      <Icon
        className={cn(
          "size-4 transition-colors",
          enabled ? "text-blue-600" : "text-slate-500 group-hover:text-slate-700",
        )}
      />
      <span className="text-[10px] font-medium tracking-wide">{CHANNEL_LABELS[channel]}</span>
    </button>
  );
}

export function NotificationCenter({
  open,
  onClose,
  actorUserId,
  onUnreadChange,
}: NotificationCenterProps) {
  const [tab, setTab] = React.useState<TabKey>("all");
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [total, setTotal] = React.useState(0);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [preferences, setPreferences] = React.useState<NotificationPreferences | null>(null);
  const [loadingPrefs, setLoadingPrefs] = React.useState(false);
  const [markingAll, setMarkingAll] = React.useState(false);
  const [dismissingIds, setDismissingIds] = React.useState<Set<string>>(new Set());
  const [readingIds, setReadingIds] = React.useState<Set<string>>(new Set());

  const visibleItems = React.useMemo(() => {
    if (tab === "unread") {
      return notifications.filter((n) => !n.readAt && !n.dismissedAt);
    }
    return notifications.filter((n) => !n.dismissedAt);
  }, [notifications, tab]);

  const loadNotifications = React.useCallback(async (onlyUnread = false) => {
    setLoading(true);
    try {
      const result = await listUserNotifications(50, 0, onlyUnread);
      setNotifications(result.items);
      setTotal(result.total);
      setUnreadCount(result.unreadCount);
      onUnreadChange?.(result.unreadCount);
    } finally {
      setLoading(false);
    }
  }, [onUnreadChange]);

  const loadPreferences = React.useCallback(async () => {
    setLoadingPrefs(true);
    try {
      const prefs = await getNotificationPreferences(actorUserId ?? "current-user-seed");
      if (prefs) {
        setPreferences(prefs);
      }
    } finally {
      setLoadingPrefs(false);
    }
  }, [actorUserId]);

  React.useEffect(() => {
    if (open) {
      loadNotifications();
      if (tab === "preferences") {
        loadPreferences();
      }
    }
  }, [open, loadNotifications, loadPreferences, tab]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleMarkAllRead = React.useCallback(async () => {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await markAllRead();
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          readAt: n.readAt ?? new Date(),
          seenAt: n.seenAt ?? new Date(),
        })),
      );
      setUnreadCount(0);
      onUnreadChange?.(0);
    } finally {
      setMarkingAll(false);
    }
  }, [markingAll, onUnreadChange]);

  const handleMarkRead = React.useCallback(
    async (id: string) => {
      if (readingIds.has(id)) return;
      setReadingIds((prev) => new Set(prev).add(id));
      try {
        const ok = await markRead(id);
        if (ok) {
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === id
                ? { ...n, readAt: n.readAt ?? new Date(), seenAt: n.seenAt ?? new Date() }
                : n,
            ),
          );
          setUnreadCount((c) => {
            const next = Math.max(0, c - 1);
            onUnreadChange?.(next);
            return next;
          });
        }
      } finally {
        setReadingIds((prev) => {
          const s = new Set(prev);
          s.delete(id);
          return s;
        });
      }
    },
    [readingIds, onUnreadChange],
  );

  const handleDismiss = React.useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (dismissingIds.has(id)) return;
      setDismissingIds((prev) => new Set(prev).add(id));
      try {
        const ok = await dismiss(id);
        if (ok) {
          setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, dismissedAt: new Date() } : n)),
          );
        }
      } finally {
        setDismissingIds((prev) => {
          const s = new Set(prev);
          s.delete(id);
          return s;
        });
      }
    },
    [dismissingIds],
  );

  const handleToggleChannel = React.useCallback(
    async (type: NotificationType, channel: NotificationChannel, value: boolean) => {
      if (!preferences) return;
      const update: PreferencesUpdate = {
        channels: {
          [type]: { [channel]: value },
        },
      };
      const updated = await updatePreferences(update);
      if (updated) setPreferences(updated);
    },
    [preferences],
  );

  const handleToggleDnd = React.useCallback(async (value: boolean) => {
    if (!preferences) return;
    const updated = await updatePreferences({ dnd: { enabled: value } });
    if (updated) setPreferences(updated);
  }, [preferences]);

  const handleDndTimeChange = React.useCallback(
    async (field: "from" | "to", value: string) => {
      if (!preferences) return;
      const updated = await updatePreferences({ dnd: { [field]: value } });
      if (updated) setPreferences(updated);
    },
    [preferences],
  );

  const handleToggleQuietWeekends = React.useCallback(async (value: boolean) => {
    if (!preferences) return;
    const updated = await updatePreferences({ quietWeekends: value });
    if (updated) setPreferences(updated);
  }, [preferences]);

  const handleToggleDailySummary = React.useCallback(async (value: boolean) => {
    if (!preferences) return;
    const updated = await updatePreferences({ dailySummary: value });
    if (updated) setPreferences(updated);
  }, [preferences]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            key="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Notifications"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280, mass: 0.7 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-slate-50/95 shadow-2xl sm:max-w-lg"
          >
            <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600">
                  <Bell className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
                  <p className="text-[11px] text-slate-500">
                    {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {tab !== "preferences" && unreadCount > 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllRead}
                    disabled={markingAll}
                    icon={markingAll ? undefined : <CheckCheck className="size-3.5" />}
                    className="h-8 px-3 text-[11px]"
                  >
                    {markingAll ? "Marking..." : "All read"}
                  </Button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close notifications"
                  className="ml-1 flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white/5 text-slate-700 hover:bg-white/10"
                >
                  <X className="size-4" />
                </button>
              </div>
            </header>

            <div role="tablist" className="flex gap-1 border-b border-slate-200 px-3 py-2">
              {(["all", "unread", "preferences"] as TabKey[]).map((t) => {
                const active = tab === t;
                const label =
                  t === "all"
                    ? `All${total > 0 ? ` (${visibleItems.length || total})` : ""}`
                    : t === "unread"
                      ? `Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}`
                      : "Preferences";
                const Icon = t === "preferences" ? Settings : undefined;
                return (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setTab(t);
                      if (t === "preferences" && !preferences) loadPreferences();
                    }}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                      active
                        ? "bg-white/10 text-slate-900 shadow-inner"
                        : "text-slate-500 hover:bg-white/5 hover:text-slate-900",
                    )}
                  >
                    {Icon ? <Icon className="size-3.5" /> : null}
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto">
              {tab === "preferences" ? (
                <div className="space-y-6 px-5 py-5">
                  {loadingPrefs ? (
                    <div className="py-12 text-center text-sm text-slate-500">
                    Loading preferences...
                  </div>
                ) : preferences ? (
                    <>
                      <section className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900">Do Not Disturb</h3>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              Suppress notifications during set hours
                            </p>
                          </div>
                          <ToggleSwitch
                            checked={preferences.dnd.enabled}
                            onCheckedChange={handleToggleDnd}
                          />
                        </div>
                        {preferences.dnd.enabled ? (
                          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white/5 p-3">
                            <div>
                              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-500">
                                From
                              </label>
                              <input
                                type="time"
                                value={preferences.dnd.from}
                                onChange={(e) => handleDndTimeChange("from", e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white/60 px-3 py-2 text-xs text-slate-900 focus:border-blue-500/40 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-500">
                                To
                              </label>
                              <input
                                type="time"
                                value={preferences.dnd.to}
                                onChange={(e) => handleDndTimeChange("to", e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white/60 px-3 py-2 text-xs text-slate-900 focus:border-blue-500/40 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                              />
                            </div>
                          </div>
                        ) : null}
                      </section>

                      <section className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900">Quiet Weekends</h3>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              Silence non-urgent alerts on Saturday and Sunday
                            </p>
                          </div>
                          <ToggleSwitch
                            checked={preferences.quietWeekends}
                            onCheckedChange={handleToggleQuietWeekends}
                          />
                        </div>
                      </section>

                      <section className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900">Daily Summary</h3>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              Morning digest of shifts, swaps, and messages
                            </p>
                          </div>
                          <ToggleSwitch
                            checked={preferences.dailySummary}
                            onCheckedChange={handleToggleDailySummary}
                          />
                        </div>
                      </section>

                      <div className="h-px bg-white/10" />

                      <section className="space-y-4">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">Notification Types</h3>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            Choose delivery channels per category
                          </p>
                        </div>
                        <div className="space-y-3">
                          {NOTIFICATION_TYPE_ORDER.map((type) => {
                            const TypeIcon = TYPE_ICON[type];
                            const channels = preferences.channels[type];
                            if (!channels) return null;
                            return (
                              <div
                                key={type}
                                className="rounded-2xl border border-slate-200 bg-white/5 p-3"
                              >
                                <div className="mb-2.5 flex items-center gap-2.5">
                                  <div className="flex size-7 items-center justify-center rounded-lg bg-white/10 text-slate-700">
                                    <TypeIcon className="size-3.5" />
                                  </div>
                                  <span className="text-xs font-medium text-slate-900">
                                    {TYPE_LABELS[type]}
                                  </span>
                                </div>
                                <div className="grid grid-cols-4 gap-1.5">
                                  {(["in_app", "push", "email", "sms"] as NotificationChannel[]).map(
                                    (ch) => (
                                      <ChannelToggle
                                        key={ch}
                                        channel={ch}
                                        enabled={channels[ch]}
                                        onChange={(c, v) => handleToggleChannel(type, c, v)}
                                      />
                                    ),
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    </>
                  ) : (
                    <div className="py-12 text-center text-sm text-slate-500">
                      Unable to load preferences
                    </div>
                  )}
                </div>
              ) : (
                <div className="px-3 py-3">
                  {loading ? (
                    <div className="space-y-2 px-2 py-4">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className="animate-pulse rounded-2xl border border-white/5 bg-white/5 p-3"
                        >
                          <div className="flex gap-3">
                            <div className="size-9 rounded-xl bg-white/10" />
                            <div className="flex-1 space-y-2">
                              <div className="h-3 w-2/3 rounded bg-white/10" />
                              <div className="h-2 rounded bg-white/5" />
                              <div className="h-2 w-1/2 rounded bg-white/5" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : visibleItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
                      <div className="mb-4 flex size-16 items-center justify-center rounded-3xl bg-white/5">
                        <Bell className="size-7 text-slate-500" />
                      </div>
                      <p className="text-sm font-medium text-slate-900">
                        {tab === "unread" ? "No unread notifications" : "No notifications yet"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {tab === "unread"
                          ? "Great job staying on top of things"
                          : "You'll see updates here when they arrive"}
                      </p>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {visibleItems.map((n) => {
                        const TypeIcon = TYPE_ICON[n.type];
                        const isUnread = !n.readAt;
                        const isDismissing = dismissingIds.has(n.id);
                        const isReading = readingIds.has(n.id);
                        return (
                          <li
                            key={n.id}
                            className={cn(
                              "group relative rounded-2xl border transition-colors",
                              isDismissing ? "opacity-40" : "",
                              isUnread
                                ? "border-white/15 bg-white/5"
                                : "border-white/5 bg-white/[0.02]",
                            )}
                          >
                            <div className="flex gap-3 p-3">
                              <div
                                className={cn(
                                  "relative flex size-9 shrink-0 items-center justify-center rounded-xl border",
                                  isUnread
                                    ? "border-blue-500/20 bg-blue-500/10 text-blue-600"
                                    : "border-slate-200 bg-white/5 text-slate-500",
                                )}
                              >
                                <TypeIcon className="size-4" />
                                <span
                                  className={cn(
                                    "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-slate-950",
                                    PRIORITY_DOT[n.priority],
                                  )}
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <h4
                                        className={cn(
                                          "truncate text-[13px] font-semibold leading-tight",
                                          isUnread ? "text-slate-900" : "text-slate-900",
                                        )}
                                      >
                                        {n.title}
                                      </h4>
                                      <Badge
                                        tone={PRIORITY_BADGE_TONE[n.priority]}
                                        size="sm"
                                        className="shrink-0"
                                      >
                                        {n.priority}
                                      </Badge>
                                    </div>
                                    <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-slate-500">
                                      {n.body}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <span className="whitespace-nowrap text-[10px] text-slate-500">
                                      {formatPast(n.createdAt)}
                                    </span>
                                    <button
                                      type="button"
                                      aria-label="Dismiss notification"
                                      onClick={(e) => handleDismiss(n.id, e)}
                                      disabled={isDismissing}
                                      className="ml-1 flex size-7 items-center justify-center rounded-lg text-slate-500 opacity-0 transition hover:bg-white/10 hover:text-slate-900 group-hover:opacity-100 focus:opacity-100"
                                    >
                                      <X className="size-3.5" />
                                    </button>
                                  </div>
                                </div>
                                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                  {n.actionHref ? (
                                    <a
                                      href={n.actionHref}
                                      className="inline-flex items-center gap-1 rounded-lg bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-500/15"
                                    >
                                      {n.actionLabel ?? "View"}
                                      <ChevronRight className="size-3" />
                                    </a>
                                  ) : null}
                                  {!n.readAt ? (
                                    <button
                                      type="button"
                                      onClick={() => handleMarkRead(n.id)}
                                      disabled={isReading}
                                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-white/10 disabled:opacity-60"
                                    >
                                      {isReading ? (
                                        <RefreshCw className="size-3 animate-spin" />
                                      ) : (
                                        <Check className="size-3" />
                                      )}
                                      Mark read
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
