import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/server-session";
import { listStaff } from "@/features/users/actions/staff-actions";
import { getAdminSettings } from "@/features/settings/actions/admin-settings-actions";
import type { AppRole } from "@/types/app";
import { AdminSettingsPanel } from "./_components/admin-settings-panel";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const ADMIN_ROLES: AppRole[] = ["super_admin", "restaurant_admin"];

export default async function AdminSettingsPage() {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  if (!ADMIN_ROLES.includes(actor.role)) redirect("/settings/user");

  const [staffResult, settings] = await Promise.all([
    listStaff({ limit: 200 }),
    getAdminSettings()
  ]);

  const roleDistribution: Record<string, number> = {};
  for (const row of staffResult.rows) {
    roleDistribution[row.role] = (roleDistribution[row.role] ?? 0) + 1;
  }

  return (
    <AdminSettingsPanel
      actorRole={actor.role}
      staffCount={staffResult.total}
      roleDistribution={roleDistribution}
      initialSettings={settings}
    />
  );
}
