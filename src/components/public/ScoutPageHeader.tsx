import type { ReactNode } from "react";

type ScoutPageHeaderProps = {
  eyebrow: string;
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function ScoutPageHeader({ eyebrow, title, meta, action, className = "" }: ScoutPageHeaderProps) {
  return (
    <section className={`border-b border-white/10 bg-court-900 ${className}`}>
      <div className="container-px py-6 md:py-8">
        <div className="mx-auto flex max-w-[74rem] flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-scout-orange-bright">
              <span aria-hidden="true" className="inline-block h-4 w-1 bg-scout-orange" />
              {eyebrow}
            </p>
            <h1 className="mt-2 font-display text-[clamp(1.75rem,4vw,2.75rem)] font-bold uppercase leading-[1.02] tracking-tight text-white">
              {title}
            </h1>
            {meta ? <div className="mt-2 text-sm font-medium text-white/55">{meta}</div> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </div>
    </section>
  );
}
