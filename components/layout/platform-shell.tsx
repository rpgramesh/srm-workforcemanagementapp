import { FolderTree, ShieldCheck, Sparkles } from "lucide-react";
import { FoundationOverview } from "@/features/dashboard/components/foundation-overview";

const foundationNotes = [
  {
    icon: FolderTree,
    title: "Feature-Based Boundaries",
    description:
      "Each domain now has a dedicated module path so future work can stay isolated, reusable, and easier to test.",
  },
  {
    icon: ShieldCheck,
    title: "Supabase-Ready Backbone",
    description:
      "The repository already includes dedicated folders for policies, server clients, migrations, storage, edge functions, and tests.",
  },
  {
    icon: Sparkles,
    title: "Compile-Safe Starting Point",
    description:
      "The starter UI is intentionally minimal but production-shaped, making the next modules additive instead of disruptive.",
  },
];

export function PlatformShell() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_22%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_26%),linear-gradient(180deg,#020617_0%,#0f172a_52%,#111827_100%)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-10 lg:px-10 lg:py-14">
        <section className="grid gap-8 rounded-[32px] border border-white/10 bg-slate-950/70 p-8 shadow-2xl shadow-slate-950/50 backdrop-blur xl:grid-cols-[1.3fr_0.9fr] xl:p-10">
          <div className="space-y-6">
            <div className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.26em] text-emerald-200">
              Restaurant Workforce Management
            </div>

            <div className="max-w-3xl space-y-4">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                Foundation Module
              </p>
              <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.05em] text-white md:text-5xl">
                Enterprise-grade workspace scaffolding for a multi-tenant
                restaurant operations platform.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                This baseline establishes the project structure, shared utilities,
                package foundations, and feature boundaries required for the
                upcoming UI theme, authentication, and Supabase-backed domain
                modules.
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            {foundationNotes.map((note) => {
              const Icon = note.icon;

              return (
                <article
                  key={note.title}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5"
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl border border-white/10 bg-slate-900 p-3 text-emerald-200">
                      <Icon className="size-5" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-base font-semibold text-white">
                        {note.title}
                      </h2>
                      <p className="text-sm leading-6 text-slate-300">
                        {note.description}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <FoundationOverview />
      </div>
    </main>
  );
}
