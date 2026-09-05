"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-11 w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 text-sm font-medium text-white placeholder:text-slate-500 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
