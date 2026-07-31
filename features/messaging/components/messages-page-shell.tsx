"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessagingApp } from "@/features/messaging/components/messaging-app";

interface Props {
  currentUserId: string | null;
  currentRole: import("@/types/app").AppRole | null;
  onUnreadChange?: (n: number) => void;
}

export function MessagesPageShell({ currentUserId, currentRole, onUnreadChange }: Props) {
  const params = useSearchParams();
  const recipient = params.get("recipient");
  const [initialRecipientId, setInitialRecipientId] = useState<string | null>(recipient);

  useEffect(() => {
    if (recipient) setInitialRecipientId(recipient);
  }, [recipient]);

  return (
    <MessagingApp
      currentUserId={currentUserId}
      currentRole={currentRole}
      initialRecipientId={initialRecipientId}
      onUnreadChange={onUnreadChange}
    />
  );
}
