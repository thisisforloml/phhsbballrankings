import { LoadingFilters, LoadingHero, LoadingTable } from "@/components/loading";
import { PublicPageShell } from "@/components/public/PublicPageShell";

function PlayerSearchLoadingSkeleton() {
  return (
    <section className="bg-paper-500" aria-busy="true" aria-label="Loading player search">
      <LoadingHero variant="page" />
      <LoadingFilters fields={4} />

      <section className="container-px mt-8">
        <div className="mx-auto max-w-[74rem]">
          <LoadingTable rows={6} />
        </div>
      </section>
    </section>
  );
}

export default function PlayerSearchLoading() {
  return (
    <PublicPageShell className="pb-12 pt-24">
      <PlayerSearchLoadingSkeleton />
    </PublicPageShell>
  );
}
