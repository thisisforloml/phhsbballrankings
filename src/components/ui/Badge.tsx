import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "primary" | "accent" | "success" | "warning" | "danger";

const tones: Record<BadgeTone, string> = {
  neutral: "border-neutral-200 bg-neutral-100 text-neutral-700",
  primary: "border-primary-100 bg-primary-50 text-primary-700",
  accent: "border-accent-200 bg-accent-50 text-accent-700",
  success: "border-success-100 bg-success-50 text-success-700",
  warning: "border-warning-100 bg-warning-50 text-warning-700",
  danger: "border-danger-100 bg-danger-50 text-danger-700"
};

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  uppercase?: boolean;
};

/** One badge / status-pill family used everywhere (admin + public). */
export function Badge({ children, tone = "neutral", className = "", uppercase = false }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        uppercase ? "uppercase tracking-[0.06em]" : ""
      } ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
