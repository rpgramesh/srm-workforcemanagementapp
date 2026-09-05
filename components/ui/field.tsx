"use client";

import * as React from "react";
import { clsx } from "clsx";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };
type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };
type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean };

const base =
  "block w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-2.5 text-sm font-medium text-white placeholder:text-slate-500 shadow-inner shadow-slate-950/40 transition outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

const invalidClass = "border-rose-500/50 focus:border-rose-500 focus:ring-rose-500";

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id?: string;
  label: React.ReactNode;
  hint?: string;
  error?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {label ? (
        <label
          htmlFor={id}
          className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
        >
          {label}
        </label>
      ) : null}
      {children}
      {hint && !error ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {error ? <p className="text-xs font-medium text-rose-400">{error}</p> : null}
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={clsx(base, invalid && invalidClass, className)}
      {...props}
    />
  );
});

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { className, invalid, rows = 3, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={clsx(base, "resize-y", invalid && invalidClass, className)}
      {...props}
    />
  );
});

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={clsx(base, "appearance-none pr-10", invalid && invalidClass, className)}
      {...props}
    >
      {children}
    </select>
  );
});

export function SwitchField({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white/5 p-3 transition hover:bg-white/10">
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
            "mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition",
          checked ? "bg-blue-600" : "bg-white/10",
        )}
      >
        <span
          className={clsx(
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
        ) : null}
      </span>
    </label>
  );
}
