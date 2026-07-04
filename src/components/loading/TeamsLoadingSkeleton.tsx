import { LoadingFilters } from "@/components/loading/LoadingFilters";
import { LoadingHero } from "@/components/loading/LoadingHero";
import { LoadingTeamCard } from "@/components/loading/LoadingTeamCard";
import { Skeleton } from "@/components/ui/Skeleton";

export function TeamsLoadingSkeleton() {
  return (
    <section className="bg-paper-500" aria-busy="true" aria-label="Loading teams">
      <LoadingHero variant="page" />
      <LoadingFilters />

      <section className="container-px mt-2 pb-4">
        <div className="mx-auto max-w-[74rem]">
          <Skeleton className="mb-3 h-4 w-56" />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <LoadingTeamCard key={index} />
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}
