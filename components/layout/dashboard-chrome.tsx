import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

interface DashboardChromeProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function DashboardChrome({ title, subtitle, children }: DashboardChromeProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_25%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_28%),linear-gradient(180deg,#020617_0%,#0b1224_40%,#111827_100%)]">
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar title={title} subtitle={subtitle} />
          <div className="flex-1 px-6 py-8 lg:px-10">{children}</div>
        </div>
      </div>
    </div>
  );
}

