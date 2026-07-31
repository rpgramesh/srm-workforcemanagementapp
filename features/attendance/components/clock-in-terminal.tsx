"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Clock8, Delete, ShieldCheck, UserCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { clockInWithPin } from "@/features/attendance/actions/clock-in-action";
import { cn } from "@/lib/utils";
import type { User } from "@/types/user";

const keypad = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

interface ClockInTerminalProps {
  onAuthenticated?: (user: User) => void;
}

export function ClockInTerminal({ onAuthenticated }: ClockInTerminalProps) {
  const [pin, setPin] = useState("");
  const [lastUser, setLastUser] = useState<User | null>(null);
  const [isPending, startTransition] = useTransition();
  const dots = useMemo(() => Array.from({ length: 4 }), []);

  const handleDigit = (digit: string) => {
    setPin((current) => (current.length < 4 ? `${current}${digit}` : current));
  };

  const handleBackspace = () => {
    setPin((current) => current.slice(0, -1));
  };

  const handleSubmit = () => {
    if (pin.length !== 4) {
      toast.error("Enter your 4-digit PIN", { description: "PIN is required to clock in." });
      return;
    }

    const submittedPin = pin;
    startTransition(async () => {
      const result = await clockInWithPin(submittedPin);
      if (result.success && result.user) {
        toast.success(result.message, { description: result.description });
        setLastUser(result.user);
        setPin("");
        onAuthenticated?.(result.user);
      } else {
        toast.error(result.message, { description: result.description });
      }
    });
  };

  return (
    <Card className="bg-slate-950/35">
      <CardContent className="p-8">
        <div className="space-y-6">
          <div className="space-y-2 text-center">
            <p className="text-sm font-semibold text-white">Enter PIN</p>
            <p className="text-xs text-slate-400">Access your shift terminal</p>
          </div>

          <div className="flex items-center justify-center gap-3">
            {dots.map((_, index) => (
              <span
                key={index}
                className={cn(
                  "size-3 rounded-full border border-white/10 transition-colors",
                  index < pin.length ? "bg-emerald-300/80" : "bg-white/5",
                )}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {keypad.map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigit(digit)}
                disabled={isPending}
                className="flex h-20 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-lg font-semibold text-slate-100 transition hover:bg-white/10 active:scale-[0.98] disabled:opacity-60"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={handleBackspace}
              disabled={isPending}
              className="flex h-20 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 active:scale-[0.98] disabled:opacity-60"
            >
              <Delete className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => handleDigit("0")}
              disabled={isPending}
              className="flex h-20 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-lg font-semibold text-slate-100 transition hover:bg-white/10 active:scale-[0.98] disabled:opacity-60"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="flex h-20 items-center justify-center rounded-3xl bg-emerald-400 text-slate-950 transition hover:bg-emerald-300 active:scale-[0.98] disabled:opacity-60"
            >
              {isPending ? <Clock8 className="size-5 animate-pulse" /> : <ArrowRight className="size-5" />}
            </button>
          </div>

          {lastUser ? (
            <div className="flex items-center gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <div
                className="flex size-12 items-center justify-center rounded-full text-slate-950 shadow-inner"
                style={{ backgroundColor: lastUser.color ?? "#34D399" }}
              >
                <UserCircle2 className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-white">
                    {lastUser.fullName}
                  </p>
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-300" />
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  {[lastUser.jobTitle ?? String(lastUser.role).replace("_", " "), lastUser.employeeId]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="size-4" />
            Secure terminal session
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
