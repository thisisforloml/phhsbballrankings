import { PublicPageShell } from "@/components/public/PublicPageShell";
import { Skeleton } from "@/components/ui/Skeleton";

function FilterSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`grid gap-1 ${className}`}>
      <Skeleton className="h-3 w-14" />
      <Skeleton className="h-10 w-full min-w-[8.5rem]" />
    </div>
  );
}

function RankingsLoadingSkeleton() {
  return (
    <section className="bg-paper-500" aria-busy="true" aria-label="Loading rankings">
      <div className="container-px py-6 md:py-8">
        <div className="mx-auto max-w-[74rem]">
          <Skeleton className="h-3 w-48" />
          <Skeleton className="mt-3 h-9 w-72 max-w-full md:h-11 md:w-96" />
          <Skeleton className="mt-3 h-4 w-40" />
        </div>
      </div>

      <div className="sticky top-[var(--navbar-height)] z-30 bg-paper-500">
        <div className="container-px pb-4">
          <div className="mx-auto max-w-[74rem]">
            <div className="hidden flex-wrap items-end gap-3 lg:flex">
              <FilterSkeleton className="min-w-[14rem] flex-1" />
              <FilterSkeleton />
              <FilterSkeleton />
              <FilterSkeleton />
              <FilterSkeleton />
              <FilterSkeleton className="min-w-[10rem]" />
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

      <section className="container-px">
        <div className="mx-auto max-w-[74rem]">
          <Skeleton className="mb-3 h-4 w-56" />

          <div className="overflow-hidden rounded-sm border border-line-500 bg-white shadow-panel">
            <div className="hidden border-b border-line-500 px-4 py-3 lg:grid lg:grid-cols-[3rem_minmax(14rem,1.6fr)_minmax(8rem,1fr)_6rem_4rem_minmax(8rem,0.9fr)_6rem] lg:gap-x-4">
              {Array.from({ length: 7 }).map((_, index) => (
                <Skeleton key={index} className="mx-auto h-3 w-12" />
              ))}
            </div>

            {Array.from({ length: 9 }).map((_, index) => (
              <div
                key={index}
                className={`grid grid-cols-[2.5rem_minmax(0,1fr)_4.25rem] items-center gap-x-3 px-3 py-2.5 lg:grid-cols-[3rem_minmax(14rem,1.6fr)_minmax(8rem,1fr)_6rem_4rem_minmax(8rem,0.9fr)_6rem] lg:gap-x-4 lg:px-4 lg:py-3.5 ${
                  index < 8 ? "border-b border-line-500" : ""
                }`}
              >
                <Skeleton className="mx-auto h-6 w-6 lg:h-7 lg:w-8" />
                <div className="flex min-w-0 items-center gap-2.5">
                  <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-36 max-w-full" />
                    <Skeleton className="h-3 w-28 max-w-[80%]" />
                  </div>
                </div>
                <Skeleton className="hidden h-4 w-20 justify-self-center lg:block" />
                <Skeleton className="hidden h-4 w-12 justify-self-center lg:block" />
                <Skeleton className="hidden h-4 w-8 justify-self-center lg:block" />
                <Skeleton className="hidden h-4 w-16 justify-self-center lg:block" />
                <div className="flex flex-col items-end gap-1 lg:items-center">
                  <Skeleton className="h-5 w-10" />
                  <Skeleton className="h-3 w-14" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}

export default function RankingsLoading() {
  return (
    <PublicPageShell variant="paper" className="pb-12 pt-20">
      <RankingsLoadingSkeleton />
    </PublicPageShell>
  );
}
