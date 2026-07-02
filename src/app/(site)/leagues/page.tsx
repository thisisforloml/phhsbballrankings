import { PublicPageShell } from "@/components/public/PublicPageShell";
import { ScoutPageHeader } from "@/components/public/ScoutPageHeader";
import { getPublicLeagues } from "@/lib/public-site-data";

import { LeaguesClient } from "./LeaguesClient";

export default async function LeaguesPage() {
  const leagues = await getPublicLeagues();

  return (
    <PublicPageShell variant="scout" className="pb-12 pt-20">
      <ScoutPageHeader
        eyebrow="Competitions"
        title="Leagues"
      />
      <LeaguesClient leagues={leagues} />
    </PublicPageShell>
  );
}
