"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  footer?: ReactNode;
}

const SIZE_CLASS = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
} as const;

export function Modal({ open, onClose, title, subtitle, children, size = "md", footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto touch-scroll p-2 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          "relative z-10 w-full my-3 sm:my-8 rounded-2xl border border-white/[0.08] bg-[#0d1526] shadow-[0_24px_80px_rgba(0,0,0,0.7)] ring-1 ring-white/[0.04] max-h-[92vh] flex flex-col",
          SIZE_CLASS[size],
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-100">{title}</h2>
            {subtitle ? (
              <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-white/8 hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto touch-scroll px-4 py-4 sm:px-6 sm:py-5">{children}</div>
        {/* Footer */}
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2.5 sm:gap-3 border-t border-white/[0.07] bg-white/[0.02] px-4 py-3 sm:px-6 sm:py-4 rounded-b-2xl">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
