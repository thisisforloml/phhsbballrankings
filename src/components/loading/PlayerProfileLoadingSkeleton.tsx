import { LoadingGameCard } from "@/components/loading/LoadingGameCard";
import { LoadingHero } from "@/components/loading/LoadingHero";
import { LoadingStatCards } from "@/components/loading/LoadingStatCards";
import { LoadingTable } from "@/components/loading/LoadingTable";

/** Player profile loading skeleton — matches paper profile layout. */
export function PlayerProfileLoadingSkeleton() {
  return (
    <section className="bg-paper-500" aria-busy="true" aria-label="Loading player profile">
      <LoadingHero variant="profile" />

      <div className="container-px pb-10 pt-3">
        <div className="mx-auto grid max-w-[950px] gap-4">
          <LoadingStatCards items={4} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <LoadingGameCard />
            <LoadingGameCard />
          </div>
          <LoadingTable rows={6} />
        </div>
      </div>
    </section>
  );
}
