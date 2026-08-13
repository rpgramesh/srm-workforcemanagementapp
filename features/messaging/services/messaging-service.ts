import { messagingRepository } from "@/features/messaging/repositories/supabase-messaging-repository";
import type { MessagingRepository } from "@/types/messaging";
import type {
  Message,
  PolledMessage,
  ThreadSummary,
} from "@/types/messaging";
import type { AppRole } from "@/types/app";
import { canManageStaff } from "@/types/user";
import { auditLogService, type AuditLogServiceLike } from "@/features/audit/services/audit-log-service";
import { userRepository } from "@/features/users/repositories/supabase-user-repository";
import type { UserRepository } from "@/features/users/repositories/user-repository";

export interface MessagingResult<T> {
  success: boolean;
  message: string;
  description?: string;
  data?: T;
  issues?: Record<string, string[]>;
}

export class MessagingService {
  constructor(
    private readonly messages: MessagingRepository = messagingRepository,
    private readonly users: UserRepository = userRepository,
    private readonly audit: AuditLogServiceLike = auditLogService,
  ) {}

  private async tryAudit(action: Parameters<AuditLogServiceLike["append"]>[0], opts: Parameters<AuditLogServiceLike["append"]>[1]) {
    try { await this.audit.append(action, opts); } catch { /* audit is non-blocking for send/read flows */ }
  }

  private requireAuthenticated(actor: { userId: string | null; role: AppRole | null }): { ok: boolean; message: string; description?: string } {
    if (!actor.userId) return { ok: false, message: "Sign in required", description: "You must be signed in to send or read messages." };
    return { ok: true, message: "ok" };
  }

  private validateBody(body: string): string | null {
    const clean = body?.trim() ?? "";
    if (clean.length === 0) return "Message cannot be empty";
    if (clean.length > 4000) return "Message is too long (max 4000 characters)";
    return null;
  }

  async listInbox(actor: { userId: string | null; role: AppRole | null }): Promise<ThreadSummary[]> {
    const authz = this.requireAuthenticated(actor);
    if (!authz.ok) return [];
    const summaries = await this.messages.listThreadSummaries(actor.userId!);
    const withParticipants: ThreadSummary[] = [];
    for (const s of summaries) {
      if (s.kind === "direct") {
        try {
          const ps = await this.messages.getThreadParticipants(s.threadId);
          s.participants = ps.map((p) => ({ userId: p.userId, fullName: p.fullName }));
        } catch {
          // participant fetch is non-critical
        }
      }
      withParticipants.push(s);
    }
    return withParticipants;
  }

  async loadThread(actor: { userId: string | null; role: AppRole | null }, threadId: string, limit: number = 100): Promise<MessagingResult<{ messages: Message[]; thread: ThreadSummary | null }>> {
    const authz = this.requireAuthenticated(actor);
    if (!authz.ok) return { success: false, message: authz.message, description: authz.description };
    try {
      const summaries = await this.messages.listThreadSummaries(actor.userId!);
      const thread = summaries.find((s) => s.threadId === threadId) ?? null;
      if (!thread) return { success: false, message: "Conversation not found", description: "You are not a participant of this conversation." };
      const messages = await this.messages.listThreadMessages(threadId, limit);
      if (messages.length > 0) {
        const last = messages[messages.length - 1]!;
        await this.messages.markThreadReadUntil(threadId, actor.userId!, last.id);
      }
      return { success: true, message: "ok", data: { messages, thread } };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load conversation";
      return { success: false, message: "Could not load conversation", description: message };
    }
  }

  async sendDirect(
    actor: { userId: string; role: AppRole | null },
    recipientId: string,
    body: string,
  ): Promise<MessagingResult<string>> {
    const authz = this.requireAuthenticated(actor);
    if (!authz.ok) return { success: false, message: authz.message, description: authz.description };
    if (recipientId === actor.userId) return { success: false, message: "Recipient required", description: "You cannot send a message to yourself." };
    const validation = this.validateBody(body);
    if (validation) return { success: false, message: validation };

    try {
      const recipient = await this.users.findById(recipientId);
      if (!recipient || !recipient.isActive) {
        return { success: false, message: "Recipient not found", description: "The staff member you're messaging does not exist or is no longer active." };
      }
      const threadId = await this.messages.ensureDirectThread(actor.userId, recipientId);
      const messageId = await this.messages.sendMessage(threadId, actor.userId, body);
      await this.tryAudit("message_sent", {
        actorUserId: actor.userId,
        targetUserId: recipientId,
        targetThreadId: threadId,
        details: { kind: "direct", messageLength: body.length },
      });
      return { success: true, message: "Message sent", data: messageId };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send message";
      return { success: false, message: "Could not send message", description: message };
    }
  }

  async broadcastToDepartment(
    actor: { userId: string; role: AppRole | null },
    departmentId: string,
    body: string,
  ): Promise<MessagingResult<string>> {
    const authz = this.requireAuthenticated(actor);
    if (!authz.ok) return { success: false, message: authz.message, description: authz.description };
    if (!actor.role || !canManageStaff(actor.role)) {
      return {
        success: false,
        message: "Only managers can send department broadcasts",
        description: "If you need to reach the team, speak with your shift supervisor.",
      };
    }
    const validation = this.validateBody(body);
    if (validation) return { success: false, message: validation };

    try {
      const threadId = await this.messages.ensureDepartmentThread(departmentId);
      const messageId = await this.messages.sendMessage(threadId, actor.userId, body);
      await this.tryAudit("message_sent", {
        actorUserId: actor.userId,
        departmentId,
        targetThreadId: threadId,
        details: { kind: "department_broadcast", messageLength: body.length },
      });
      return { success: true, message: "Broadcast sent", data: messageId };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send broadcast";
      return { success: false, message: "Could not send broadcast", description: message };
    }
  }

  async markThreadRead(
    actor: { userId: string; role: AppRole | null },
    threadId: string,
    upToMessageId: string,
  ): Promise<MessagingResult<number>> {
    const authz = this.requireAuthenticated(actor);
    if (!authz.ok) return { success: false, message: authz.message, description: authz.description };
    try {
      const n = await this.messages.markThreadReadUntil(threadId, actor.userId, upToMessageId);
      if (n > 0) {
        await this.tryAudit("message_read", {
          actorUserId: actor.userId,
          targetThreadId: threadId,
          details: { marked: n, upToMessageId },
        });
      }
      return { success: true, message: n > 0 ? `Marked ${n} message${n === 1 ? "" : "s"} as read` : "Nothing new to mark", data: n };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to mark as read";
      return { success: false, message: "Could not mark messages as read", description: message };
    }
  }

  async poll(actor: { userId: string; role: AppRole | null }, since: Date): Promise<PolledMessage[]> {
    const authz = this.requireAuthenticated(actor);
    if (!authz.ok) return [];
    try {
      return await this.messages.pollNewMessages(actor.userId, since);
    } catch {
      return [];
    }
  }

  async unreadCount(actor: { userId: string | null; role: AppRole | null }): Promise<number> {
    if (!actor.userId) return 0;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(actor.userId)) return 0;
    try {
      const summaries = await this.messages.listThreadSummaries(actor.userId);
      return summaries.reduce((sum, s) => sum + (s.unreadCount ?? 0), 0);
    } catch {
      return 0;
    }
  }
}

export const messagingService = new MessagingService();
