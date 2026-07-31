export const appRoles = [
  "super_admin",
  "restaurant_admin",
  "manager",
  "supervisor",
  "employee",
] as const;

export type AppRole = (typeof appRoles)[number];

export interface DeliveryModule {
  id: string;
  title: string;
  description: string;
  status: "current" | "next" | "planned";
}

export interface PlatformMetric {
  label: string;
  value: string;
  hint: string;
}
