import Link from "next/link";
import type { ReactNode } from "react";

const defaultStatusBadgeClassName = "border border-navy-200 bg-navy-50 px-3 py-1.5 font-mono text-[0.68rem] font-bold uppercase tracking-[0.1em] text-navy-800";

export function AdminPageHeader({
  backLink,
  eyebrow,
  title,
  description,
  actions,
  statusBadge,
  children,
}: {
  backLink?: { href: string; label: string };
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
  statusBadge?: string | { label: string; className?: string };
  children?: ReactNode;
}) {
  const statusBadgeLabel = typeof statusBadge === "string" ? statusBadge : statusBadge?.label;
  const statusBadgeClassName = typeof statusBadge === "string"
    ? defaultStatusBadgeClassName
    : statusBadge?.className ?? defaultStatusBadgeClassName;

  return (
    <div className="border border-surface-200 bg-white p-3.5 shadow-sm">
      {backLink ? (
        <Link href={backLink.href} prefetch={false} className="text-xs font-semibold text-orange-700 hover:text-orange-800">
          {backLink.label}
        </Link>
      ) : null}
      <div className={`flex flex-wrap items-end justify-between gap-4 ${backLink ? "mt-2" : ""}`}>
        <div className="min-w-0">
          {eyebrow ? <p className="text-xs font-semibold text-orange-700">{eyebrow}</p> : null}
          <h1 className="mt-0.5 font-display text-2xl leading-tight text-navy-900 md:text-3xl">{title}</h1>
          {description ? <p className="mt-1 max-w-3xl text-xs text-ink-600 sm:text-sm">{description}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {statusBadgeLabel ? <span className={statusBadgeClassName}>{statusBadgeLabel}</span> : null}
          {actions}
        </div>
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
