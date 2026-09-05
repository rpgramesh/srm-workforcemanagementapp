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
            const destination = result.redirectTo && result.redirectTo.length > 0 ? result.redirectTo : "/admin/dashboard";
            router.push(destination);
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
      className="w-full max-w-sm sm:max-w-md rounded-3xl border border-slate-800 bg-[white] shadow-2xl backdrop-blur-md text-slate-100"
      aria-busy={isAnyLoading}
    >
      <div className="border-b border-slate-200/80 px-4 py-4 sm:px-6 sm:py-5 text-center">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#3C3F45]">
          Sign In
        </h1>
        <p className="mt-1 text-sm sm:text-base text-[#3C3F45]">
          Restaurant &amp; Operations Team &middot; AU Mobile + PIN
        </p>
      </div>

      <div className="space-y-4 sm:space-y-5 px-4 py-5 sm:px-6 sm:py-6">
        {/* Mobile Number Input */}
        <div className="space-y-2">
          <label
            htmlFor="login-mobile"
            className="flex items-center justify-between text-[15px] font-semibold uppercase tracking-wider text-slate-400"
          >
            <span>Mobile Number</span>
            {mobileOk ? (
              <span className="flex items-center gap-1 text-[10px] text-blue-400">
                <CheckCircle2 className="size-3" /> Valid format
              </span>
            ) : null}
          </label>
          <div className="relative">
            <Smartphone className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
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
                "w-full rounded-xl border border-slate-800 bg-slate-900/90 py-2.5 pl-10 pr-4 text-sm font-medium text-white placeholder-slate-600 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500",
                mobileFieldState.invalid && "border-rose-500/50 focus:border-rose-500 focus:ring-rose-500",
                mobileOk && "border-blue-500/50",
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
          <p className="text-[12px] text-[#646464]">
            Accepts <code className="text-[#646464] font-mono">04xx xxx xxx</code> or <code className="text-[#646464] font-mono">+61 4xx xxx xxx</code>
          </p>
          {errors.mobile ? (
            <p className="text-xs text-rose-400">{errors.mobile.message}</p>
          ) : null}
        </div>

        {/* Security PIN Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="login-pin"
              className="text-[15px] font-semibold uppercase tracking-wider text-slate-400"
            >
              Security PIN
            </label>
            <button
              type="button"
              onClick={() => setPinRevealed((v) => !v)}
              className="text-[15px] font-semibold uppercase tracking-wider text-blue-400 hover:text-blue-300 transition-colors"
            >
              {pinRevealed ? "Hide" : "Show"}
            </button>
          </div>
          <div className="relative">
            <ShieldEllipsis className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
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
                "w-full rounded-xl border border-slate-800 bg-slate-900/90 py-2.5 pl-10 pr-4 font-mono text-white placeholder-slate-600 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500",
                pinRevealed ? "tracking-[0.4em]" : "tracking-[0.5em]",
                pinFieldState.invalid && "border-rose-500/50 focus:border-rose-500 focus:ring-rose-500",
                pinOk && "border-blue-500/50sa",
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
                  "size-3 rounded-full border border-slate-700 transition-colors",
                  index < pinValue.length ? "bg-blue-500" : "bg-slate-800",
                  pinOk && "border-blue-400",
                  formLikelyValid &&
                    !isPending &&
                    index === pinValue.length &&
                    isAutoVerifying
                    ? "animate-pulse bg-blue-400"
                    : "",
                )}
              />
            ))}
            <div className="ml-auto flex font-sans text-[12px] text-white items-center gap-2 ">
              {pinOk && !isAnyLoading ? (
                <span className="flex items-center gap-1 text-blue-400">
                  <CheckCircle2 className="size-3" /> Format OK — verifying
                </span>
              ) : null}
              {isAutoVerifying ? (
                <span className="flex items-center gap-1 text-blue-400">
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
            <p id="login-pin-error" className="text-xs text-rose-400">
              {errors.pin.message}
            </p>
          ) : null}
        </div>

        {/* Tactile Dark Keypad */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {keypadDigits.map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => appendDigit(digit)}
              disabled={isAnyLoading}
              className="flex h-12 items-center justify-center rounded-xl border border-slate-800/80 bg-slate-900 text-lg font-semibold text-white transition-all hover:bg-slate-800 hover:border-slate-700 active:scale-95"
            >
              {digit}
            </button>
          ))}

          <button
            type="button"
            onClick={pinValue.length ? removeDigit : clearPin}
            disabled={isAnyLoading}
            aria-label={pinValue.length ? "Remove last PIN digit" : "Clear PIN"}
            className="flex h-12 items-center justify-center rounded-xl border border-slate-800/80 bg-slate-900 text-slate-400 transition-all hover:bg-slate-800 hover:text-white active:scale-95"
          >
            <Delete className="size-5" />
          </button>

          <button
            type="button"
            onClick={() => appendDigit("0")}
            disabled={isAnyLoading}
            className="flex h-12 items-center justify-center rounded-xl border border-slate-800/80 bg-slate-900/80 text-lg font-semibold text-white transition-all hover:bg-slate-800 hover:border-slate-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            0
          </button>

          <button
            type="submit"
            disabled={isAnyLoading || !formLikelyValid}
            className={cn(
              "flex h-12 items-center justify-center rounded-xl transition-all active:scale-95",
              formLikelyValid
                ? "bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-600/20"
                : "border border-blue-500/20 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20",
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

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full justify-center gap-2 rounded-full bg-blue-600 py-6 text-smd font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 disabled:opacity-100"
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

        <p className="pt-1 text-center text-[12px] leading-relaxed text-slate-400">
          After a valid 4-digit PIN is entered, authentication runs automatically.
          Transmission is over HTTPS only, and repeated invalid attempts are rate-limited.
        </p>
      </div>
    </form>
  );
}