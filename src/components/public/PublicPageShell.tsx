import type { ReactNode } from "react";

type PublicPageShellProps = {
  children: ReactNode;
  className?: string;
};

export function PublicPageShell({ children, className = "" }: PublicPageShellProps) {
  return <main className={`min-h-screen bg-paper-500 text-court-900 ${className}`}>{children}</main>;
}
