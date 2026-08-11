import type { AppRole } from "@/types/app";

export type SearchModuleId =
  | "staff"
  | "shifts"
  | "messages"
  | "audit_logs"
  | "departments"
  | "payroll"
  | "roster";

export interface SearchHit {
  id: string;
  module: SearchModuleId;
  title: string;
  subtitle: string;
  href: string;
  score: number;
  meta?: Record<string, unknown>;
}

export interface AdvancedSearchFilters {
  query?: string;
  modules?: SearchModuleId[];
  role?: AppRole | null;
  departmentId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  onlyActive?: boolean | null;
  limit?: number;
  offset?: number;
}

export type NotificationChannel = "in_app" | "push" | "email" | "sms";

export type NotificationType =
  | "shift_assigned"
  | "shift_updated"
  | "shift_changed"
  | "shift_cancelled"
  | "shift_swap_requested"
  | "shift_swap_approved"
  | "shift_swap_declined"
  | "roster_published"
  | "clock_in_reminder"
  | "clock_in_missed"
  | "leave_approved"
  | "leave_declined"
  | "message_received"
  | "staff_added"
  | "staff_role_changed"
  | "audit_alert"
  | "system_maintenance"
  | "announcement"
  | "payroll_ready";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  channel: NotificationChannel;
  readAt: Date | null;
  seenAt: Date | null;
  dismissedAt: Date | null;
  actionHref?: string | null;
  actionLabel?: string | null;
  actorName?: string | null;
  priority: "info" | "warning" | "critical" | "success";
  createdAt: Date;
}

export interface TypeChannelPreferences {
  in_app: boolean;
  push: boolean;
  email: boolean;
  sms: boolean;
}

export interface NotificationPreferences {
  userId: string;
  channels: Partial<Record<NotificationType, TypeChannelPreferences>>;
  dnd: {
    enabled: boolean;
    from: string;
    to: string;
  };
  quietWeekends: boolean;
  dailySummary: boolean;
  updatedAt?: Date;
}
