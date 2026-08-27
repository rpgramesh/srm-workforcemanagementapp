import { redirect } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { DashboardChrome } from "@/components/layout/dashboard-chrome";
import { getCurrentActor } from "@/lib/server-session";
import type { AppRole } from "@/types/app";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const ADMIN_TAB_ROLES: AppRole[] = ["super_admin", "restaurant_admin"];
const MANAGER_TAB_ROLES: AppRole[] = ["super_admin", "restaurant_admin", "manager"];

interface SettingsTab {
  id: string;
  label: string;
  description: string;
  href: string;
  roles: AppRole[];
}

const SETTINGS_TABS: SettingsTab[] = [
  {
    id: "user",
    label: "Account",
    description: "Your profile, preferences & security",
    href: "/settings/user",
    roles: ["super_admin", "restaurant_admin", "manager", "supervisor", "employee"],
  },
  {
    id: "admin",
    label: "Admin",
    description: "Platform config, permissions & audit",
    href: "/settings/admin",
    roles: ADMIN_TAB_ROLES,
  },
  {
    id: "manager",
    label: "Manager",
    description: "Team ops, scheduling & reporting",
    href: "/settings/manager",
    roles: MANAGER_TAB_ROLES,
  },
];

function extractPathname(h: Headers): string {
  const invokePath = h.get("x-invoke-path") ?? "";
  if (invokePath) return invokePath;
  const referer = h.get("referer") ?? "";
  try {
    if (referer) {
      const url = new URL(referer);
      return url.pathname;
    }
  } catch {
    /* ignore */
  }
  return h.get("x-next-pathname") ?? "";
}

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");

  const h = await headers();
  const currentPath = extractPathname(h);

  const visibleTabs = SETTINGS_TABS.filter((tab) => tab.roles.includes(actor.role));

  return (
    <DashboardChrome
      title="Settings"
      subtitle="Role-specific account, platform & operational configuration"
      actor={actor}
    >
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <div className="space-y-2.5">
          {visibleTabs.map((tab) => {
            const isActive = currentPath.includes(`/settings/${tab.id}`);
            return (
              <Link key={tab.id} href={tab.href} className="block">
                <div
                  className={`w-full cursor-pointer rounded-2xl border p-4 text-left backdrop-blur-md transition-all duration-200 ${isActive
                      ? "border-blue-500/40 bg-blue-600/15 shadow-lg shadow-blue-500/5"
                      : "border-slate-800/80 bg-[#181920]/80 hover:border-slate-700 hover:bg-slate-800/50"
                    }`}
                >
                  <div className={`text-sm font-bold ${isActive ? "text-blue-400" : "text-white"}`}>
                    {tab.label}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{tab.description}</div>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </DashboardChrome>
  );
}