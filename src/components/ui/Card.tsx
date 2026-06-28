import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
  tone?: "default" | "muted" | "dark";
  id?: string;
};

const toneClass: Record<NonNullable<CardProps["tone"]>, string> = {
  default: "border-line-500 bg-white",
  muted: "border-line-500 bg-paper-500",
  dark: "border-white/10 bg-court-900 text-white"
};

/**
 * The single card shell used across the whole product. Replaces ProfileModule,
 * AdminPageTemplate body, sports-module, .profile-card, etc.
 */
export function Card({ children, className = "", as: Tag = "section", tone = "default", id }: CardProps) {
  return (
    <Tag id={id} className={`scroll-mt-28 overflow-hidden border shadow-panel ${toneClass[tone]} ${className}`}>{children}</Tag>
  );
}

type CardHeaderProps = {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function CardHeader({ title, eyebrow, description, action, className = "" }: CardHeaderProps) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 border-b border-line-500 px-4 py-3 ${className}`}>
      <div className="min-w-0">
        {eyebrow ? <p className="text-label font-semibold uppercase tracking-[0.08em] text-hardwood-600">{eyebrow}</p> : null}
        <h2 className="font-display text-xl font-black leading-tight text-court-900 md:text-2xl">{title}</h2>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-5 text-court-600">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}
