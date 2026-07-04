import {
  LoadingFilters,
  LoadingHero,
  LoadingTable,
} from "@/components/loading";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { Skeleton } from "@/components/ui/Skeleton";

function RankingsLoadingSkeleton() {
  return (
    <section className="bg-paper-500" aria-busy="true" aria-label="Loading rankings">
      <LoadingHero variant="page" />
      <LoadingFilters />

      <section className="container-px">
        <div className="mx-auto max-w-[74rem]">
          <Skeleton className="mb-3 h-4 w-56" />
          <LoadingTable rows={9} />
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
