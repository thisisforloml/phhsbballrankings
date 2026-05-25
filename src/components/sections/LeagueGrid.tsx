import type { PublicLeagueRow } from "@/lib/public-site-data";
import { LeagueCard } from "@/components/public/LeagueCard";

export function LeagueGrid({ leagues }: { leagues: PublicLeagueRow[] }) {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {leagues.map((league) => <LeagueCard key={league.id} league={league} />)}
    </div>
  );
}

