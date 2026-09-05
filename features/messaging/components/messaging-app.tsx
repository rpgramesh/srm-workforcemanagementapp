"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCheck,
  Hash,
  Inbox,
  Loader2,
  MessageCircleMore,
  MessageSquarePlus,
  Megaphone,
  Paperclip,
  RadioTower,
  Search,
  Send,
  Users2,
} from "lucide-react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/button";
import { Input, Select, TextArea, Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import {
  broadcastDepartment,
  listInbox,
  loadThread,
  markThreadRead,
  pollMessages,
  sendDirect,
  unreadCount,
} from "@/features/messaging/actions/messaging-actions";
import { listActiveStaffMinimal, listDepartments } from "@/features/data/actions/reference-actions";
import type { DepartmentRow } from "@/features/data/actions/reference-actions";
import type { Message, PolledMessage, ThreadSummary } from "@/types/messaging";
import type { AppRole } from "@/types/app";
import { Avatar } from "@/components/ui/avatar";
import { canManageStaff } from "@/types/user";
import { formatUserLabel, initialsFromName } from "@/lib/user-labels";

type StaffMin = { id: string; firstName: string; lastName: string; role: AppRole; departmentId: string | null };

interface MessagingAppProps {
  currentUserId: string | null;
  currentRole: AppRole | null;
  initialRecipientId?: string | null;
  onUnreadChange?: (n: number) => void;
}

const POLL_INTERVAL = 15_000;

function participantIdsForThread(thread: ThreadSummary): string[] {
  if (Array.isArray(thread.participantIds)) {
    return thread.participantIds;
  }

  const metadata = thread.metadata;
  if (!metadata || typeof metadata !== "object" || !("participantIds" in metadata)) {
    return [];
  }

  const value = metadata.participantIds;
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

function timeAgo(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h`;
  const days = Math.floor(diff / 86400_000);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

export function MessagingApp({ currentUserId, currentRole, initialRecipientId, onUnreadChange }: MessagingAppProps) {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [staff, setStaff] = useState<StaffMin[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [composer, setComposer] = useState("");
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [newTargetKind, setNewTargetKind] = useState<"direct" | "department">("direct");
  const [newTargetUserId, setNewTargetUserId] = useState("");
  const [newTargetDept, setNewTargetDept] = useState("");
  const [newMessageBody, setNewMessageBody] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const lastPollRef = useRef<string>(new Date(Date.now() - 10 * 60_000).toISOString());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const canBroadcast = !!currentRole && canManageStaff(currentRole);

  const refreshInbox = useCallback(async () => {
    setLoadingInbox(true);
    try {
      const next = await listInbox();
      setThreads(next);
      const u = next.reduce((acc, t) => acc + (t.unreadCount ?? 0), 0);
      onUnreadChange?.(u);
    } finally {
      setLoadingInbox(false);
    }
  }, [onUnreadChange]);

  const refreshUnreadBadge = useCallback(async () => {
    const n = await unreadCount();
    onUnreadChange?.(n);
  }, [onUnreadChange]);

  useEffect(() => {
    (async () => {
      const [depts, arr] = await Promise.all([listDepartments(), listActiveStaffMinimal()]);
      setDepartments(depts);
      setStaff(arr as unknown as StaffMin[]);
      await refreshInbox();
    })();
  }, [refreshInbox]);

  // Initial recipient deep-link
  useEffect(() => {
    if (!initialRecipientId) return;
    const u = staff.find((s) => s.id === initialRecipientId);
    if (u) {
        openOrCreateDirect(u.id);
    }
  }, [initialRecipientId, staff.length]);

  // Auto-scroll on message change
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages]);

  // Poll-based realtime notifications
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const since = lastPollRef.current;
      const now = new Date().toISOString();
      const received: PolledMessage[] = await pollMessages(since);
      lastPollRef.current = now;
      if (cancelled || !received.length) return;
      const byThread = new Map<string, PolledMessage[]>();
      for (const m of received) {
        const key = m.threadId;
        if (!byThread.has(key)) byThread.set(key, []);
        byThread.get(key)!.push(m);
      }
      // Append to current thread if open
      if (selectedThread && byThread.has(selectedThread)) {
        const arr = byThread.get(selectedThread)!;
        setMessages((prev) => {
          const ids = new Set(prev.map((x) => x.id));
          const additions = arr.filter((a) => !ids.has(a.id));
          const combined = [...prev, ...additions];
          return combined.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        });
      }
      // Inbox update + toast notifications for new messages not from me
      const fromOthers = received.filter((m) => m.senderId !== currentUserId);
      if (fromOthers.length) {
        await refreshInbox();
        const sample = fromOthers[fromOthers.length - 1];
        const sampleSender = sample.senderId ? staff.find((s) => s.id === sample.senderId) : undefined;
        const senderDisplay = sampleSender
          ? formatUserLabel({ firstName: sampleSender.firstName, lastName: sampleSender.lastName, role: sampleSender.role })
          : sample.senderName ?? "Staff";
        toast(`New message from ${senderDisplay}`, {
          description: sample.body.length > 120 ? `${sample.body.slice(0, 120)}…` : sample.body,
          action: {
            label: "Open",
            onClick: () => setSelectedThread(sample.threadId),
          },
        });
      }
    };
    const timer = setInterval(run, POLL_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selectedThread, refreshInbox, currentUserId, staff]);

  const openOrCreateDirect = async (userId: string) => {
    if (!currentUserId) return;
    // If thread already exists for this user, pick it
    const existingDirect = threads.find(
      (t) =>
        t.kind === "direct" &&
          participantIdsForThread(t).includes(userId),
    );
    if (existingDirect) {
      setSelectedThread(existingDirect.id);
      await openThread(existingDirect.id);
      return;
    }
    // Otherwise open the composer pre-filled
    setNewTargetKind("direct");
    setNewTargetUserId(userId);
    setNewTargetDept("");
    setNewMessageBody("");
    setNewMessageOpen(true);
  };

  const openThread = async (threadId: string) => {
    setSelectedThread(threadId);
    setLoadingThread(true);
    try {
      const r = await loadThread(threadId, 200);
      if (!r.success || !r.data) {
        toast.error(r.message || "Could not load thread");
        return;
      }
      setMessages(r.data.messages);
      const last = r.data.messages[r.data.messages.length - 1];
      if (last && currentUserId) {
        // auto mark read if viewing
        void markThreadRead(threadId, last.id).then(() => refreshUnreadBadge());
      }
    } finally {
      setLoadingThread(false);
      if (typeof window !== "undefined" && window.innerWidth < 1024) setSidebarOpen(false);
    }
  };

  const currentThread: ThreadSummary | undefined = threads.find((t) => t.id === selectedThread);

  const handleSendInThread = async () => {
    if (!selectedThread || !currentUserId) return;
    const body = composer.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const t = currentThread;
        let r:
          | Awaited<ReturnType<typeof broadcastDepartment>>
          | Awaited<ReturnType<typeof sendDirect>>;
      if (t?.kind === "department" && t.departmentId) {
        r = await broadcastDepartment({ departmentId: t.departmentId, body });
      } else if (t?.kind === "direct") {
          const otherId = participantIdsForThread(t).find((id) => id !== currentUserId);
        if (!otherId) {
          toast.error("Could not find recipient");
          return;
        }
        r = await sendDirect({ recipientId: otherId, body });
      } else {
        toast.error("This thread type is not supported for replies yet");
        return;
      }
      if (!r.success) {
        toast.error(r.message);
        return;
      }
      setComposer("");
      await openThread(selectedThread);
      await refreshInbox();
    } finally {
      setSending(false);
    }
  };

  const handleNewMessageSubmit = async () => {
    if (!currentUserId) return;
    const body = newMessageBody.trim();
    if (!body) {
      toast.error("Please enter a message");
      return;
    }
    setSending(true);
    try {
      if (newTargetKind === "direct") {
        if (!newTargetUserId) {
          toast.error("Pick a recipient");
          return;
        }
        const r = await sendDirect({ recipientId: newTargetUserId, body });
        if (!r.success) {
          toast.error(r.message);
          return;
        }
      } else {
        if (!canBroadcast) {
          toast.error("Only managers can broadcast to departments");
          return;
        }
        if (!newTargetDept) {
          toast.error("Pick a department");
          return;
        }
        const r = await broadcastDepartment({ departmentId: newTargetDept, body });
        if (!r.success) {
          toast.error(r.message);
          return;
        }
      }
      setNewMessageOpen(false);
      setNewMessageBody("");
      await refreshInbox();
    } finally {
      setSending(false);
    }
  };

  const deptById = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);
  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);

  const participantLabel = (t: ThreadSummary): string => {
    if (t.kind === "department") {
      return deptById.get(t.departmentId ?? "")?.name ?? t.title ?? "Department";
    }
    const ids = participantIdsForThread(t);
    if (!ids) return t.title ?? "Direct message";
    const other = ids.find((id) => id !== currentUserId);
    if (!other) return t.title ?? "Direct message";
    const u = staffById.get(other);
    return u ? formatUserLabel(u) : t.title ?? "Direct message";
  };

  const participantInfo = (t: ThreadSummary): { id: string | null; name: string; accent: string | undefined } | null => {
    if (t.kind === "department") {
      const d = deptById.get(t.departmentId ?? "");
      return { id: null, name: d?.name ?? "Department", accent: d?.color ?? undefined };
    }
    const ids = participantIdsForThread(t);
    if (!ids) return null;
    const other = ids.find((id) => id !== currentUserId);
    if (!other) return null;
    const u = staffById.get(other);
    if (u) return { id: u.id, name: formatUserLabel(u), accent: undefined };
    return { id: other, name: t.title ?? "Staff", accent: undefined };
  };

  return (
    <div className="flex h-[calc(100vh-9rem)] min-h-[640px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/60 shadow-2xl shadow-slate-950/40 backdrop-blur lg:flex-row">
      {/* Sidebar */}
      <aside
        className={clsx(
          "flex min-h-0 w-full flex-col border-b border-slate-200 lg:w-80 lg:border-b-0 lg:border-r lg:border-slate-200",
          !sidebarOpen && "hidden lg:flex",
        )}
      >
        <div className="flex items-center justify-between border-b border-white/5 p-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Messages</h3>
            <p className="text-xs text-slate-500">Internal secure communications</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<RadioTower className="h-4 w-4 text-sky-400" />}
              title={`Checking every ${POLL_INTERVAL / 1000}s for new messages`}
            />
            <Button
              variant="primary"
              size="sm"
              icon={<MessageSquarePlus className="h-4 w-4" />}
              onClick={() => {
                setNewTargetKind("direct");
                setNewTargetUserId("");
                setNewTargetDept("");
                setNewMessageBody("");
                setNewMessageOpen(true);
              }}
            >
              New
            </Button>
          </div>
        </div>

        <div className="border-b border-white/5 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input className="pl-9" placeholder="Search threads…" />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingInbox && !threads.length ? (
            <div className="flex flex-col items-center justify-center gap-2 p-10 text-xs text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
              Loading conversations…
            </div>
          ) : threads.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              <Inbox className="mx-auto mb-3 h-8 w-8 text-slate-600" />
              No conversations yet
              <div className="mt-3 text-xs text-slate-500">
                Send a direct message to a colleague or broadcast a reminder to your team.
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {threads.map((t) => {
                const info = participantInfo(t);
                const isActive = selectedThread === t.id;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => void openThread(t.id)}
                      className={clsx(
                        "flex w-full items-start gap-3 px-3 py-3 text-left transition hover:bg-white/5",
                        isActive && "bg-white/5 ring-1 ring-inset ring-sky-400/10",
                      )}
                    >
                      <div className="relative">
                        {t.kind === "department" ? (
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/70 to-violet-500/70 text-slate-900 ring-1 ring-white/10" style={{ backgroundColor: info?.accent ?? undefined }}>
                            <Hash className="h-5 w-5" />
                          </div>
                        ) : info ? (
                          <Avatar
                            firstName={info.name.split(" ")[0] ?? info.name}
                            lastName={info.name.split(" ").slice(1).join(" ") || ""}
                            size="md"
                            accent={info.accent}
                          />
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-xs text-slate-700">
                            {initialsFromName(t.title ?? "?")}
                          </div>
                        )}
                        {(t.unreadCount ?? 0) > 0 ? (
                          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-slate-900 shadow ring-2 ring-slate-900">
                            {t.unreadCount}
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            {t.kind === "department" ? (
                              <span className="inline-flex items-center gap-1 text-xs text-indigo-300">
                                <Megaphone className="h-3 w-3" />
                              </span>
                            ) : null}
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {participantLabel(t)}
                            </p>
                          </div>
                          <span className="flex-shrink-0 text-[11px] text-slate-500">
                            {t.lastMessageAt ? timeAgo(t.lastMessageAt) : ""}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {t.lastPreview || "No messages yet"}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-white/5 p-3">
          <div className="rounded-xl border border-slate-200 bg-white/5 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Users2 className="h-3.5 w-3.5 text-blue-500" />
              Quick message
            </div>
            <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
              {staff.map((s) => (
                <button
                  key={s.id}
                  type="button"
                    onClick={() => void openOrCreateDirect(s.id)}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/60 px-2 py-1 text-[11px] text-slate-700 transition hover:border-sky-400/30 hover:bg-sky-500/10 hover:text-slate-900"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/5 text-[9px] font-bold text-slate-700">
                    {initialsFromName({ firstName: s.firstName, lastName: s.lastName })}
                  </span>
                  {formatUserLabel(s)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Thread view */}
      <section
        className={clsx(
          "flex min-h-0 flex-1 flex-col",
          sidebarOpen && "hidden lg:flex",
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-900"
              aria-label="Back to conversations"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            {currentThread ? (
              <>
                {currentThread.kind === "department" ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/70 to-violet-500/70 text-slate-900 ring-1 ring-white/10"
                    style={(() => {
                      const d = deptById.get(currentThread.departmentId ?? "");
                      return d?.color ? { backgroundColor: d.color } : undefined;
                    })()}
                  >
                    <Building2 className="h-5 w-5" />
                  </div>
                ) : (
                  participantInfo(currentThread) ? (
                    <Avatar
                      firstName={participantInfo(currentThread)!.name.split(" ")[0]}
                      lastName={participantInfo(currentThread)!.name.split(" ").slice(1).join(" ") || ""}
                      size="md"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-xl bg-white/5" />
                  )
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">
                      {participantLabel(currentThread)}
                    </h2>
                    {currentThread.kind === "department" ? (
                      <Badge tone="indigo" size="sm">
                        <Megaphone className="mr-1 h-3 w-3" />
                        Broadcast
                      </Badge>
                    ) : (
                      <Badge tone="emerald" size="sm">1:1</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {currentThread.kind === "department"
                      ? "Message delivered to the entire department"
                      : "End-to-end auditable conversation"}
                  </p>
                </div>
              </>
            ) : (
              <div>
                <h2 className="text-sm font-semibold text-slate-900">No conversation selected</h2>
                <p className="text-xs text-slate-500">
                  Pick a thread on the left, or create a new message.
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" icon={<Paperclip className="h-4 w-4" />}>
              Attach
            </Button>
          </div>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {!selectedThread ? (
            <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center text-center text-sm text-slate-500">
              <MessageCircleMore className="mb-4 h-12 w-12 text-slate-600" />
              <h3 className="text-base font-semibold text-slate-900">Stay in sync with your team</h3>
              <p className="mt-2 text-xs">
                All messages are stored with read receipts, timestamps, and a tamper-proof audit log for compliance.
              </p>
            </div>
          ) : loadingThread ? (
            <div className="flex h-full items-center justify-center text-xs text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-sky-400" />
              Loading conversation…
            </div>
          ) : messages.length === 0 ? (
            <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center text-center text-xs text-slate-500">
              Start the conversation — your first message is recorded above.
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-3">
              {messages.map((m, idx) => {
                const isMine = m.senderId === currentUserId;
                const showDate =
                  idx === 0 ||
                  new Date(messages[idx - 1].createdAt).toDateString() !== new Date(m.createdAt).toDateString();
                const readByMe = (m.readBy ?? []).some((x) => x.userId === currentUserId);
                const readByAll = isMine && (m.readBy ?? []).length >= 1 && (currentThread?.kind !== "department");
                  const sender = m.senderId ? staffById.get(m.senderId) : undefined;
                return (
                  <div key={m.id} className="flex flex-col">
                    {showDate ? (
                      <div className="my-3 flex items-center gap-3">
                        <div className="h-px flex-1 bg-white/5" />
                        <span className="rounded-full border border-slate-200 bg-slate-50/60 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-500">
                          {new Date(m.createdAt).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                        </span>
                        <div className="h-px flex-1 bg-white/5" />
                      </div>
                    ) : null}
                    <div className={clsx("flex items-end gap-2", isMine ? "justify-end" : "justify-start")}>
                      {!isMine ? (
                        <Avatar
                            firstName={sender?.firstName ?? "Staff"}
                            lastName={sender?.lastName ?? ""}
                          size="sm"
                        />
                      ) : null}
                      <div
                        className={clsx(
                          "group relative max-w-[82%] rounded-2xl px-4 py-2.5 text-sm shadow-lg",
                          isMine
                            ? "rounded-br-sm bg-gradient-to-br from-sky-500 to-indigo-500 text-slate-900"
                            : "rounded-bl-sm border border-slate-200 bg-slate-800/80 text-slate-100",
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>
                        <div
                          className={clsx(
                            "mt-1 flex items-center justify-end gap-1 text-[10px]",
                            isMine ? "text-sky-100/70" : "text-slate-500",
                          )}
                        >
                          {!isMine ? (
                            <span className="mr-auto pr-2 text-[10px] font-medium">
                                {sender
                                  ? formatUserLabel(sender)
                                : "Staff"}
                            </span>
                          ) : null}
                          <span>
                            {new Date(m.createdAt).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {isMine ? (
                            readByAll ? (
                              <CheckCheck className="h-3 w-3 text-blue-600" />
                            ) : (
                              <Check className="h-3 w-3 opacity-80" />
                            )
                          ) : readByMe ? (
                            <Check className="h-3 w-3 text-sky-400/80" />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-white/5 p-4">
          <div className="mx-auto flex max-w-3xl items-end gap-3">
            <TextArea
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSendInThread();
                }
              }}
              rows={2}
              className="resize-none"
              placeholder={
                selectedThread
                  ? currentThread?.kind === "department"
                    ? "Write a broadcast to the department…"
                    : "Type a message… (Enter to send, Shift+Enter for newline)"
                  : "Select a conversation first"
              }
              disabled={!selectedThread || sending}
            />
            <Button
              variant="primary"
              className="h-11 shrink-0"
              onClick={() => void handleSendInThread()}
              disabled={!selectedThread || sending || !composer.trim()}
              icon={<Send className="h-4 w-4" />}
            >
              {sending ? "…" : "Send"}
            </Button>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-[11px] text-slate-500">
            Messages are stored with timestamps and read receipts. Deletes are not allowed.
          </p>
        </div>
      </section>

      {/* New Message Modal */}
      <Modal
        open={newMessageOpen}
        onClose={() => setNewMessageOpen(false)}
        size="md"
        title={newTargetKind === "department" ? "New department broadcast" : "New direct message"}
        subtitle={
          newTargetKind === "department"
            ? "Managers only — message delivered to every active member of this department."
            : "Sent securely with timestamps and read receipts."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewMessageOpen(false)} disabled={sending}>Cancel</Button>
            <Button variant="primary" onClick={() => void handleNewMessageSubmit()} disabled={sending}>
              {sending ? "Sending…" : newTargetKind === "department" ? "Send broadcast" : "Send message"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="flex gap-2 rounded-xl border border-slate-200 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setNewTargetKind("direct")}
              className={clsx(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
                newTargetKind === "direct" ? "bg-slate-800 text-slate-900 shadow" : "text-slate-500 hover:text-slate-900",
              )}
            >
              <MessageCircleMore className="h-4 w-4" />
              Direct
            </button>
            <button
              type="button"
              onClick={() => canBroadcast && setNewTargetKind("department")}
              disabled={!canBroadcast}
              title={canBroadcast ? undefined : "Managers and above can broadcast to departments"}
              className={clsx(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
                newTargetKind === "department" ? "bg-slate-800 text-slate-900 shadow" : "text-slate-500 hover:text-slate-900",
              )}
            >
              <Megaphone className="h-4 w-4" />
              Broadcast
            </button>
          </div>

          {newTargetKind === "direct" ? (
            <Field label="Recipient">
              <Select value={newTargetUserId} onChange={(e) => setNewTargetUserId(e.target.value)}>
                <option value="">Choose a person…</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatUserLabel(s)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Department" hint={canBroadcast ? undefined : "You do not have permission to broadcast"}>
              <Select
                value={newTargetDept}
                onChange={(e) => setNewTargetDept(e.target.value)}
                disabled={!canBroadcast}
              >
                <option value="">Choose a department…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="Message" error={newMessageBody.length > 4000 ? "Keep under 4000 characters" : undefined}>
            <TextArea
              autoFocus
              rows={6}
              placeholder={
                newTargetKind === "department"
                  ? "Broadcast reminder: Roster for next week is locked in. Please review and confirm…"
                  : "Hey — quick question about the Monday roster swap…"
              }
              value={newMessageBody}
              onChange={(e) => setNewMessageBody(e.target.value)}
            />
            <div className="mt-1 text-right text-[11px] text-slate-500">
              {newMessageBody.length}/4000
            </div>
          </Field>
        </div>
      </Modal>
    </div>
  );
}
