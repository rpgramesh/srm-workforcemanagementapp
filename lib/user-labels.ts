import type { AppRole } from "@/types/app";

export const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Super Admin",
  restaurant_admin: "Floor Manager",
  manager: "Shift Manager",
  supervisor: "Team Lead",
  employee: "Staff Member",
};

export const ROLE_TONE: Record<
  AppRole,
  "neutral" | "emerald" | "amber" | "rose" | "sky" | "teal" | "indigo" | "violet" | "slate"
> = {
  super_admin: "rose",
  restaurant_admin: "indigo",
  manager: "sky",
  supervisor: "amber",
  employee: "emerald",
};

export function roleLabel(role: AppRole | null | undefined): string {
  if (!role) return "Guest";
  return ROLE_LABEL[role] ?? role.replace(/_/g, " ");
}

export interface UserIdentityLike {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role?: AppRole | string | null;
}

function plainName(u: UserIdentityLike): string {
  const name = (u.fullName || [u.firstName, u.lastName].filter(Boolean).join(" ")).trim();
  return name || "Unknown User";
}

export function formatUserLabel(u: UserIdentityLike, variant: "inline" | "twoLine" = "inline"): string {
  const name = plainName(u);
  const role = roleLabel((u.role as AppRole) ?? undefined);
  if (variant === "twoLine") return `${name}\n${role.toUpperCase()}`;
  return `${name} (${role})`;
}

export function initialsFromName(u: UserIdentityLike | string | null | undefined): string {
  const raw = typeof u === "string" ? u : plainName(u as UserIdentityLike);
  if (!raw) return "??";
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]!.slice(0, 1) + parts[parts.length - 1]!.slice(0, 1)).toUpperCase();
}
