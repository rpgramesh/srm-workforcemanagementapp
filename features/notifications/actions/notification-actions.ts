"use server";

import type { AppRole } from "@/types/app";
import { getCurrentActor } from "@/lib/server-session";
import type {
  Notification,
  NotificationType,
  NotificationChannel,
  NotificationPreferences,
  TypeChannelPreferences,
} from "@/types/platform";
import { sb } from "@/features/data/supabase-utils";

type NotifDbRow = {
  id: string | number;
  user_id: string | number;
  type?: string | null;
  title?: string | null;
  body?: string | null;
  channel?: string | null;
  priority?: string | null;
  action_href?: string | null;
  actor_name?: string | null;
  seen_at?: string | null;
  read_at?: string | null;
  dismissed_at?: string | null;
  created_at?: string | null;
};

type PrefsDbRow = {
  channels?: unknown;
  dnd_enabled?: unknown;
  dnd_from?: unknown;
  dnd_to?: unknown;
  quiet_weekends?: unknown;
  summary_daily?: unknown;
  updated_at?: unknown;
  user_id?: unknown;
  created_at?: unknown;
} | null;

export type NotificationPriority = "info" | "success" | "warning" | "critical";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuid(id: string | null | undefined): id is string {
  return typeof id === "string" && UUID_RE.test(id);
}

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
  "shift_changed",
];

const _ALL_CHANNELS: NotificationChannel[] = ["in_app", "push", "email", "sms"];

const DEFAULT_CHANNELS_BY_ROLE: Record<AppRole, Record<string, TypeChannelPreferences>> =
  (() => {
    const _allOff: TypeChannelPreferences = { in_app: false, push: false, email: false, sms: false };
    const allOn: TypeChannelPreferences = { in_app: true, push: true, email: true, sms: false };
    const inAppOnly: TypeChannelPreferences = { in_app: true, push: false, email: false, sms: false };
    const inAppPush: TypeChannelPreferences = { in_app: true, push: true, email: false, sms: false };
    const inAppEmail: TypeChannelPreferences = { in_app: true, push: false, email: true, sms: false };
    const adminAll: TypeChannelPreferences = { in_app: true, push: true, email: true, sms: true };

    const base: Record<string, TypeChannelPreferences> =
      NOTIFICATION_TYPES.reduce((acc, t) => {
        acc[t as string] = { ...inAppOnly };
        return acc;
      }, {} as Record<string, TypeChannelPreferences>);

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

function defaultPreferencesSync(userId: string, role: AppRole): NotificationPreferences {
  const channels: NotificationPreferences["channels"] = { ...DEFAULT_CHANNELS_BY_ROLE[role] };
  NOTIFICATION_TYPES.forEach((t) => {
    if (!channels[t]) {
      channels[t] = { in_app: true, push: false, email: false, sms: false };
    }
  });
  return {
    userId,
    channels,
    dnd: { enabled: false, from: "22:00", to: "07:00" },
    quietWeekends: false,
    dailySummary: role !== "employee",
  };
}

function normaliseChannelsFromDb(raw: unknown, role: AppRole): Record<string, TypeChannelPreferences> {
  const def = defaultPreferencesSync("", role).channels as Record<string, TypeChannelPreferences>;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of Object.keys(def)) {
      const entry = obj[key];
      if (entry && typeof entry === "object") {
        const e = entry as Record<string, unknown>;
        def[key] = {
          in_app: typeof e.in_app === "boolean" ? e.in_app : Array.isArray(e) ? (e as unknown[]).includes("in_app") : def[key].in_app,
          push: typeof e.push === "boolean" ? e.push : Array.isArray(e) ? (e as unknown[]).includes("push") : def[key].push,
          email: typeof e.email === "boolean" ? e.email : Array.isArray(e) ? (e as unknown[]).includes("email") : def[key].email,
          sms: typeof e.sms === "boolean" ? e.sms : Array.isArray(e) ? (e as unknown[]).includes("sms") : def[key].sms,
        };
      }
    }
  }
  return def;
}

export async function defaultPreferencesFor(role: AppRole): Promise<NotificationPreferences> {
  return defaultPreferencesSync("", role);
}

function mapNotif(n: NotifDbRow): Notification {
  const rawType = String(n.type ?? "announcement");
  const type = (NOTIFICATION_TYPES.includes(rawType as NotificationType)
    ? (rawType as NotificationType)
    : "announcement");
  const rawChannel = String(n.channel ?? "in_app");
  const channel: NotificationChannel = rawChannel === "sms" || rawChannel === "email" || rawChannel === "push"
    ? rawChannel
    : "in_app";
  const rawPriority = String(n.priority ?? "info");
  const priority: Notification["priority"] =
    rawPriority === "warning" || rawPriority === "critical" || rawPriority === "success"
      ? rawPriority
      : "info";
  return {
    id: String(n.id),
    userId: String(n.user_id),
    type,
    title: String(n.title ?? ""),
    body: String(n.body ?? ""),
    channel,
    priority,
    actionHref: n.action_href ?? null,
    actionLabel: null,
    actorName: n.actor_name ?? null,
    seenAt: n.seen_at ? new Date(n.seen_at) : null,
    readAt: n.read_at ? new Date(n.read_at) : null,
    dismissedAt: n.dismissed_at ? new Date(n.dismissed_at) : null,
    createdAt: n.created_at ? new Date(n.created_at) : new Date(),
  };
}

