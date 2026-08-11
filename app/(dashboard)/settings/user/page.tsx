import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/server-session";
import { getMyProfile } from "@/features/users/actions/settings-actions";
import { UserSettingsPanel } from "./_components/user-settings-panel";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function UserSettingsPage() {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");

  const profile = await getMyProfile();

  return <UserSettingsPanel actor={actor} profile={profile} />;
}
