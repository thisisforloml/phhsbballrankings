import Link from "next/link";

export function AdminEmptyState({
  variant,
  subject = "records",
  clearFiltersHref,
  onClearFilters,
  className = ""
}: {
  variant: "no-records" | "no-matches";
  subject?: string;
  clearFiltersHref?: string;
  onClearFilters?: () => void;
  className?: string;
}) {
  if (variant === "no-records") {
    return (
      <div className={`border border-surface-200 bg-white p-5 text-sm text-ink-600 shadow-sm ${className}`}>
        No {subject}.
      </div>
    );
  }

  return (
    <div className={`border border-surface-200 bg-white p-5 text-sm text-ink-600 shadow-sm ${className}`}>
      <p>No matches for the current filters.</p>
      {clearFiltersHref ? (
        <Link href={clearFiltersHref} prefetch={false} className="mt-2 inline-block font-mono text-[0.65rem] font-bold uppercase tracking-[0.1em] text-orange-700 hover:text-orange-800">
          Clear filters
        </Link>
      ) : onClearFilters ? (
        <button type="button" onClick={onClearFilters} className="mt-2 font-mono text-[0.65rem] font-bold uppercase tracking-[0.1em] text-orange-700 hover:text-orange-800">
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
