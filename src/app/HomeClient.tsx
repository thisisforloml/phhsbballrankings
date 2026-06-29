"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { HomeData, HomeRecentGame, PublicGender } from "@/lib/public-site-data";
import { publicRankingsCoverageCopy } from "@/lib/public-rankings-coverage";
import { buildCrossBoardFeaturedProspects } from "@/lib/home-featured-prospects";
import {
  FeaturedProspectsGrid,
  HeroSection,
  NationalBoardGenderToggle,
  NationalBoardRail,
} from "@/components/sections";
import { BoardMovementCards } from "@/components/public/BoardMovementCards";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { ScoutSectionLabel } from "@/components/public/ScoutSectionLabel";
import { TrustBand } from "@/components/public/TrustBand";
import { EmptyState } from "@/components/ui";
import { getProgramAbbreviation } from "@/lib/uaap-school-display";

const NATIONAL_BOARD_AGE = "U19" as const;

export function HomeClient({ data, lastUpdated }: { data: HomeData; lastUpdated?: string | null }) {
  const [gender, setGender] = useState<PublicGender>("Boys");

  const rankedPlayers = useMemo(() => {
    const board = data.leaderboardsByAge[NATIONAL_BOARD_AGE];
    return gender === "Girls" ? board.girls : board.boys;
  }, [data.leaderboardsByAge, gender]);

  const featuredProspects = useMemo(() => buildCrossBoardFeaturedProspects(data, 4), [data]);

  const rankDeltaByPlayerId = useMemo(
    () => Object.fromEntries(data.boardMovers.map((mover) => [mover.playerId, mover.delta])),
    [data.boardMovers]
  );

  const rankingsHref = `/rankings?gender=${gender}&age=${NATIONAL_BOARD_AGE}`;

  return (
    <PublicPageShell variant="scout" className="pt-0">
      <HeroSection data={data} />

      {data.boardMovers.length ? (
        <section className="container-px py-8 md:py-10">
          <div className="mx-auto max-w-[74rem]">
            <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
              <div>
                <ScoutSectionLabel>Board Movement</ScoutSectionLabel>
                <h2 className="mt-2 font-display text-2xl font-bold uppercase tracking-tight text-white">
                  This week on the board
                </h2>
              </div>
              <Link
                href="/rankings?gender=Boys&age=U19"
                className="text-xs font-bold uppercase tracking-[0.1em] text-scout-orange-bright hover:text-hardwood-500"
              >
                U19 Boys board →
              </Link>
            </div>
            <p className="mb-5 max-w-2xl text-sm text-scout-500">
              Biggest rank shifts from the latest verified snapshot — featured prospects and the national board below reflect these moves.
            </p>
            <BoardMovementCards movers={data.boardMovers} />
          </div>
        </section>
      ) : null}

      <section className="container-px pb-8 md:pb-10">
        <div className="mx-auto max-w-[74rem]">
          {data.boardMovers.length ? (
            <div className="mb-8 flex justify-center" aria-hidden="true">
              <div className="h-px w-20 bg-white/10" />
            </div>
          ) : (
            <div className="pt-8 md:pt-10" />
          )}

          <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-end">
            <div className="lg:col-span-2">
              <ScoutSectionLabel>Featured Prospects</ScoutSectionLabel>
              <h2 className="mt-2 font-display text-2xl font-bold uppercase tracking-tight text-white">
                Rising prospects nationwide
              </h2>
            </div>
            <div className="flex items-end justify-between gap-3 lg:col-span-1">
              <div>
                <ScoutSectionLabel>National Board</ScoutSectionLabel>
                <h2 className="mt-2 font-display text-2xl font-bold uppercase tracking-tight text-white">U19 National</h2>
              </div>
              <NationalBoardGenderToggle gender={gender} onGenderChange={setGender} />
            </div>
          </div>

          <p className="mb-5 max-w-xl text-sm text-scout-500 lg:max-w-none lg:pr-[34%]">
            Top-rated athletes across divisions — not limited to one age group or gender.
          </p>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {featuredProspects.length ? (
                <FeaturedProspectsGrid players={featuredProspects} rankDeltaByPlayerId={rankDeltaByPlayerId} />
              ) : (
                <p className="text-sm text-scout-500">More ranked prospects will appear here as coverage expands.</p>
              )}
            </div>

            <div className="lg:col-span-1">
              {rankedPlayers.length ? (
                <>
                  {rankedPlayers.length < 10 ? (
                    <p className="mb-4 text-sm font-semibold text-scout-500">
                      {publicRankingsCoverageCopy.sparseBoard(NATIONAL_BOARD_AGE, gender, rankedPlayers.length)}
                    </p>
                  ) : null}
                  <NationalBoardRail
                    players={rankedPlayers}
                    rankDeltaByPlayerId={gender === "Boys" ? rankDeltaByPlayerId : {}}
                    rankingsHref={rankingsHref}
                  />
                </>
              ) : (
                <div className="rounded-sm border border-white/[0.08] bg-scout-800/80 p-6">
                  <EmptyState icon="players" title={publicRankingsCoverageCopy.emptyBoardTitle} />
                </div>
              )}
            </div>
          </div>

          {data.recentGames.length ? (
            <div className="mt-10 pt-8">
              <div className="mb-6 flex justify-center" aria-hidden="true">
                <div className="h-px w-20 bg-white/10" />
              </div>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <ScoutSectionLabel>Recent Scores</ScoutSectionLabel>
                  <h2 className="mt-2 font-display text-2xl font-bold uppercase tracking-tight text-white">
                    Verified games behind the board
                  </h2>
                </div>
                <Link
                  href="/games"
                  className="text-xs font-bold uppercase tracking-[0.1em] text-scout-orange-bright hover:text-hardwood-500"
                >
                  All games →
                </Link>
              </div>
              <RecentResults games={data.recentGames} />
            </div>
          ) : null}
        </div>
      </section>

      <HomeTeamModule data={data} />

      <TrustBand
        variant="scout-panel"
        trustMeta={lastUpdated ? { lastUpdated } : undefined}
      />
    </PublicPageShell>
  );
}