interface ListResult {
  items: Notification[];
  total: number;
  unreadCount: number;
}

interface _ListOptions {
  limit?: number;
  offset?: number;
  onlyUnread?: boolean;
}

export async function listUserNotifications(
  limit: number = 20,
  offset: number = 0,
  onlyUnread: boolean = false,
): Promise<ListResult> {
  const actor = await getCurrentActor();
  if (!actor?.userId) return { items: [], total: 0, unreadCount: 0 };
  if (!isUuid(actor.userId)) return { items: [], total: 0, unreadCount: 0 };

  let q = sb()
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("user_id", actor.userId)
    .is("dismissed_at", null)
    .order("created_at", { ascending: false });
  if (onlyUnread) q = q.is("read_at", null);
  const safeLimit = Math.max(1, Math.min(100, limit));
  q = q.range(offset, offset + safeLimit - 1);
  const { data, error, count } = await q;
  if (error) {
    return { items: [], total: 0, unreadCount: 0 };
  }
  const items = (data ?? []).map(mapNotif);
  let unreadCount = count ?? items.length;
  if (!onlyUnread) {
    const { count: unreadOnly } = await sb()
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", actor.userId)
      .is("dismissed_at", null)
      .is("read_at", null);
    unreadCount = unreadOnly ?? 0;
  }
  return {
    items,
    total: count ?? items.length,
    unreadCount,
  };
}

export async function markSeen(id: string): Promise<boolean> {
  const actor = await getCurrentActor();
  if (!actor?.userId) return false;
  if (!isUuid(actor.userId) || !isUuid(id)) return false;
  try {
    const { data } = await sb().rpc("mark_notification_seen", { p_id: id, p_user_id: actor.userId });
    return data === true;
  } catch {
    return false;
  }
}

export async function markAllSeen(): Promise<number> {
  const actor = await getCurrentActor();
  if (!actor?.userId) return 0;
  if (!isUuid(actor.userId)) return 0;
  const now = new Date().toISOString();
  const { count, error } = await sb()
    .from("notifications")
    .update({ seen_at: now })
    .eq("user_id", actor.userId)
    .is("seen_at", null)
    .is("dismissed_at", null);
  if (error) return 0;
  return count ?? 0;
}

export async function markRead(id: string): Promise<boolean> {
  const actor = await getCurrentActor();
  if (!actor?.userId) return false;
  if (!isUuid(actor.userId) || !isUuid(id)) return false;
  try {
    const { data } = await sb().rpc("mark_notification_read", { p_id: id, p_user_id: actor.userId });
    return data === true;
  } catch {
    return false;
  }
}

export async function markAllRead(): Promise<number> {
  const actor = await getCurrentActor();
  if (!actor?.userId) return 0;
  if (!isUuid(actor.userId)) return 0;
  try {
    const { data } = await sb().rpc("mark_all_notifications_read", { p_user_id: actor.userId });
    return typeof data === "number" ? data : 0;
  } catch {
    return 0;
  }
}

