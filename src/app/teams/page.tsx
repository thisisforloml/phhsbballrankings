import { getDynamicTeamStandings } from "@/lib/team-rankings";
import { TEAM_NATIONAL_RATINGS_ENABLED } from "@/lib/team-ratings/feature-flags";
import { getNationalTeamRankings } from "@/lib/team-ratings/get-national-team-rankings";
import { TeamsClient } from "./TeamsClient";
import { PublicPageShell } from "@/components/public/PublicPageShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TeamsPage() {
  const competitionData = await getDynamicTeamStandings();
  const nationalData = TEAM_NATIONAL_RATINGS_ENABLED ? await getNationalTeamRankings() : null;

  return (
    <PublicPageShell variant="scout" className="pb-12 pt-20">
      <TeamsClient
        competitionData={competitionData}
        nationalData={nationalData}
        nationalEnabled={TEAM_NATIONAL_RATINGS_ENABLED}
      />
    </PublicPageShell>
  );
}
