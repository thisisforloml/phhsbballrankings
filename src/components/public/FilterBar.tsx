import type { ReactNode } from "react";

type FilterBarProps = {
  children: ReactNode;
  summary?: ReactNode;
  action?: ReactNode;
};

export function FilterBar({ children, summary, action }: FilterBarProps) {
  return (
    <section className="border-y border-line-500 bg-white">
      <div className="container-px py-5">
        <div className="grid gap-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr_1fr_1fr_1fr] lg:items-end">{children}</div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {summary ? <p className="text-xs font-semibold uppercase tracking-[0.12em] text-court-500">{summary}</p> : <span />}
            {action}
          </div>
        </div>
      </div>
    </section>
  );
}

type FieldProps = {
  label: string;
  children: ReactNode;
};

export function FilterField({ label, children }: FieldProps) {
  return (
    <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-court-500">
      {label}
      {children}
    </label>
  );
}

export function FilterControlClass() {
  return "min-h-12 rounded-sm border border-line-500 bg-paper-500 px-3 py-2 text-sm font-semibold text-court-900 outline-none transition placeholder:text-court-400 focus:border-hardwood-600 focus:bg-white";
}
