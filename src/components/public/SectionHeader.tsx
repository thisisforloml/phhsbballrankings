import type { ReactNode } from "react";

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  dark?: boolean;
};

export function SectionHeader({ eyebrow, title, description, action, dark = false }: SectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className={`font-semibold uppercase tracking-[0.16em] ${dark ? "text-gold-500" : "text-hardwood-600"} text-[0.72rem]`}>
            {eyebrow}
          </p>
        ) : null}
        <h1 className={`mt-2 font-display text-[clamp(2.4rem,6vw,5.25rem)] font-black leading-none ${dark ? "text-white" : "text-court-900"}`}>
          {title}
        </h1>
        {description ? <p className={`mt-4 max-w-2xl text-base leading-7 ${dark ? "text-white/72" : "text-court-600"}`}>{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
