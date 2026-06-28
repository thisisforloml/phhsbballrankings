import type { ReactNode } from "react";

type PageHeaderProps = {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/** Single page/section header used across admin + public surfaces. */
export function PageHeader({ title, eyebrow, description, actions, className = "" }: PageHeaderProps) {
  return (
    <div className={`mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between ${className}`}>
      <div className="min-w-0">
        {eyebrow ? <p className="text-label font-semibold uppercase tracking-[0.08em] text-accent-600">{eyebrow}</p> : null}
        <h1 className="font-display text-title font-bold tracking-tight text-neutral-900 lg:text-display">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500 lg:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
