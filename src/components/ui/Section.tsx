import type { ReactNode } from "react";

type SectionProps = {
  children: ReactNode;
  className?: string;
  /** Apply standard page top padding to clear the fixed header. */
  page?: boolean;
};

/** Standard content wrapper with consistent gutters + rhythm. */
export function Section({ children, className = "", page = false }: SectionProps) {
  return (
    <div className={`container-px ${page ? "py-12 pt-28 lg:py-16 lg:pt-32" : "py-10 lg:py-14"} ${className}`}>
      {children}
    </div>
  );
}