export async function dismiss(id: string): Promise<boolean> {
  const actor = await getCurrentActor();
  if (!actor?.userId) return false;
  if (!isUuid(actor.userId) || !isUuid(id)) return false;
  const now = new Date().toISOString();
  const { count, error } = await sb()
    .from("notifications")
    .update({ dismissed_at: now })
    .eq("id", id)
    .eq("user_id", actor.userId);
  if (error) return false;
  return (count ?? 0) > 0;
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

async function ensurePrefsRow(userId: string, _role: AppRole): Promise<void> {
  const { count } = await sb()
    .from("notification_preferences")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((count ?? 0) > 0) return;
  try {
    await sb()
      .from("notification_preferences")
      .insert({ user_id: userId });
  } catch {
    /* ignore — may already exist from trigger/race */
  }
}

export async function updatePreferences(prefs: PreferencesUpdate): Promise<NotificationPreferences | null> {
  const actor = await getCurrentActor();
  if (!actor?.userId) return null;
  if (!isUuid(actor.userId)) return defaultPreferencesSync(actor.userId, actor.role);

  await ensurePrefsRow(actor.userId, actor.role);

  const current = await sb()
    .from("notification_preferences")
    .select("*")
    .eq("user_id", actor.userId)
    .maybeSingle();
  const row = (current.data ?? null) as PrefsDbRow;
  const existingChannels = normaliseChannelsFromDb(row?.channels, actor.role);
  const dnd: NotificationPreferences["dnd"] = {
    enabled: row?.dnd_enabled === true,
    from: typeof row?.dnd_from === "string" ? row.dnd_from : "22:00",
    to: typeof row?.dnd_to === "string" ? row.dnd_to : "07:00",
  };
  let quietWeekends: boolean = row?.quiet_weekends === true;
  let dailySummary: boolean = row?.summary_daily !== false;

  if (prefs.channels) {
    for (const [typeKey, channelPrefs] of Object.entries(prefs.channels)) {
      if (!channelPrefs) continue;
      const base: TypeChannelPreferences = existingChannels[typeKey] ?? {
        in_app: true, push: false, email: false, sms: false,
      };
      existingChannels[typeKey] = {
        in_app: typeof channelPrefs.in_app === "boolean" ? channelPrefs.in_app : base.in_app,
        push: typeof channelPrefs.push === "boolean" ? channelPrefs.push : base.push,
        email: typeof channelPrefs.email === "boolean" ? channelPrefs.email : base.email,
        sms: typeof channelPrefs.sms === "boolean" ? channelPrefs.sms : base.sms,
      };
    }
  }

  if (prefs.dnd) {
    dnd.enabled = typeof prefs.dnd.enabled === "boolean" ? prefs.dnd.enabled : dnd.enabled;
    dnd.from = typeof prefs.dnd.from === "string" ? prefs.dnd.from : dnd.from;
    dnd.to = typeof prefs.dnd.to === "string" ? prefs.dnd.to : dnd.to;
  }
  if (typeof prefs.quietWeekends === "boolean") quietWeekends = prefs.quietWeekends;
  if (typeof prefs.dailySummary === "boolean") dailySummary = prefs.dailySummary;

  const channelsJsonb = Object.keys(existingChannels).reduce((acc, k) => {
    const pref = existingChannels[k]!;
    const chs: string[] = [];
    if (pref.in_app) chs.push("in_app");
    if (pref.push) chs.push("push");
    if (pref.email) chs.push("email");
    if (pref.sms) chs.push("sms");
    (acc as Record<string, string[]>)[k] = chs;
    return acc;
  }, {} as Record<string, string[]>);

  const patch = {
    channels: channelsJsonb,
    dnd_enabled: dnd.enabled,
    dnd_from: dnd.from,
    dnd_to: dnd.to,
    quiet_weekends: quietWeekends,
    summary_daily: dailySummary,
  };
  const { error } = await sb()
    .from("notification_preferences")
    .update(patch)
    .eq("user_id", actor.userId);
  if (error) {
    return {
      userId: actor.userId,
      channels: existingChannels,
      dnd,
      quietWeekends,
      dailySummary,
      updatedAt: new Date(),
    };
  }

  return {
    userId: actor.userId,
    channels: existingChannels,
    dnd,
    quietWeekends,
    dailySummary,
    updatedAt: new Date(),
  };
}

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences | null> {
  const actor = await getCurrentActor();
  if (!actor?.userId) return null;
  if (!isUuid(userId)) {
    return defaultPreferencesSync(userId, actor.role);
  }
  await ensurePrefsRow(userId, actor.role);
  const { data } = await sb()
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const row = (data ?? null) as PrefsDbRow;
  const channels = normaliseChannelsFromDb(row?.channels, actor.role);
  const dnd: NotificationPreferences["dnd"] = {
    enabled: row?.dnd_enabled === true,
    from: typeof row?.dnd_from === "string" ? row.dnd_from : "22:00",
    to: typeof row?.dnd_to === "string" ? row.dnd_to : "07:00",
  };
  return {
    userId,
    channels,
    dnd,
    quietWeekends: row?.quiet_weekends === true,
    dailySummary: row?.summary_daily !== false,
    updatedAt:
      typeof row?.updated_at === "string" ||
      typeof row?.updated_at === "number" ||
      row?.updated_at instanceof Date
        ? new Date(row.updated_at)
        : new Date(),
  };
}

export async function setNotificationPreferences(userId: string, prefs: NotificationPreferences): Promise<boolean> {
  const actor = await getCurrentActor();
  if (!actor?.userId || actor.userId !== userId) return false;
  if (!isUuid(userId)) return false;
  await ensurePrefsRow(userId, actor.role);
  const channelsJsonb = Object.keys(prefs.channels ?? {}).reduce((acc, k) => {
    const pref = (prefs.channels ?? {})[k as NotificationType];
    if (!pref) return acc;
    const chs: string[] = [];
    if (pref.in_app) chs.push("in_app");
    if (pref.push) chs.push("push");
    if (pref.email) chs.push("email");
    if (pref.sms) chs.push("sms");
    (acc as Record<string, string[]>)[k] = chs;
    return acc;
  }, {} as Record<string, string[]>);
  const patch = {
    channels: channelsJsonb,
    dnd_enabled: prefs.dnd?.enabled === true,
    dnd_from: prefs.dnd?.from ?? "22:00",
    dnd_to: prefs.dnd?.to ?? "07:00",
    quiet_weekends: prefs.quietWeekends === true,
    summary_daily: prefs.dailySummary !== false,
  };
  const { error } = await sb()
    .from("notification_preferences")
    .update(patch)
    .eq("user_id", userId);
  return !error;
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  if (!isUuid(userId)) return 0;
  const { count } = await sb()
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("dismissed_at", null)
    .is("read_at", null);
  return count ?? 0;
}
