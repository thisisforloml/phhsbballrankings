import { getPublicTeamRankings } from "@/lib/public-site-data";
import { TeamsClient } from "./TeamsClient";

export default async function TeamsPage() {
  const teams = await getPublicTeamRankings();

  return (
    <main className="bg-surface-50 pb-20">
      <section className="bg-[#0F2044] pt-32 text-white">
        <div className="container-px py-14">
          <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">Team Rankings</p>
          <h1 className="mt-3 font-display text-stat-lg">Team Rankings</h1>
          <p className="mt-4 max-w-2xl text-[#ABABAB]">Current team standings from official logged games. Formula v1 player ratings are not affected by this display.</p>
        </div>
      </section>
      <TeamsClient teams={teams} />
    </main>
  );
}