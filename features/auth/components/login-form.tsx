"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Delete, LogIn, Smartphone, ShieldEllipsis } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminLogin } from "@/features/auth/actions/login-action";
import { loginSchema, type LoginFormValues } from "@/features/auth/schemas/login-schema";
import {
  formatAustralianMobile,
} from "@/features/auth/services/au-mobile";
import { cn } from "@/lib/utils";

const keypadDigits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const dots = useMemo(() => Array.from({ length: 4 }), []);

  const {
    handleSubmit,
    register,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      mobile: "",
      pin: "",
    },
  });

  const mobileValue = watch("mobile");
  const pinValue = watch("pin");

  const updateMobile = (value: string) => {
    setValue("mobile", formatAustralianMobile(value), {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const updatePin = (value: string) => {
    setValue("pin", value, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const appendDigit = (digit: string) => {
    if (pinValue.length >= 4) {
      return;
    }

    updatePin(`${pinValue}${digit}`);
  };

  const removeDigit = () => {
    updatePin(pinValue.slice(0, -1));
  };

  const submit = (values: LoginFormValues) => {
    startTransition(async () => {
      const result = await adminLogin(values.mobile, values.pin);

      if (result.success) {
        toast.success(result.message, {
          description: result.description,
        });
        router.push("/admin/dashboard");
      } else {
        toast.error(result.message, {
          description: result.description,
        });
      }
    });
  };

  const mobileRegistration = register("mobile");

  return (
    <form
      onSubmit={handleSubmit(submit)}
      className="w-full max-w-90 rounded-[28px] border border-emerald-300/20 bg-slate-950/80 shadow-[0_30px_90px_rgba(2,6,23,0.72)] backdrop-blur-xl"
    >
      <div className="border-b border-white/10 px-6 py-5 text-center">
        <h1 className="text-2xl font-semibold tracking-[-0.04em] text-white">
          Admin Sign In
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Restaurant &amp; Operations Team &middot; Australian Mobile + PIN
        </p>
      </div>

      <div className="space-y-5 px-6 py-6">
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            Mobile Number
          </label>
          <div className="relative">
            <Smartphone className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <Input
              name={mobileRegistration.name}
              ref={mobileRegistration.ref}
              onBlur={mobileRegistration.onBlur}
              inputMode="tel"
              placeholder="+61 412 345 678"
              className="rounded-2xl pl-11"
              value={mobileValue}
              onChange={(event) => {
                updateMobile(event.target.value);
              }}
            />
          </div>
          <p className="text-xs text-emerald-200/80">
            Accepts `04xx xxx xxx` or `+61 4xx xxx xxx`
          </p>
          {errors.mobile ? (
            <p className="text-xs text-rose-200">{errors.mobile.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            Security PIN
          </label>
          <div className="relative">
            <ShieldEllipsis className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={pinValue}
              readOnly
              placeholder="Enter 4-digit PIN"
              className="rounded-2xl pl-11 font-mono tracking-[0.5em]"
            />
          </div>
          <div className="flex items-center gap-3 pt-1">
            {dots.map((_, index) => (
              <span
                key={index}
                className={cn(
                  "size-3 rounded-full border border-white/10",
                  index < pinValue.length ? "bg-emerald-300/80" : "bg-white/5",
                )}
              />
            ))}
          </div>
          {errors.pin ? (
            <p className="text-xs text-rose-200">{errors.pin.message}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {keypadDigits.map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => appendDigit(digit)}
              className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg font-semibold text-slate-100 hover:bg-white/10 active:scale-[0.98]"
            >
              {digit}
            </button>
          ))}

          <button
            type="button"
            onClick={removeDigit}
            className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 active:scale-[0.98]"
          >
            <Delete className="size-4" />
          </button>

          <button
            type="button"
            onClick={() => appendDigit("0")}
            className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg font-semibold text-slate-100 hover:bg-white/10 active:scale-[0.98]"
          >
            0
          </button>

          <button
            type="submit"
            className="flex h-14 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950 hover:bg-emerald-300 active:scale-[0.98]"
          >
            <CheckCircle2 className="size-5" />
          </button>
        </div>

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isPending}>
          <LogIn className="size-4" />
          {isPending ? "Signing In..." : "Sign In"}
        </Button>
      </div>
    </form>
  );
}
