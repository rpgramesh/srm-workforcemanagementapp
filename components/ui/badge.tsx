"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { cn } from "@/lib/utils";

const TONES = {
  emerald: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25",
  slate: "bg-white/8 text-slate-300 border border-white/12",
  amber: "bg-amber-400/15 text-amber-300 border border-amber-400/25",
  rose: "bg-rose-400/15 text-rose-300 border border-rose-400/25",
  sky: "bg-sky-400/15 text-sky-300 border border-sky-400/25",
  indigo: "bg-indigo-400/15 text-indigo-300 border border-indigo-400/25",
  teal: "bg-teal-400/15 text-teal-300 border border-teal-400/25",
  violet: "bg-violet-400/15 text-violet-300 border border-violet-400/25",
  neutral: "bg-white/6 text-slate-400 border border-white/10",
  blue: "bg-blue-500/15 text-blue-300 border border-blue-500/25",
} as const;

export type BadgeTone = keyof typeof TONES;

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em]",
  {
    variants: {
      variant: {
        emerald: TONES.emerald,
        slate: TONES.slate,
        amber: TONES.amber,
        rose: TONES.rose,
        sky: TONES.sky,
      },
    },
    defaultVariants: {
      variant: "slate",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  tone?: BadgeTone;
  size?: "sm" | "md" | "lg";
  dotColor?: string | null | undefined;
}

export function Badge({ className, variant, tone, size, dotColor, style, children, ...props }: BadgeProps) {
  const toneClass = tone ? TONES[tone] : undefined;
  const sizeClass =
    size === "sm"
      ? "px-2 py-0.5 text-[9px] tracking-[0.18em]"
      : size === "lg"
        ? "px-3.5 py-1.5 text-[11px]"
        : null;
  return (
    <span
      className={cn(
        badgeVariants({ variant }),
        toneClass,
        sizeClass,
        className,
      )}
      style={style}
      {...props}
    >
      {dotColor ? (
        <span
          aria-hidden
          className={clsx("mr-1.5 inline-block rounded-full border border-black/20", size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2")}
          style={{ backgroundColor: dotColor }}
        />
      ) : null}
      {children}
    </span>
  );
}
