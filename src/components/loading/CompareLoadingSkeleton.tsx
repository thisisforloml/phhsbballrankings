import { LoadingAvatar } from "@/components/loading/LoadingAvatar";
import { LoadingChart } from "@/components/loading/LoadingChart";
import { LoadingHero } from "@/components/loading/LoadingHero";
import { LoadingStatCards } from "@/components/loading/LoadingStatCards";
import { Skeleton } from "@/components/ui/Skeleton";

function ComparePickerSkeleton() {
  return (
    <div className="border border-line-500 bg-white p-3">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-2 h-4 w-28" />
      <Skeleton className="mt-2 h-10 w-full" />
    </div>
  );
}

function CompareColumnSkeleton() {
  return (
    <div className="grid gap-3">
      <div className="border border-line-500 bg-white p-4">
        <div className="flex items-start gap-3">
          <LoadingAvatar className="h-16 w-16" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-6 w-40 max-w-full" />
            <Skeleton className="h-4 w-28 max-w-[80%]" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
        <Skeleton className="mt-3 h-9 w-28 rounded-sm" />
      </div>

      <div className="rounded-sm border border-line-500 bg-white p-4 shadow-panel">
        <Skeleton className="h-4 w-28" />
        <LoadingStatCards items={3} className="mt-3 grid-cols-3 sm:grid-cols-3" />
      </div>

      <LoadingChart />
    </div>
  );
}

export function CompareLoadingSkeleton() {
  return (
    <section className="bg-paper-500" aria-busy="true" aria-label="Loading player compare">
      <LoadingHero variant="page" />

      <section className="container-px pb-8">
        <div className="mx-auto max-w-[74rem]">
          <div className="grid gap-4 lg:grid-cols-2">
            <ComparePickerSkeleton />
            <ComparePickerSkeleton />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <CompareColumnSkeleton />
            <CompareColumnSkeleton />
          </div>
        </div>
      </section>
    </section>
  );
}
