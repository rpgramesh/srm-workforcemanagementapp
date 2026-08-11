"use server";

import type { AppRole } from "@/types/app";
import { getCurrentActor } from "@/lib/server-session";
import type {
  Notification,
  NotificationType,
  NotificationPreferences,
  TypeChannelPreferences,
} from "@/types/platform";

export type NotificationPriority = "info" | "success" | "warning" | "critical";

const NOTIFICATION_TYPES: NotificationType[] = [
  "shift_assigned",
  "shift_updated",
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

const SEED_TEMPLATES: Array<{
  type: NotificationType;
  title: string;
  body: string;
  priority: NotificationPriority;
  actionHref?: string;
  actionLabel?: string;
  minutesAgo: number;
}> = [
  {
    type: "shift_assigned",
    title: "New Shift Assigned",
    body: "You have been scheduled for a dinner shift this Saturday from 5:00 PM to 11:00 PM.",
    priority: "warning",
    actionHref: "/schedule",
    actionLabel: "View Schedule",
    minutesAgo: 12,
  },
  {
    type: "shift_swap_requested",
    title: "Shift Swap Request",
    body: "Sarah Chen wants to swap her Friday lunch shift with your Sunday brunch shift.",
    priority: "info",
    actionHref: "/schedule",
    actionLabel: "Review Swap",
    minutesAgo: 38,
  },
  {
    type: "message_received",
    title: "New Message from Manager",
    body: "Hi team, please review the updated closing procedures before your next shift.",
    priority: "warning",
    actionHref: "/admin/messages",
    actionLabel: "Read Message",
    minutesAgo: 65,
  },
  {
    type: "clock_in_reminder",
    title: "Clock-In Reminder",
    body: "Your shift starts in 30 minutes. Don't forget to clock in when you arrive.",
    priority: "info",
    minutesAgo: 92,
  },
  {
    type: "shift_swap_approved",
    title: "Leave Request Approved",
    body: "Your annual leave request for December 23-27 has been approved by management.",
    priority: "success",
    actionHref: "/staff",
    actionLabel: "View Requests",
    minutesAgo: 120,
  },
  {
    type: "roster_published",
    title: "Weekly Roster Published",
    body: "The roster for next week has been published. Review your scheduled shifts now.",
    priority: "warning",
    actionHref: "/schedule",
    actionLabel: "View Roster",
    minutesAgo: 180,
  },
  {
    type: "payroll_ready",
    title: "Payroll Processed",
    body: "Your payslip for this period is now available. Total hours: 38.5, Gross: $1,347.50.",
    priority: "warning",
    actionLabel: "View Payslip",
    minutesAgo: 360,
  },
  {
    type: "shift_updated",
    title: "Shift Time Updated",
    body: "Your Thursday dinner shift start time has changed from 5:00 PM to 4:30 PM.",
    priority: "info",
    actionHref: "/schedule",
    actionLabel: "Check Shift",
    minutesAgo: 420,
  },
  {
    type: "announcement",
    title: "Staff Meeting Scheduled",
    body: "Mandatory all-staff meeting next Monday at 2:00 PM in the main dining area.",
    priority: "warning",
    minutesAgo: 540,
  },
  {
    type: "system_maintenance",
    title: "New Feature Available",
    body: "You can now request shift swaps directly from the schedule page. Try it today!",
    priority: "info",
    minutesAgo: 1440,
  },
  {
    type: "shift_cancelled",
    title: "Shift Cancelled",
    body: "Your Tuesday lunch shift has been cancelled due to reduced booking volume.",
    priority: "critical",
    actionHref: "/schedule",
    actionLabel: "View Changes",
    minutesAgo: 1920,
  },
  {
    type: "shift_swap_declined",
    title: "Leave Request Declined",
    body: "Unfortunately your leave request for Nov 15-17 was declined. Speak with your manager for alternatives.",
    priority: "critical",
    actionHref: "/staff",
    actionLabel: "View Details",
    minutesAgo: 2880,
  },
];

const DEFAULT_CHANNELS_BY_ROLE: Record<AppRole, Record<NotificationType, TypeChannelPreferences>> =
  (() => {
    const _allOff: TypeChannelPreferences = { in_app: false, push: false, email: false, sms: false };
    const allOn: TypeChannelPreferences = { in_app: true, push: true, email: true, sms: false };
    const inAppOnly: TypeChannelPreferences = { in_app: true, push: false, email: false, sms: false };
    const inAppPush: TypeChannelPreferences = { in_app: true, push: true, email: false, sms: false };
    const inAppEmail: TypeChannelPreferences = { in_app: true, push: false, email: true, sms: false };
    const adminAll: TypeChannelPreferences = { in_app: true, push: true, email: true, sms: true };

    const base: Record<NotificationType, TypeChannelPreferences> =
      NOTIFICATION_TYPES.reduce((acc, t) => {
        acc[t] = { ...inAppOnly };
        return acc;
      }, {} as Record<NotificationType, TypeChannelPreferences>);

    const employeePrefs = { ...base };
    employeePrefs.shift_assigned = { ...inAppPush };
    employeePrefs.shift_updated = { ...inAppPush };
    employeePrefs.shift_cancelled = { ...allOn };
    employeePrefs.shift_swap_requested = { ...inAppPush };
    employeePrefs.shift_swap_approved = { ...inAppPush };
    employeePrefs.shift_swap_declined = { ...inAppPush };
    employeePrefs.clock_in_reminder = { ...inAppPush };
    employeePrefs.roster_published = { ...inAppPush };
    employeePrefs.payroll_ready = { ...inAppEmail };

    const supervisorPrefs = { ...employeePrefs };
    supervisorPrefs.shift_swap_requested = { ...allOn };
    supervisorPrefs.shift_changed = { ...allOn };
    supervisorPrefs.staff_added = { ...inAppPush };
    supervisorPrefs.message_received = { ...inAppPush };

    const managerPrefs = { ...supervisorPrefs };
    managerPrefs.shift_changed = { ...adminAll };
    managerPrefs.shift_swap_requested = { ...adminAll };
    managerPrefs.staff_added = { ...adminAll };
    managerPrefs.staff_role_changed = { ...inAppPush };
    managerPrefs.audit_alert = { ...inAppPush };
    managerPrefs.payroll_ready = { ...inAppEmail };

    const adminPrefs = { ...managerPrefs };
    adminPrefs.audit_alert = { ...adminAll };
    adminPrefs.staff_role_changed = { ...adminAll };
    adminPrefs.system_maintenance = { ...adminAll };
    adminPrefs.announcement = { ...adminAll };

    return {
      employee: employeePrefs,
      supervisor: supervisorPrefs,
      manager: managerPrefs,
      restaurant_admin: adminPrefs,
      super_admin: adminPrefs,
    };
  })();

function defaultPreferencesSync(role: AppRole): NotificationPreferences {
  const channels: NotificationPreferences["channels"] = { ...DEFAULT_CHANNELS_BY_ROLE[role] };
  NOTIFICATION_TYPES.forEach((t) => {
    if (!channels[t]) {
      channels[t] = { in_app: true, push: false, email: false, sms: false };
    }
  });
  return {
    userId: "",
    channels,
    dnd: { enabled: false, from: "22:00", to: "07:00" },
    quietWeekends: false,
    dailySummary: role !== "employee",
  };
}

export async function defaultPreferencesFor(role: AppRole): Promise<NotificationPreferences> {
  return defaultPreferencesSync(role);
}

const notificationsStore = new Map<string, Map<string, Notification>>();
const preferencesStore = new Map<string, NotificationPreferences>();
const seededUsers = new Set<string>();

function _uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function ensureSeeded(userId: string, role: AppRole) {
  if (seededUsers.has(userId)) return;

  const userMap = new Map<string, Notification>();
  const now = Date.now();

  SEED_TEMPLATES.forEach((tpl, idx) => {
    const created = new Date(now - tpl.minutesAgo * 60 * 1000);
    const id = `seed-${userId}-${idx}`;
    const seenAgo = tpl.minutesAgo > 180;
    const readAgo = tpl.minutesAgo > 720;
    userMap.set(id, {
      id,
      userId,
      type: tpl.type,
      title: tpl.title,
      body: tpl.body,
      priority: tpl.priority,
      actionHref: tpl.actionHref ?? null,
      actionLabel: tpl.actionLabel ?? null,
      channel: "in_app",
      createdAt: created,
      seenAt: seenAgo ? new Date(created.getTime() + (tpl.minutesAgo < 300 ? 60000 : 300000)) : null,
      readAt: readAgo ? new Date(created.getTime() + 600000) : null,
      dismissedAt: null,
    });
  });

  notificationsStore.set(userId, userMap);
  seededUsers.add(userId);

  if (!preferencesStore.has(userId)) {
    preferencesStore.set(userId, {
      ...defaultPreferencesSync(role),
      userId,
    });
  }
}

interface _ListOptions {
  limit?: number;
  offset?: number;
  onlyUnread?: boolean;
}

interface ListResult {
  items: Notification[];
  total: number;
  unreadCount: number;
}

export async function listUserNotifications(
  limit: number = 20,
  offset: number = 0,
  onlyUnread: boolean = false,
): Promise<ListResult> {
  const actor = await getCurrentActor();
  if (!actor?.userId) return { items: [], total: 0, unreadCount: 0 };

  ensureSeeded(actor.userId, actor.role);
  const userMap = notificationsStore.get(actor.userId)!;

  let items = Array.from(userMap.values()).filter((n) => !n.dismissedAt);

  const unreadCount = items.filter((n) => !n.readAt).length;

  if (onlyUnread) {
    items = items.filter((n) => !n.readAt);
  }

  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const total = items.length;
  const paginated = items.slice(offset, offset + Math.max(1, limit));

  return {
    items: paginated.map((n) => ({ ...n })),
    total,
    unreadCount,
  };
}

export async function markSeen(id: string): Promise<boolean> {
  const actor = await getCurrentActor();
  if (!actor?.userId) return false;

  ensureSeeded(actor.userId, actor.role);
  const userMap = notificationsStore.get(actor.userId)!;
  const note = userMap.get(id);
  if (!note || note.userId !== actor.userId) return false;
  if (note.seenAt) return true;

  note.seenAt = new Date();
  userMap.set(id, note);
  return true;
}

export async function markAllSeen(): Promise<number> {
  const actor = await getCurrentActor();
  if (!actor?.userId) return 0;

  ensureSeeded(actor.userId, actor.role);
  const userMap = notificationsStore.get(actor.userId)!;
  let count = 0;
  const now = new Date();

  userMap.forEach((note) => {
    if (!note.seenAt && !note.dismissedAt) {
      note.seenAt = now;
      userMap.set(note.id, note);
      count++;
    }
  });

  return count;
}

export async function markRead(id: string): Promise<boolean> {
  const actor = await getCurrentActor();
  if (!actor?.userId) return false;

  ensureSeeded(actor.userId, actor.role);
  const userMap = notificationsStore.get(actor.userId)!;
  const note = userMap.get(id);
  if (!note || note.userId !== actor.userId) return false;
  if (note.readAt) return true;

  const now = new Date();
  note.seenAt = note.seenAt ?? now;
  note.readAt = now;
  userMap.set(id, note);
  return true;
}

export async function markAllRead(): Promise<number> {
  const actor = await getCurrentActor();
  if (!actor?.userId) return 0;

  ensureSeeded(actor.userId, actor.role);
  const userMap = notificationsStore.get(actor.userId)!;
  let count = 0;
  const now = new Date();

  userMap.forEach((note) => {
    if (!note.readAt && !note.dismissedAt) {
      note.seenAt = note.seenAt ?? now;
      note.readAt = now;
      userMap.set(note.id, note);
      count++;
    }
  });

  return count;
}

export async function dismiss(id: string): Promise<boolean> {
  const actor = await getCurrentActor();
  if (!actor?.userId) return false;

  ensureSeeded(actor.userId, actor.role);
  const userMap = notificationsStore.get(actor.userId)!;
  const note = userMap.get(id);
  if (!note || note.userId !== actor.userId) return false;
  if (note.dismissedAt) return true;

  const now = new Date();
  note.seenAt = note.seenAt ?? now;
  note.readAt = note.readAt ?? now;
  note.dismissedAt = now;
  userMap.set(id, note);
  return true;
}

export type PreferencesUpdate = Partial<{
  channels: Partial<Record<NotificationType, Partial<TypeChannelPreferences>>>;
  dnd: Partial<{
    enabled: boolean;
    from: string;
    to: string;
  }>;
  quietWeekends: boolean;
  dailySummary: boolean;
}>;

export async function updatePreferences(prefs: PreferencesUpdate): Promise<NotificationPreferences | null> {
  const actor = await getCurrentActor();
  if (!actor?.userId) return null;

  ensureSeeded(actor.userId, actor.role);
  const existing = preferencesStore.get(actor.userId)!;

  if (prefs.channels) {
    const updatedChannels = { ...existing.channels } as Record<string, TypeChannelPreferences>;
    for (const [typeKey, channelPrefs] of Object.entries(prefs.channels)) {
      if (!channelPrefs) continue;
      const base: TypeChannelPreferences = updatedChannels[typeKey] ?? {
        in_app: true, push: false, email: false, sms: false,
      };
      updatedChannels[typeKey] = {
        in_app: typeof channelPrefs.in_app === "boolean" ? channelPrefs.in_app : base.in_app,
        push: typeof channelPrefs.push === "boolean" ? channelPrefs.push : base.push,
        email: typeof channelPrefs.email === "boolean" ? channelPrefs.email : base.email,
        sms: typeof channelPrefs.sms === "boolean" ? channelPrefs.sms : base.sms,
      };
    }
    existing.channels = updatedChannels;
  }

  if (prefs.dnd) {
    existing.dnd = { ...existing.dnd, ...prefs.dnd };
  }

  if (typeof prefs.quietWeekends === "boolean") {
    existing.quietWeekends = prefs.quietWeekends;
  }

  if (typeof prefs.dailySummary === "boolean") {
    existing.dailySummary = prefs.dailySummary;
  }

  existing.updatedAt = new Date();
  preferencesStore.set(actor.userId, existing);
  return { ...existing };
}

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences | null> {
  const actor = await getCurrentActor();
  if (!actor?.userId) return null;
  ensureSeeded(actor.userId, actor.role);
  const prefs = preferencesStore.get(userId);
  return prefs ? { ...prefs } : null;
}

export async function setNotificationPreferences(userId: string, prefs: NotificationPreferences): Promise<boolean> {
  const actor = await getCurrentActor();
  if (!actor?.userId || actor.userId !== userId) return false;
  ensureSeeded(actor.userId, actor.role);
  preferencesStore.set(userId, { ...prefs, userId, updatedAt: new Date() });
  return true;
}
