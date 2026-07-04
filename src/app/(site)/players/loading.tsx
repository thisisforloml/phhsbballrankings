import { PlayerProfileLoadingSkeleton, PublicPageLoading } from "@/components/loading";

export default function PlayersLoading() {
  return (
    <PublicPageLoading className="pt-0 pb-10" label="Loading player profile">
      <PlayerProfileLoadingSkeleton />
    </PublicPageLoading>
  );
}
