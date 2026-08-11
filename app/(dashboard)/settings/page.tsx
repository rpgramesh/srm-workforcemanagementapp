import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/server-session";
import type { AppRole } from "@/types/app";

export const dynamic = "force-dynamic";

const FIRST_TAB_BY_ROLE: Record<AppRole, string> = {
  super_admin: "/settings/admin",
  restaurant_admin: "/settings/admin",
  manager: "/settings/manager",
  supervisor: "/settings/user",
  employee: "/settings/user",
};

export default async function SettingsIndexPage() {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  redirect(FIRST_TAB_BY_ROLE[actor.role] ?? "/settings/user");
}
