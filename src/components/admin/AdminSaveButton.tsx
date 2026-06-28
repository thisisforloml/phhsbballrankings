"use client";

import { useFormStatus } from "react-dom";

export function AdminSaveButton({
  label,
  pendingLabel = "Saving...",
  variant = "primary",
  className = "",
  disabled = false
}: {
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "ops";
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  if (variant === "ops") {
    return (
      <button
        type="submit"
        disabled={isDisabled}
        className={`border border-orange-600 bg-orange-600 px-3 py-2 font-mono text-[0.68rem] font-bold uppercase tracking-[0.1em] text-white disabled:opacity-60 ${className}`.trim()}
      >
        {pending ? pendingLabel : label}
      </button>
    );
  }

  return (
    <button type="submit" disabled={isDisabled} className={`button primary disabled:opacity-60 ${className}`.trim()}>
      {pending ? pendingLabel : label}
    </button>
  );
}
