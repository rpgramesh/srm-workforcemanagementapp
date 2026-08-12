import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CURRENCY_LOCALE =
  (typeof navigator !== "undefined" ? navigator.language : undefined) ?? "en-AU";

export function formatCurrency(
  amount: number | null | undefined,
  opts: { currency?: string; fractionDigits?: number } = {},
): string {
  if (amount == null || !Number.isFinite(amount)) return "$0.00";
  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: "currency",
    currency: opts.currency ?? "AUD",
    minimumFractionDigits: opts.fractionDigits ?? 2,
    maximumFractionDigits: opts.fractionDigits ?? 2,
  }).format(amount);
}

export function calcGrossFromMinutes(
  minutes: number,
  hourlyRate: number | null | undefined,
): number | null {
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  if (hourlyRate == null || !Number.isFinite(hourlyRate) || hourlyRate < 0) return null;
  const hours = minutes / 60;
  return Math.round(hours * hourlyRate * 100) / 100;
}

