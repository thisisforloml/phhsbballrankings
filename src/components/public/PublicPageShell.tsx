import type { ReactNode } from "react";

type PublicPageShellProps = {
  children: ReactNode;
  className?: string;
  variant?: "paper" | "scout";
};

export function PublicPageShell({ children, className = "", variant = "paper" }: PublicPageShellProps) {
  const shellClass =
    variant === "scout"
      ? "min-h-screen bg-scout-900 text-scout-50"
      : "min-h-screen bg-paper-500 text-court-900";

  return <main className={`${shellClass} ${className}`}>{children}</main>;
}
