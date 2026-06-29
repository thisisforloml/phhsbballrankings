import { Suspense } from "react";
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
    <PublicPageShell variant="paper" className="pb-12 pt-20">
      <Suspense fallback={<div className="container-px py-10 text-sm font-semibold text-court-600">Loading team standings…</div>}>
        <TeamsClient
          competitionData={competitionData}
          nationalData={nationalData}
          nationalEnabled={TEAM_NATIONAL_RATINGS_ENABLED}
        />
      </Suspense>
    </PublicPageShell>
  );
}
