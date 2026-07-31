import { createSupabaseServerClient } from "@/lib/supabase";

export const sb = () => createSupabaseServerClient();

export function handleResult<T>(
  result: { data: T | null; error?: unknown } | { data?: T; error?: unknown },
  fallback: T,
): T {
  if (result.error) {
    // Server actions swallow errors in build, throw safely for server-side logs.
    if (typeof window === "undefined") {
      throw new Error(
        `Supabase error: ${result.error instanceof Error ? result.error.message : String(result.error)}`,
      );
    }
    return fallback;
  }
  return (result.data ?? fallback) as T;
}

export const parseDateOnly = (iso: unknown): string | null => {
  if (iso == null) return null;
  if (typeof iso === "string") return iso.length >= 10 ? iso.slice(0, 10) : iso;
  if (iso instanceof Date) return iso.toISOString().slice(0, 10);
  return String(iso);
};

export const parseTimeOnly = (t: unknown): string | null => {
  if (t == null) return null;
  if (typeof t !== "string") return null;
  if (/^\d{1,2}:\d{2}/.test(t)) return t.slice(0, 5);
  return t;
};

export const initials = (fullName: string | null | undefined): string => {
  if (!fullName) return "??";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
};

export const floorMinToHuman = (totalMinutes: number): string => {
  const sign = totalMinutes < 0 ? "-" : "";
  const abs = Math.abs(totalMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
};

export const currency = (value: number | null, code = "AUD"): string => {
  if (value == null || Number.isNaN(value)) return "$0.00";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: code, maximumFractionDigits: 2 }).format(value);
};

export const compactNumber = (value: number | null): string => {
  if (value == null || Number.isNaN(value)) return "0";
  return new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2, notation: "compact", compactDisplay: "short" }).format(value);
};

export const formatTimeRange = (startIso: string | null, endIso: string | null): string => {
  if (!startIso || !endIso) return "OFF";
  const fmt = (t: string) => {
    const d = new Date(t.includes("T") ? t : `2000-01-01T${t}`);
    return d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
  };
  return `${fmt(startIso)} – ${fmt(endIso)}`;
};
