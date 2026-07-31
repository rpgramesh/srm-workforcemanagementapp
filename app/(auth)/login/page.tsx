import { CircleHelp, Settings } from "lucide-react";
import { LoginForm } from "@/features/auth/components/login-form";

const authBackground =
  "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=luxury%20restaurant%20interior%20at%20night%2C%20moody%20blue%20lighting%2C%20soft%20bar%20glow%2C%20elegant%20hospitality%20space%2C%20cinematic%20depth%20of%20field%2C%20high-end%20modern%20dining%20room%2C%20realistic%20photo&image_size=landscape_16_9";

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#041126]">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-45"
        style={{ backgroundImage: `url(${authBackground})` }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,12,32,0.92)_0%,rgba(2,12,32,0.72)_42%,rgba(2,12,32,0.78)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_24%),radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_26%)]" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4 lg:px-8">
          <div>
            <p className="text-2xl font-semibold tracking-[-0.04em] text-emerald-300">
              ShiftMaster Pro
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10">
              <CircleHelp className="size-4" />
            </button>
            <button className="flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10">
              <Settings className="size-4" />
            </button>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="flex w-full max-w-6xl flex-col items-center gap-8">
            <LoginForm />
            <p className="text-sm text-slate-300">
              Trusted by 2,000+ establishments worldwide
            </p>
          </div>
        </div>

        <footer className="flex flex-col gap-3 border-t border-white/10 px-6 py-4 text-xs text-slate-400 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>© 2024 ShiftMaster Pro. Supporting high-pressure hospitality environments.</p>
          <div className="flex flex-wrap items-center gap-4">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span>Contact Support</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
