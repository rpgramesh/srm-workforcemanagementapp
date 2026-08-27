"use server";

import { z } from "zod";
import { messagingService } from "@/features/messaging/services/messaging-service";
import type { MessagingResult } from "@/features/messaging/services/messaging-service";
import type { Message, PolledMessage, ThreadSummary } from "@/types/messaging";
import { getCurrentActor } from "@/lib/server-session";

const DirectMessageSchema = z.object({
  recipientId: z.string().uuid(),
  body: z.string().min(1).max(4000),
});

const BroadcastSchema = z.object({
  departmentId: z.string().uuid(),
  body: z.string().min(1).max(4000),
});

export async function listInbox(): Promise<ThreadSummary[]> {
  const actor = await getCurrentActor();
  return messagingService.listInbox({ userId: actor?.userId ?? null, role: actor?.role ?? null });
}

export async function loadThread(threadId: string, limit: number = 100): Promise<MessagingResult<{ messages: Message[]; thread: ThreadSummary | null }>> {
  const actor = await getCurrentActor();
  if (!actor?.userId) return { success: false, message: "Sign in required" };
  return messagingService.loadThread({ userId: actor.userId, role: actor.role }, threadId, limit);
}

export async function sendDirect(raw: unknown): Promise<MessagingResult<string> & { zodErrors?: z.ZodIssue[] }> {
  const actor = await getCurrentActor();
  if (!actor?.userId) return { success: false, message: "Sign in required" };
  const parsed = DirectMessageSchema.safeParse(raw);
  if (!parsed.success) return { success: false, message: "Invalid message", zodErrors: parsed.error.issues };
  return messagingService.sendDirect(
    { userId: actor.userId, role: actor.role },
    parsed.data.recipientId,
    parsed.data.body,
  );
}

export async function broadcastDepartment(raw: unknown): Promise<MessagingResult<string> & { zodErrors?: z.ZodIssue[] }> {
  const actor = await getCurrentActor();
  if (!actor?.userId) return { success: false, message: "Sign in required" };
  const parsed = BroadcastSchema.safeParse(raw);
  if (!parsed.success) return { success: false, message: "Invalid broadcast", zodErrors: parsed.error.issues };
  return messagingService.broadcastToDepartment(
    { userId: actor.userId, role: actor.role },
    parsed.data.departmentId,
    parsed.data.body,
  );
}

export async function markThreadRead(threadId: string, upToMessageId: string): Promise<MessagingResult<number>> {
  const actor = await getCurrentActor();
  if (!actor?.userId) return { success: false, message: "Sign in required" };
  return messagingService.markThreadRead(
    { userId: actor.userId, role: actor.role },
    threadId,
    upToMessageId,
  );
}

export async function pollMessages(sinceIso: string): Promise<PolledMessage[]> {
  const actor = await getCurrentActor();
  if (!actor?.userId) return [];
  const d = new Date(sinceIso);
  if (Number.isNaN(d.getTime())) return [];
  return messagingService.poll({ userId: actor.userId, role: actor.role }, d);
}

export async function unreadCount(): Promise<number> {
  const actor = await getCurrentActor();
  const timeout = new Promise<number>((resolve) => setTimeout(() => resolve(0), 7500));
  try {
    const result = await Promise.race([
      messagingService.unreadCount({ userId: actor?.userId ?? null, role: actor?.role ?? null }),
      timeout,
    ]);
    return typeof result === "number" && Number.isFinite(result) ? result : 0;
  } catch {
    return 0;
  }
}
