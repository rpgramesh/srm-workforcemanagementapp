"use client";

import * as React from "react";
import { clsx } from "clsx";
import { cn } from "@/lib/utils";

const SIZE_CLASS: Record<string, string> = {
  xs: "h-7 w-7 text-[10px] rounded-lg",
  sm: "h-9 w-9 text-xs rounded-xl",
  md: "h-11 w-11 text-sm rounded-2xl",
  lg: "h-14 w-14 text-base rounded-2xl",
  xl: "h-16 w-16 text-lg rounded-2xl",
};

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  firstName?: string;
  lastName?: string;
  size?: keyof typeof SIZE_CLASS | string;
  accent?: string;
  src?: string | null;
  alt?: string;
}

const DEFAULT_GRADIENTS = [
  "from-emerald-400/30 to-sky-400/30",
  "from-amber-400/30 to-rose-400/30",
  "from-violet-400/30 to-indigo-400/30",
  "from-teal-400/30 to-emerald-400/30",
  "from-rose-400/30 to-fuchsia-400/30",
  "from-sky-400/30 to-indigo-400/30",
];

function pickGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return DEFAULT_GRADIENTS[hash % DEFAULT_GRADIENTS.length]!;
}

export function Avatar({
  className,
  firstName = "",
  lastName = "",
  size = "md",
  accent,
  src,
  alt,
  style,
  children,
  ...props
}: AvatarProps) {
  const initials = `${firstName.slice(0, 1)}${lastName.slice(0, 1)}`.toUpperCase() || (firstName || "?").slice(0, 2).toUpperCase();
  const sizeClass = SIZE_CLASS[size] ?? SIZE_CLASS.md;
  const gradientOrAccent = accent
    ? undefined
    : pickGradient((firstName + lastName) || "user");
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden border border-white/10 bg-white/5 font-semibold text-slate-100 flex items-center justify-center",
        sizeClass,
          accent ? "" : `bg-linear-to-br ${gradientOrAccent}`,
        className,
      )}
      style={accent ? { backgroundColor: accent, ...style } : style}
      {...props}
    >
      {src ? (
        <img
          src={src}
            alt={alt ?? (`${firstName} ${lastName}`.trim() || "avatar")}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className={clsx("tracking-[-0.02em]", children ? "hidden" : "")}>{initials || "•"}</span>
      )}
      {children}
    </div>
  );
}

export function AvatarFallback({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "flex size-full items-center justify-center bg-linear-to-br from-emerald-400/20 via-slate-950 to-sky-400/20",
        className,
      )}
      {...props}
    />
  );
}
