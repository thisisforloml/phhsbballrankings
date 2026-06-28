import { getPublicLeagues } from "@/lib/public-site-data";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { PageBand } from "@/components/public/PageBand";
import { LeaguesClient } from "./LeaguesClient";

export default async function LeaguesPage() {
  const leagues = await getPublicLeagues();

  return (
    <PublicPageShell className="pb-12 pt-24">
      <PageBand
        eyebrow="Competitions"
        title="Leagues & Competitions"
        description="Verified leagues and seasons that feed Peach Basket rankings, team records, and player profiles."
      />
      <LeaguesClient leagues={leagues} />
    </PublicPageShell>
  );
}
