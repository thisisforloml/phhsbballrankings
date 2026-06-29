import type { ReactNode } from "react";

type FilterToolbarProps = {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function FilterToolbar({ children, action, className = "" }: FilterToolbarProps) {
  return (
    <section className={`border-b border-line-500 bg-white ${className}`}>
      <div className="container-px py-4">
        <div className="grid gap-4">{children}</div>
        {action ? <div className="mt-3 flex justify-end">{action}</div> : null}
      </div>
    </section>
  );
}

type FilterToolbarRowProps = {
  children: ReactNode;
  className?: string;
};

export function FilterToolbarRow({ children, className = "" }: FilterToolbarRowProps) {
  return (
    <div className={`flex flex-wrap items-end gap-3 lg:flex-nowrap lg:gap-4 ${className}`}>
      {children}
    </div>
  );
}

type FilterToolbarFieldProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export function FilterToolbarField({ label, children, className = "" }: FilterToolbarFieldProps) {
  return (
    <label className={`grid min-w-[10rem] flex-1 gap-1 text-xs text-court-500 ${className}`}>
      {label}
      {children}
    </label>
  );
}

export function FilterToolbarControlClass() {
  return "min-h-9 w-full rounded-sm border border-line-500 bg-white px-3 py-1.5 text-sm text-court-800 outline-none transition placeholder:text-court-400 focus:border-court-700 focus:ring-1 focus:ring-court-700/20";
}
