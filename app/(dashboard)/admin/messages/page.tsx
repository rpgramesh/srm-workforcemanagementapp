import { redirect } from "next/navigation";
import { DashboardChrome } from "@/components/layout/dashboard-chrome";
import { MessagesPageShell } from "@/features/messaging/components/messages-page-shell";
import { currentActorInfo } from "@/features/auth/actions/login-action";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const actor = await currentActorInfo();
  if (!actor) redirect("/login");

  return (
    <DashboardChrome title="Messages" subtitle="Internal secure communications with read receipts" actor={actor}>
      <MessagesPageShell currentUserId={actor.userId} currentRole={actor.role} />
    </DashboardChrome>
  );
}
