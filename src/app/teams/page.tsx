import { getDynamicTeamStandings } from "@/lib/team-rankings";
import { TeamsClient } from "./TeamsClient";
import { PublicPageShell } from "@/components/public/PublicPageShell";

export default async function TeamsPage() {
  const standings = await getDynamicTeamStandings();

  return (
    <PublicPageShell className="pb-20 pt-28">
      <TeamsClient data={standings} />
    </PublicPageShell>
  );
}
