import { auditLogRepository } from "@/features/audit/repositories/supabase-audit-log-repository";
import type { AuditLogRepository } from "@/types/audit";
import type { AuditAction, AuditLogRecord } from "@/types/audit";

export interface AuditLogServiceLike {
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

export class AuditLogService implements AuditLogServiceLike {
  constructor(private readonly repo: AuditLogRepository = auditLogRepository) {}

  append(
    action: AuditAction,
    opts: {
      actorUserId?: string | null;
      targetUserId?: string | null;
      targetThreadId?: string | null;
      departmentId?: string | null;
      details?: Record<string, unknown>;
      clientIp?: string | null;
      userAgent?: string | null;
    } = {},
  ): Promise<string> {
    const safeDetails: Record<string, unknown> = { ...(opts.details ?? {}) };
    for (const secret of ["pin", "pin_hash", "password", "password_hash", "token", "api_key"]) {
      if (secret in safeDetails) safeDetails[secret] = "[REDACTED]";
    }
    return this.repo.append(action, { ...opts, details: safeDetails });
  }

  listForTarget(targetUserId: string, limit: number = 100): Promise<AuditLogRecord[]> {
    return this.repo.listForTarget(targetUserId, limit);
  }
}

export const auditLogService: AuditLogServiceLike = new AuditLogService();
