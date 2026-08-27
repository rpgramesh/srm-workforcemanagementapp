import { ModuleCard } from "@/components/shared/module-card";
import type { DeliveryModule, PlatformMetric } from "@/types/app";

const platformMetrics: PlatformMetric[] = [
  {
    label: "Frontend Stack",
    value: "Next 15 + React 19",
    hint: "App Router, strict TypeScript, Tailwind v4, shadcn-ready foundation",
  },
  {
    label: "Backend Stack",
    value: "Supabase Core",
    hint: "Auth, PostgreSQL, Storage, Realtime, Edge Functions, and RLS",
  },
  {
    label: "Current Phase",
    value: "Module 1",
    hint: "Project scaffolding, enterprise folders, and reusable platform shell",
  },
];

const deliveryModules: DeliveryModule[] = [
  {
    id: "01",
    title: "Folder Structure",
    description:
      "Enterprise project scaffolding with feature boundaries, infrastructure folders, and shared utilities.",
    status: "current",
  },
  {
    id: "02",
    title: "UI Theme",
    description:
      "Design tokens, reusable primitives, dark mode, polished cards, tables, forms, and motion standards.",
    status: "next",
  },
  {
    id: "03",
    title: "Authentication",
    description:
      "Supabase auth, protected route middleware, email verification, role-aware routing, and session persistence.",
    status: "planned",
  },
  {
    id: "04",
    title: "Database Schema",
    description:
      "Normalized workforce schema, migrations, views, triggers, storage buckets, and row-level security.",
    status: "planned",
  },
];

export function FoundationOverview() {
  return (
    <section className="space-y-10">
      <div className="grid gap-4 lg:grid-cols-3">
        {platformMetrics.map((metric) => (
          <article
            key={metric.label}
            className="rounded-3xl border border-slate-200 bg-white/5 p-5 backdrop-blur"
          >
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
              {metric.label}
            </p>
            <p className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-slate-900">
              {metric.value}
            </p>
            <p className="mt-3 max-w-sm text-sm leading-6 text-slate-700">
              {metric.hint}
            </p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {deliveryModules.map((module) => (
          <ModuleCard key={module.id} module={module} />
        ))}
      </div>
    </section>
  );
}
