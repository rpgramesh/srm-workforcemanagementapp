/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  Message,
  MessageReadReceipt,
  MessagingRepository,
  PolledMessage,
  ThreadSummary,
} from "@/types/messaging";
import { createSupabaseServerClient } from "@/lib/supabase";

function mapMessage(row: any, receipts?: MessageReadReceipt[]): Message {
  const id = row.id ?? row.message_id;
  return {
    id,
    threadId: row.thread_id,
    senderId: row.sender_id ?? null,
    body: row.body,
    metadata: row.metadata ?? {},
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at ?? row.created_at),
    readBy: receipts ? receipts.filter((r) => r.messageId === id) : [],
  };
}

function mapSummary(row: any, participantIdsOverride?: string[]): ThreadSummary {
  const threadId = row.thread_id;
  const lastCreatedAt = new Date(row.last_created_at);
  const participantIds = participantIdsOverride ?? [];
  return {
    id: threadId,
    threadId,
    kind: row.kind,
    title: row.title ?? null,
    lastPreview: row.last_preview ?? null,
    lastCreatedAt,
    lastMessageAt: lastCreatedAt,
    unreadCount: Number(row.unread_count ?? 0),
    lastSenderId: row.last_sender_id ?? null,
    departmentId: row.department_id ?? null,
    participantIds,
    metadata: {
      participantIds,
      raw: row,
    },
  };
}

export class SupabaseMessagingRepository implements MessagingRepository {
  private readonly client = createSupabaseServerClient();

  async ensureDirectThread(userA: string, userB: string): Promise<string> {
    const { data, error } = await this.client.rpc("ensure_direct_thread", {
      p_user_a: userA,
      p_user_b: userB,
    });
    if (error) throw new Error(error.message ?? String(error));
    if (!data) throw new Error("ensure_direct_thread returned no id");
    return data as string;
  }

  async ensureDepartmentThread(departmentId: string, title?: string | null): Promise<string> {
    const { data, error } = await this.client.rpc("ensure_department_thread", {
      p_department_id: departmentId,
      p_title: title ?? null,
    });
    if (error) throw new Error(error.message ?? String(error));
    if (!data) throw new Error("ensure_department_thread returned no id");
    return data as string;
  }

  async listThreadSummaries(userId: string): Promise<ThreadSummary[]> {
    const { data, error } = await this.client.rpc("list_thread_summaries", {
      p_user_id: userId,
    });
    if (error) throw new Error(error.message ?? String(error));
    const sumRows = (Array.isArray(data) ? data : []) as any[];
    // For direct threads, gather participants from thread_participants
    const threadIds = sumRows.map((r) => r.thread_id).filter(Boolean);
    const participantsMap: Map<string, string[]> = new Map();
    if (threadIds.length) {
      const { data: pRows } = await this.client
        .from("thread_participants")
        .select("thread_id, user_id")
        .in("thread_id", threadIds);
      for (const row of (pRows ?? []) as any[]) {
        if (!participantsMap.has(row.thread_id)) participantsMap.set(row.thread_id, []);
        participantsMap.get(row.thread_id)!.push(row.user_id);
      }
    }
    return sumRows.map((r) => {
      const ids = participantsMap.get(r.thread_id) ?? [];
      if (r.kind === "direct" && ids.length === 0) {
        // Fallback for self: include user + maybe one more from context
        ids.push(userId);
      }
      return mapSummary(r, ids);
    });
  }

  async listThreadMessages(threadId: string, limit: number = 100, before: Date | null = null): Promise<Message[]> {
    let query = this.client
      .from("messages")
      .select("*")
      .eq("thread_id", threadId);
    if (before) {
      query = query.lt("created_at", before.toISOString());
    }
    query = query.order("created_at", { ascending: false }).limit(limit);
    const { data, error } = await query;
    if (error) throw new Error(error.message ?? String(error));
    const rows = (data as any[]) ?? [];
    // Collect receipts for returned message IDs
    const receipts: MessageReadReceipt[] = [];
    if (rows.length) {
      const ids = rows.map((r) => r.id);
      const { data: rr } = await this.client
        .from("message_read_receipts")
        .select("message_id, user_id, read_at")
        .in("message_id", ids);
      for (const r of (rr ?? []) as any[]) {
        receipts.push({
          messageId: r.message_id,
          userId: r.user_id,
          readAt: new Date(r.read_at),
        });
      }
    }
    return rows
      .map((r) => mapMessage(r, receipts))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async getThreadParticipants(threadId: string): Promise<Array<{ userId: string; fullName: string | null; color: string | null }>> {
    const { data, error } = await this.client
      .from("thread_participants")
      .select("user_id, users:first_name, users:last_name, users:color")
      .eq("thread_id", threadId);
    if (error) throw new Error(error.message ?? String(error));
    const rows = (data as any[]) ?? [];
    return rows.map((r: any) => ({
      userId: r.user_id,
      fullName: [r.first_name, r.last_name].filter(Boolean).join(" ") || null,
      color: r.color ?? null,
    }));
  }

  async sendMessage(threadId: string, senderId: string, body: string): Promise<string> {
    const { data, error } = await this.client.rpc("send_message", {
      p_thread_id: threadId,
      p_sender_id: senderId,
      p_body: body,
    });
    if (error) throw new Error(error.message ?? String(error));
    if (!data) throw new Error("send_message returned no id");
    return data as string;
  }

  async markThreadReadUntil(threadId: string, userId: string, messageId: string): Promise<number> {
    const { data, error } = await this.client.rpc("mark_thread_read_until", {
      p_thread_id: threadId,
      p_user_id: userId,
      p_message_id: messageId,
    });
    if (error) throw new Error(error.message ?? String(error));
    return Number(data ?? 0);
  }

  async pollNewMessages(userId: string, since: Date): Promise<PolledMessage[]> {
    const { data, error } = await this.client.rpc("poll_new_messages", {
      p_user_id: userId,
      p_since: since.toISOString(),
    });
    if (error) throw new Error(error.message ?? String(error));
    const rows = (data as any[]) ?? [];
    return rows.map((r: any) => ({
      ...mapMessage(r, []),
      senderName: r.sender_name ?? null,
    }));
  }
}

export const messagingRepository: MessagingRepository = new SupabaseMessagingRepository();
