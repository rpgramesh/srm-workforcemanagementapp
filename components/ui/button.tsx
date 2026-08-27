"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary:
          "bg-blue-600 text-white shadow-[0_2px_16px_rgba(59,130,246,0.35)] hover:bg-blue-500 hover:shadow-[0_4px_20px_rgba(59,130,246,0.45)] active:scale-[0.98]",
        subtle:
          "border border-white/10 bg-white/8 text-slate-200 hover:bg-white/12 hover:border-white/16 active:scale-[0.98]",
        ghost:
          "text-slate-300 hover:bg-white/8 hover:text-slate-100 border border-transparent active:scale-[0.98]",
        danger:
          "bg-rose-600/20 border border-rose-500/30 text-rose-300 hover:bg-rose-600/30 hover:border-rose-400/50 active:scale-[0.98]",
      },
      size: {
        sm: "h-8 px-4 text-xs",
        md: "h-10 px-5",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "subtle",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", icon, children, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {icon ?? null}
      {children}
    </button>
  ),
);

Button.displayName = "Button";
