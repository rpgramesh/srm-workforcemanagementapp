export type ThreadKind = "direct" | "department" | "group";

export interface MessageThread {
  id: string;
  kind: ThreadKind;
  title: string | null;
  departmentId: string | null;
  createdBy: string | null;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageReadReceipt {
  messageId: string;
  userId: string;
  readAt: Date;
}

export interface Message {
  id: string;
  threadId: string;
  senderId: string | null;
  body: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  readBy?: MessageReadReceipt[];
}

export interface ThreadSummary {
  id: string;
  threadId: string;
  kind: ThreadKind;
  title: string | null;
  lastPreview: string | null;
  lastCreatedAt: Date;
  lastMessageAt: Date;
  unreadCount: number;
  lastSenderId: string | null;
  departmentId: string | null;
  participants?: Array<{ userId: string; fullName: string | null }>;
  participantIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface PolledMessage extends Message {
  senderName: string | null;
}

export interface MessagingRepository {
  ensureDirectThread(userA: string, userB: string): Promise<string>;
  ensureDepartmentThread(departmentId: string, title?: string | null): Promise<string>;
  listThreadSummaries(userId: string): Promise<ThreadSummary[]>;
  listThreadMessages(threadId: string, limit?: number, before?: Date | null): Promise<Message[]>;
  getThreadParticipants(threadId: string): Promise<Array<{ userId: string; fullName: string | null; color: string | null }>>;
  sendMessage(threadId: string, senderId: string, body: string): Promise<string>;
  markThreadReadUntil(threadId: string, userId: string, messageId: string): Promise<number>;
  pollNewMessages(userId: string, since: Date): Promise<PolledMessage[]>;
}
