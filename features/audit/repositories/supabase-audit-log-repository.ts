/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AuditLogRepository, AuditLogRecord, AuditAction } from "@/types/audit";
import { createSupabaseServerClient } from "@/lib/supabase";

function mapRow(row: any): AuditLogRecord {
  return {
    id: row.id,
    action: row.action as AuditAction,
    actorUserId: row.actor_user_id ?? null,
    targetUserId: row.target_user_id ?? null,
    targetThreadId: row.target_thread_id ?? null,
    departmentId: row.department_id ?? null,
    details: row.details ?? {},
    clientIp: row.client_ip ?? null,
    userAgent: row.user_agent ?? null,
    createdAt: new Date(row.created_at),
  };
}

export class SupabaseAuditLogRepository implements AuditLogRepository {
  private readonly client = createSupabaseServerClient();

  async append(
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
  ): Promise<string> {
    const { data, error } = await this.client.rpc("append_audit_log", {
      p_action: action,
      p_actor_user_id: opts?.actorUserId ?? null,
      p_target_user_id: opts?.targetUserId ?? null,
      p_target_thread_id: opts?.targetThreadId ?? null,
      p_department_id: opts?.departmentId ?? null,
      p_details: (opts?.details ?? {}) as any,
      p_client_ip: opts?.clientIp ?? null,
      p_user_agent: opts?.userAgent ?? null,
    });
    if (error) throw new Error(error.message ?? String(error));
    if (!data) throw new Error("append_audit_log returned no id");
    return data as string;
  }

  async listForTarget(targetUserId: string, limit: number = 100): Promise<AuditLogRecord[]> {
    const { data, error } = await this.client
      .from("audit_logs")
      .select("*")
      .eq("target_user_id", targetUserId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message ?? String(error));
    const rows = (data as any[]) ?? [];
    return rows.map(mapRow);
  }
}

export const auditLogRepository: AuditLogRepository = new SupabaseAuditLogRepository();
