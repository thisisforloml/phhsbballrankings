import type { PublicLeagueRow } from "@/lib/public-site-data";
import { LeagueCard } from "@/components/public/LeagueCard";

export function LeagueGrid({ leagues }: { leagues: PublicLeagueRow[] }) {
  return (
    <div className="overflow-hidden border border-line-500 bg-white">
      {leagues.map((league) => <LeagueCard key={league.id} league={league} />)}
    </div>
  );
}
