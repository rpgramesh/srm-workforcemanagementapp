"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Delete, Loader2, LogIn, Smartphone, ShieldEllipsis } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminLogin } from "@/features/auth/actions/login-action";
import { loginSchema, type LoginFormValues } from "@/features/auth/schemas/login-schema";
import { formatAustralianMobile } from "@/features/auth/services/au-mobile";
import { cn } from "@/lib/utils";

const keypadDigits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const PIN_LENGTH = 4;
const REALTIME_VERIFY_DEBOUNCE_MS = 450;
const MIN_PIN_ATTEMPT_GAP_MS = 900;

export function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isAutoVerifying, setIsAutoVerifying] = useState(false);
  const dots = useMemo(() => Array.from({ length: PIN_LENGTH }), []);
  const [pinRevealed, setPinRevealed] = useState(false);

  const {
    handleSubmit,
    register,
    setValue,
    watch,
    trigger,
    getFieldState,
    formState: { errors, isValid, isDirty },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    shouldUnregister: false,
    defaultValues: { mobile: "", pin: "" },
  });

  const mobileValue = watch("mobile");
  const pinValue = watch("pin");
  const mobileFieldState = getFieldState("mobile");
  const pinFieldState = getFieldState("pin");

  const debouncedVerifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAttemptAt = useRef<number>(0);
  const lastAttemptedKey = useRef<string>("");
  const verifyLockRef = useRef<boolean>(false);

  const updateMobile = (value: string) => {
    setValue("mobile", formatAustralianMobile(value), {
      shouldDirty: true,
      shouldValidate: true,
      shouldTouch: true,
    });
  };

  const sanitizePin = (raw: string): string =>
    raw.replace(/\D/g, "").slice(0, PIN_LENGTH);

  const updatePin = (value: string) => {
    const next = sanitizePin(value);
    setValue("pin", next, {
      shouldDirty: true,
      shouldValidate: true,
      shouldTouch: true,
    });
  };

  const appendDigit = (digit: string) => {
    if (pinValue.length >= PIN_LENGTH) return;
    updatePin(`${pinValue}${digit}`);
  };

  const removeDigit = () => {
    updatePin(pinValue.slice(0, -1));
  };

  const clearPin = () => {
    updatePin("");
  };

  const doVerify = useCallback(
    async ({ autoTriggered }: { autoTriggered: boolean }) => {
      if (verifyLockRef.current) return;
      if (isPending) return;

      const localMobile = mobileValue;
      const localPin = pinValue;

      const fieldsValid = await trigger(["mobile", "pin"]);
      if (!fieldsValid) return;
      if (mobileFieldState.invalid || pinFieldState.invalid) return;
      if (!/^\d{4}$/.test(localPin)) return;

      const now = Date.now();
      const attemptKey = `${localMobile}::${localPin}`;
      if (autoTriggered) {
        if (now - lastAttemptAt.current < MIN_PIN_ATTEMPT_GAP_MS) return;
        if (attemptKey === lastAttemptedKey.current) return;
      }
      lastAttemptAt.current = now;
      lastAttemptedKey.current = attemptKey;

      verifyLockRef.current = true;
      if (autoTriggered) setIsAutoVerifying(true);
      startTransition(async () => {
        try {
          const result = await adminLogin(localMobile, localPin);
          if (result.success) {
            toast.success(result.message, { description: result.description });
            router.push("/admin/dashboard");
            router.refresh();
          } else {
            toast.error(result.message, { description: result.description });
          }
        } finally {
          verifyLockRef.current = false;
          setIsAutoVerifying(false);
        }
      });
    },
    [
      isPending,
      mobileValue,
      pinValue,
      mobileFieldState.invalid,
      pinFieldState.invalid,
      trigger,
      router,
    ],
  );

  useEffect(() => {
    if (debouncedVerifyTimer.current) {
      clearTimeout(debouncedVerifyTimer.current);
      debouncedVerifyTimer.current = null;
    }
    if (!isDirty) return;
    if (mobileFieldState.invalid) return;
    if (pinFieldState.invalid) return;
    if (!isValid) return;
    if (pinValue.length !== PIN_LENGTH) return;
    if (isPending || isAutoVerifying || verifyLockRef.current) return;

    debouncedVerifyTimer.current = setTimeout(() => {
      void doVerify({ autoTriggered: true });
    }, REALTIME_VERIFY_DEBOUNCE_MS);

    return () => {
      if (debouncedVerifyTimer.current) clearTimeout(debouncedVerifyTimer.current);
    };
  }, [
    mobileValue,
    pinValue,
    isDirty,
    isValid,
    isPending,
    isAutoVerifying,
    mobileFieldState.invalid,
    pinFieldState.invalid,
    doVerify,
  ]);

  const submit = (values: LoginFormValues) => {
    lastAttemptedKey.current = `${values.mobile}::${values.pin}`;
    lastAttemptAt.current = Date.now();
    void doVerify({ autoTriggered: false });
  };

  const mobileRegistration = register("mobile");
  const pinRegistration = register("pin");

  const isAnyLoading = isPending || isAutoVerifying;
  const mobileOk = isDirty && !mobileFieldState.invalid && mobileValue.length > 6;
  const pinOk = isDirty && !pinFieldState.invalid && pinValue.length === PIN_LENGTH;
  const formLikelyValid = !!(mobileOk && pinOk);

  return (
    <form
      onSubmit={handleSubmit(submit)}
      className="w-full max-w-90 rounded-[28px] border border-emerald-300/20 bg-slate-950/80 shadow-[0_30px_90px_rgba(2,6,23,0.72)] backdrop-blur-xl"
      aria-busy={isAnyLoading}
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
          <label
            htmlFor="login-mobile"
            className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400"
          >
            <span>Mobile Number</span>
            {mobileOk ? (
              <span className="flex items-center gap-1 text-[10px] text-emerald-300">
                <CheckCircle2 className="size-3" /> Valid format
              </span>
            ) : null}
          </label>
          <div className="relative">
            <Smartphone className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <Input
              id="login-mobile"
              name={mobileRegistration.name}
              ref={mobileRegistration.ref}
              onBlur={mobileRegistration.onBlur}
              inputMode="tel"
              autoComplete="tel"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="+61 412 345 678"
              className={cn(
                "rounded-2xl pl-11",
                mobileFieldState.invalid &&
                  "ring-2 ring-rose-400/40 border-rose-400/40",
                mobileOk && "ring-2 ring-emerald-400/30 border-emerald-400/30",
              )}
              value={mobileValue}
              onChange={(event) => updateMobile(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  const nextPin = document.getElementById(
                    "login-pin",
                  ) as HTMLInputElement | null;
                  nextPin?.focus();
                  nextPin?.select();
                }
              }}
              disabled={isAnyLoading}
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
          <div className="flex items-center justify-between">
            <label
              htmlFor="login-pin"
              className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400"
            >
              Security PIN
            </label>
            <button
              type="button"
              onClick={() => setPinRevealed((v) => !v)}
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 hover:text-emerald-300"
            >
              {pinRevealed ? "Hide" : "Show"}
            </button>
          </div>
          <div className="relative">
            <ShieldEllipsis className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <Input
              id="login-pin"
              name={pinRegistration.name}
              ref={pinRegistration.ref}
              onBlur={pinRegistration.onBlur}
              value={pinValue}
              onChange={(event) => updatePin(event.target.value)}
              type={pinRevealed ? "text" : "password"}
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={PIN_LENGTH}
              autoComplete="one-time-code"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Enter 4-digit PIN"
              className={cn(
                "rounded-2xl pl-11 font-mono",
                pinRevealed ? "tracking-[0.4em]" : "tracking-[0.5em]",
                pinFieldState.invalid &&
                  "ring-2 ring-rose-400/40 border-rose-400/40",
                pinOk && "ring-2 ring-emerald-400/30 border-emerald-400/30",
              )}
              onKeyDown={(event) => {
                if (event.ctrlKey || event.metaKey) return;
                if (event.key === "Backspace") {
                  const target = event.currentTarget;
                  if (
                    target.selectionStart === target.selectionEnd &&
                    target.selectionStart === 0
                  ) {
                    const prevMobile = document.getElementById(
                      "login-mobile",
                    ) as HTMLInputElement | null;
                    prevMobile?.focus();
                    const len = prevMobile?.value.length ?? 0;
                    prevMobile?.setSelectionRange(len, len);
                    event.preventDefault();
                  }
                }
              }}
              onPaste={(event) => {
                const pasted = event.clipboardData?.getData("text") ?? "";
                if (pasted) {
                  event.preventDefault();
                  updatePin(sanitizePin(pasted));
                }
              }}
              disabled={isAnyLoading}
              aria-invalid={pinFieldState.invalid || undefined}
              aria-describedby={errors.pin ? "login-pin-error" : undefined}
            />
          </div>
          <div className="flex items-center gap-3 pt-1">
            {dots.map((_, index) => (
              <span
                key={index}
                aria-hidden
                className={cn(
                  "size-3 rounded-full border border-white/10 transition-colors",
                  index < pinValue.length ? "bg-emerald-300/80" : "bg-white/5",
                  pinOk && "border-emerald-400/40",
                  formLikelyValid &&
                    !isPending &&
                    index === pinValue.length &&
                    isAutoVerifying
                    ? "animate-pulse bg-emerald-200/70"
                    : "",
                )}
              />
            ))}
            <div className="ml-auto flex items-center gap-2 text-[11px]">
              {pinOk && !isAnyLoading ? (
                <span className="flex items-center gap-1 text-emerald-300">
                  <CheckCircle2 className="size-3" /> Format OK — verifying
                </span>
              ) : null}
              {isAutoVerifying ? (
                <span className="flex items-center gap-1 text-emerald-200">
                  <Loader2 className="size-3 animate-spin" /> Signing you in…
                </span>
              ) : null}
              {isPending ? (
                <span className="flex items-center gap-1 text-slate-300">
                  <Loader2 className="size-3 animate-spin" /> Authenticating…
                </span>
              ) : null}
            </div>
          </div>
          {errors.pin ? (
            <p id="login-pin-error" className="text-xs text-rose-200">
              {errors.pin.message}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {keypadDigits.map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => appendDigit(digit)}
              disabled={isAnyLoading}
              className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg font-semibold text-slate-100 transition hover:bg-white/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {digit}
            </button>
          ))}

          <button
            type="button"
            onClick={pinValue.length ? removeDigit : clearPin}
            disabled={isAnyLoading}
            aria-label={pinValue.length ? "Remove last PIN digit" : "Clear PIN"}
            className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Delete className="size-4" />
          </button>

          <button
            type="button"
            onClick={() => appendDigit("0")}
            disabled={isAnyLoading}
            className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg font-semibold text-slate-100 transition hover:bg-white/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            0
          </button>

          <button
            type="submit"
            disabled={isAnyLoading || !formLikelyValid}
            className={cn(
              "flex h-14 items-center justify-center rounded-2xl text-slate-950 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
              formLikelyValid
                ? "bg-emerald-400 hover:bg-emerald-300"
                : "bg-slate-600/80 hover:bg-slate-600",
            )}
            aria-label={isAnyLoading ? "Authenticating" : "Sign In"}
          >
            {isAnyLoading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <CheckCircle2 className="size-5" />
            )}
          </button>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={isAnyLoading || !isDirty || !isValid}
        >
          {isAnyLoading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {isAutoVerifying ? "Verifying & Redirecting…" : "Signing In…"}
            </>
          ) : (
            <>
              <LogIn className="size-4" />
              {formLikelyValid ? "Sign In & Continue" : "Sign In"}
            </>
          )}
        </Button>

        <p className="pt-1 text-center text-[11px] leading-relaxed text-slate-500">
          After a valid 4-digit PIN is entered, authentication runs automatically.
          Transmission is over HTTPS only, and repeated invalid attempts are rate-limited.
        </p>
      </div>
    </form>
  );
}
