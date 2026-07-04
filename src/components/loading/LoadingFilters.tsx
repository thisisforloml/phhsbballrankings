import { Skeleton } from "@/components/ui/Skeleton";

type LoadingFiltersProps = {
  fields?: number;
  className?: string;
};

function FilterFieldSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`grid gap-1 ${className}`}>
      <Skeleton className="h-3 w-14" />
      <Skeleton className="h-10 w-full min-w-[8.5rem]" />
    </div>
  );
}

export function LoadingFilters({ fields = 6, className = "" }: LoadingFiltersProps) {
  const fieldClassNames = [
    "min-w-[14rem] flex-1",
    "",
    "",
    "",
    "",
    "min-w-[10rem]",
  ];

  return (
    <div className={`sticky top-[var(--navbar-height)] z-30 bg-paper-500 ${className}`.trim()}>
      <div className="container-px pb-4">
        <div className="mx-auto max-w-[74rem]">
          <div className="hidden flex-wrap items-end gap-3 lg:flex">
            {Array.from({ length: fields }).map((_, index) => (
              <FilterFieldSkeleton key={index} className={fieldClassNames[index] ?? ""} />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 lg:hidden">
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-16 rounded-sm" />
              <Skeleton className="h-9 w-16 rounded-sm" />
            </div>
            <Skeleton className="h-10 w-20 rounded-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
