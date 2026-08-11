import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/server-session";
import { listStaff } from "@/features/users/actions/staff-actions";
import type { AppRole } from "@/types/app";
import { ManagerSettingsPanel } from "./_components/manager-settings-panel";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const MANAGER_ROLES: AppRole[] = ["super_admin", "restaurant_admin", "manager"];

export default async function ManagerSettingsPage() {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  if (!MANAGER_ROLES.includes(actor.role)) redirect("/settings/user");

  const staffResult = await listStaff({ limit: 200 });
  const myStaff = staffResult.rows.filter(
    (s) => s.role === "employee" || s.role === "supervisor",
  );

  const deptCounts: Record<string, number> = {
    "Front of House": 0,
    "Back of House": 0,
    Bar: 0,
    Kitchen: 0,
  };
  for (const s of staffResult.rows) {
    const d = s.departmentId ?? "Front of House";
    deptCounts[d] = (deptCounts[d] ?? 0) + 1;
    void d;
  }

  return (
    <ManagerSettingsPanel
      actorRole={actor.role}
      myStaffCount={myStaff.length}
      totalStaffCount={staffResult.total}
      departmentCounts={deptCounts}
    />
  );
}