function HomeTeamModule({ data }: { data: HomeData }) {
  if (!data.teamPreview.length) return null;

  return (
    <section className="container-px border-t border-white/[0.06] py-8 md:py-10">
      <div className="mx-auto max-w-[74rem]">
        <div className="mb-6 flex justify-center" aria-hidden="true">
          <div className="h-px w-20 bg-white/10" />
        </div>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <ScoutSectionLabel>Teams & Leagues</ScoutSectionLabel>
            <h2 className="mt-2 font-display text-2xl font-bold uppercase tracking-tight text-white">
              Team standings snapshot
            </h2>
          </div>
          <Link
            href="/teams"
            className="text-xs font-bold uppercase tracking-[0.1em] text-scout-orange-bright hover:text-hardwood-500"
          >
            Team rankings →
          </Link>
        </div>
        <article className="mt-5 overflow-hidden rounded-sm border border-white/[0.08] bg-scout-800/80">
          <div className="grid grid-cols-[3rem_1fr_7rem_5rem] border-b border-white/[0.08] px-3 py-2 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-scout-500">
            <span>Rank</span>
            <span>Team</span>
            <span>Record</span>
            <span className="text-right">Diff</span>
          </div>
          {data.teamPreview.map((team, index) => (
            <Link
              key={`${team.teamId}-${team.leagueName}`}
              href={`/teams/${team.teamId}`}
              className="grid grid-cols-[3rem_1fr_7rem_5rem] items-center gap-2 border-b border-white/[0.06] px-3 py-2 last:border-b-0 transition hover:bg-court-800"
            >
              <strong className="font-numeric text-lg font-normal text-scout-orange-bright">{index + 1}</strong>
              <span className="min-w-0">
                <strong className="block truncate text-sm font-bold text-white" title={team.displayName}>
                  {team.displayName}
                </strong>
                <small className="block truncate text-xs font-semibold text-scout-500">
                  {team.ageGroup} {team.gender} / {team.leagueName}
                </small>
              </span>
              <span className="flex items-baseline justify-center gap-1.5">
                <span className="text-[0.65rem] font-black text-emerald-400">W</span>
                <strong className="font-numeric text-sm font-normal text-white">{team.wins}</strong>
                <span className="text-court-600">|</span>
                <span className="text-[0.65rem] font-black text-rose-400">L</span>
                <strong className="font-numeric text-sm font-normal text-white">{team.losses}</strong>
              </span>
              <strong
                className={`text-right font-numeric text-sm font-normal ${
                  team.pointDifferential >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {team.pointDifferential >= 0 ? "+" : ""}
                {team.pointDifferential}
              </strong>
            </Link>
          ))}
        </article>
      </div>
    </section>
  );
}

function RecentResults({ games }: { games: HomeRecentGame[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {games.slice(0, 9).map((game) => {
        const homeWon = game.homeScore > game.awayScore;
        const awayWon = game.awayScore > game.homeScore;
        return (
          <Link
            key={game.id}
            href={`/games/${game.id}`}
            className="rounded-sm border border-white/[0.08] bg-scout-800/80 p-3 transition hover:border-hardwood-500/40 hover:bg-court-800"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-scout-500">{game.leagueName}</span>
              <span className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-scout-500">Final</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <div className={`truncate text-sm font-bold uppercase ${homeWon ? "text-white" : "text-scout-500"}`}>
                  {getProgramAbbreviation(game.homeTeamName)}
                </div>
                <div className={`truncate text-sm font-bold uppercase ${awayWon ? "text-white" : "text-scout-500"}`}>
                  {getProgramAbbreviation(game.awayTeamName)}
                </div>
              </div>
              <div className="space-y-0.5 text-right">
                <div className={`font-numeric text-xl font-normal ${homeWon ? "text-white" : "text-scout-500"}`}>
                  {game.homeScore}
                </div>
                <div className={`font-numeric text-xl font-normal ${awayWon ? "text-white" : "text-scout-500"}`}>
                  {game.awayScore}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
