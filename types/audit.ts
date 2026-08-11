export type AuditAction =
  | "staff_created"
  | "staff_updated"
  | "staff_deleted"
  | "message_sent"
  | "message_read"
  | "filter_preset_saved"
  | "filter_preset_deleted"
  | "login_success"
  | "login_failure"
  | "logout"
  | "clock_in"
  | "clock_out"
  | "permission_changed"
  | "pin_changed";

export interface AuditLogRecord {
  id: string;
  action: AuditAction;
  actorUserId: string | null;
  targetUserId: string | null;
  targetThreadId: string | null;
  departmentId: string | null;
  details: Record<string, unknown>;
  clientIp: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface AuditLogRepository {
  append(
    action: AuditAction,
    opts?: {
      actorUserId?: string | null;
      targetUserId?: string | null;
      targetThreadId?: string | null;
      departmentId?: string | null;
      details?: Record<string, unknown>;
      clientIp?: string | null;
      userAgent?: string | null;
    },
  ): Promise<string>;
  listForTarget(targetUserId: string, limit?: number): Promise<AuditLogRecord[]>;
}
