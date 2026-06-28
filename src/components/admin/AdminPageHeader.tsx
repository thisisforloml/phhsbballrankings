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
  children
}: {
  backLink?: { href: string; label: string };
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  statusBadge?: string | { label: string; className?: string };
  children?: ReactNode;
}) {
  const statusBadgeLabel = typeof statusBadge === "string" ? statusBadge : statusBadge?.label;
  const statusBadgeClassName = typeof statusBadge === "string" ? defaultStatusBadgeClassName : statusBadge?.className ?? defaultStatusBadgeClassName;

  return (
    <div className="border border-surface-200 bg-white p-4 shadow-sm">
      {backLink ? (
        <Link href={backLink.href} className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.12em] text-orange-700 hover:text-orange-800">
          {backLink.label}
        </Link>
      ) : null}
      <div className={`flex flex-wrap items-end justify-between gap-4 ${backLink ? "mt-3" : ""}`}>
        <div className="min-w-0">
          <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.16em] text-orange-600">{eyebrow}</p>
          <h1 className="mt-1 font-display text-3xl leading-tight text-navy-900 md:text-4xl">{title}</h1>
          {description ? <p className="mt-1 max-w-3xl text-sm text-ink-600">{description}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {statusBadgeLabel ? <span className={statusBadgeClassName}>{statusBadgeLabel}</span> : null}
          {actions}
        </div>
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
