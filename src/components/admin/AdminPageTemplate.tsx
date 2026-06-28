import type { ReactNode } from "react";

type AdminPageTemplateProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  advanced?: ReactNode;
};

export function AdminPageTemplate({ title, description, actions, children, advanced }: AdminPageTemplateProps) {
  return (
    <div className="grid gap-4">
      <header className="rounded-lg border border-neutral-200 bg-white px-5 py-4 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-title font-bold leading-tight text-neutral-900">{title}</h1>
            {description ? <p className="mt-1 max-w-3xl text-sm text-neutral-500">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </header>
      <div className="grid gap-4">{children}</div>
      {advanced ? (
        <details className="rounded-lg border border-neutral-200 bg-white shadow-card">
          <summary className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Advanced / danger zone</summary>
          <div className="border-t border-neutral-200 p-4">{advanced}</div>
        </details>
      ) : null}
    </div>
  );
}
