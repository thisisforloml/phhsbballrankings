import type { ReactNode } from "react";

type FilterBarProps = {
  children: ReactNode;
  summary?: ReactNode;
  action?: ReactNode;
};

export function FilterBar({ children, summary, action }: FilterBarProps) {
  return (
    <section className="border-b border-line-500 bg-white">
      <div className="container-px py-3">
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">{children}</div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {summary ? <p className="text-xs font-bold text-court-500">{summary}</p> : <span />}
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
    <label className="grid gap-1 text-xs font-bold text-court-500">
      {label}
      {children}
    </label>
  );
}

export function FilterControlClass() {
  return "min-h-9 rounded-sm border border-line-500 bg-paper-500 px-3 py-1.5 text-sm font-bold text-court-900 outline-none transition placeholder:text-court-400 focus:border-hardwood-600 focus:bg-white";
}
