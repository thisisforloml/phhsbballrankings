import Link from "next/link";

import { GameScoreBoard } from "@/components/public/GameScoreBoard";
import { LeagueInfoPanel, LeagueStandingsPanel } from "@/components/public/LeagueStandingsPanel";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { ScoutPageHeader } from "@/components/public/ScoutPageHeader";
import { ScoutSectionLabel } from "@/components/public/ScoutSectionLabel";
import { getLeagueTopPerformers,getOfficialLeagueDetail } from "@/lib/official-games";
import { getDynamicTeamStandings, getLeagueStandingsRows, type TeamStandingsAgeGroup } from "@/lib/team-rankings";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const league = await getOfficialLeagueDetail(params.id);
  return { title: league.name };
}

function inferGenderLabel(name: string) {
  return name.toLowerCase().includes("girls") ? "Girls" : "Boys";
}

export default async function LeagueDetailPage({ params }: { params: { id: string } }) {
  const league = await getOfficialLeagueDetail(params.id);
  const [topPerformers, standingsData] = await Promise.all([
    getLeagueTopPerformers(league.id),
    getDynamicTeamStandings(),
  ]);

  const games = league.seasons.flatMap((season) =>
    season.games.map((game) => ({
      id: game.id,
      gameNumber: game.gameNumber,
      gameDate: game.gameDate,
      verificationStatus: game.verificationStatus,
      leagueName: league.name,
      seasonName: season.name,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      homeTeam: { name: game.homeTeam.name },
      awayTeam: { name: game.awayTeam.name },
    }))
  );

  const teamIds = new Set(
    league.seasons.flatMap((season) => season.games.flatMap((game) => [game.homeTeamId, game.awayTeamId]))
  );
  const latestSeason = league.seasons[0] ?? null;
  const standingRows = getLeagueStandingsRows(standingsData, {
    name: league.name,
    ageGroup: league.ageGroup as TeamStandingsAgeGroup,
  });

  const infoItems = [
    { label: "Season", value: latestSeason?.name ?? "Not listed" },
    { label: "Division", value: `${league.ageGroup} ${inferGenderLabel(league.name)}` },
    { label: "Teams", value: String(standingRows.length || teamIds.size) },
    { label: "Games played", value: String(games.length) },
    { label: "Organizer", value: league.organizerName },
    { label: "Location", value: [league.city, league.region].filter(Boolean).join(", ") || "Philippines" },
  ];

  return (
    <PublicPageShell variant="scout" className="pb-20 pt-20">
      <ScoutPageHeader
        eyebrow="Philippines"
        title={league.name}
        meta={`${inferGenderLabel(league.name)} basketball · ${league.ageGroup} · ${games.length} official games`}
      />

      <section className="container-px py-6 md:py-8">
        <div className="mx-auto grid max-w-[74rem] gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <LeagueStandingsPanel rows={standingRows} />
          <LeagueInfoPanel items={infoItems} />
        </div>
      </section>

      {topPerformers.length ? (
        <section className="container-px pb-6">
          <div className="mx-auto max-w-[74rem]">
            <ScoutSectionLabel className="mb-4">Top performers</ScoutSectionLabel>
            <div className="overflow-hidden rounded-sm border border-white/[0.08] bg-scout-800/80">
              {topPerformers.map((player) => (
                <Link
                  key={player.slug}
                  href={`/players/${player.slug}`}
                  className="grid grid-cols-[1fr_5rem] items-center gap-3 border-b border-white/5 px-4 py-3 last:border-b-0 hover:bg-white/5"
                >
                  <span>
                    <strong className="block text-white">{player.displayName}</strong>
                    <small className="text-white/45">{player.position ?? "Position not listed"}</small>
                  </span>
                  <span className="text-right">
                    <strong className="font-numeric block text-lg font-normal text-scout-orange-bright">{player.ppg}</strong>
                    <small className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-white/35">PPG</small>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="container-px py-6 md:py-8">
        <div className="mx-auto max-w-[74rem]">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <ScoutSectionLabel>Schedule & results</ScoutSectionLabel>
            <Link href="/leagues" className="text-sm font-semibold text-scout-orange-bright hover:text-scout-orange">
              Back to leagues
            </Link>
          </div>
          {games.length ? (
            <GameScoreBoard games={games} />
          ) : (
            <p className="rounded-sm border border-white/[0.08] bg-scout-800/80 p-4 text-scout-500">
              No official games are listed for this league yet.
            </p>
          )}
        </div>
      </section>
    </PublicPageShell>
  );
}
