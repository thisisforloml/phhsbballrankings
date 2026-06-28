"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { HomeData, HomeRecentGame, PublicAgeGroup, PublicGender } from "@/lib/public-site-data";
import { publicRankingsCoverageCopy } from "@/lib/public-rankings-coverage";
import { BoardLeadersCarousel, HeroSection, LeaderboardPreview } from "@/components/sections";
import { EmptyState } from "@/components/ui";
import { AgeGroupPill } from "@/components/public/AgeGroupPill";
import { SectionHeader } from "@/components/public/SectionHeader";
import { getProgramAbbreviation } from "@/lib/uaap-school-display";

const ageGroups: PublicAgeGroup[] = ["U13", "U16", "U19"];
const genders: PublicGender[] = ["Boys", "Girls"];

export function HomeClient({ data }: { data: HomeData }) {
  const [ageGroup, setAgeGroup] = useState<PublicAgeGroup>("U19");
  const [gender, setGender] = useState<PublicGender>("Boys");
  const rankedPlayers = useMemo(() => {
    const board = data.leaderboardsByAge[ageGroup];
    return gender === "Girls" ? board.girls : board.boys;
  }, [ageGroup, data.leaderboardsByAge, gender]);

  return (
    <main>
      <HeroSection data={data} />
      <BoardLeadersCarousel data={data} />
      <section className="container-px border-y border-line-500 bg-white py-3">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {ageGroups.map((group) => (
              <AgeGroupPill key={group} group={group} active={ageGroup === group} onClick={() => setAgeGroup(group)} />
            ))}
          </div>
          <div className="inline-flex w-fit border border-line-500 bg-paper-500 p-1">
            {genders.map((item) => (
              <button key={item} onClick={() => setGender(item)} className={`px-5 py-2 text-sm font-black uppercase tracking-[0.08em] transition ${gender === item ? "bg-court-900 text-white" : "text-court-600 hover:text-court-900"}`}>
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="container-px bg-paper-500 py-7 md:py-9">
        <div className="mb-5">
          <SectionHeader
            title={`Top 10 ${ageGroup} ${gender}`}
            action={<Link href={`/rankings?gender=${gender}&age=${ageGroup}`} className="button secondary">View Full Rankings</Link>}
            variant="content"
          />
        </div>
        {rankedPlayers.length ? (
          <>
            {rankedPlayers.length < 10 ? (
              <p className="mb-4 text-sm font-semibold text-court-600">
                {publicRankingsCoverageCopy.sparseBoard(ageGroup, gender, rankedPlayers.length)}
              </p>
            ) : null}
            <LeaderboardPreview players={rankedPlayers} />
          </>
        ) : (
          <EmptyState
            icon="players"
            title={publicRankingsCoverageCopy.emptyBoardTitle}
          />
        )}
      </section>
      <HomeDatabaseModules data={data} />
    </main>
  );
}

function HomeDatabaseModules({ data }: { data: HomeData }) {
  return (
    <>
      <section className="container-px border-y border-line-500 bg-white py-7 md:py-9">
        <div className="mb-5">
          <SectionHeader
            title="Team Standings Preview"
            action={<Link href="/teams" className="button secondary">View Team Rankings</Link>}
            variant="content"
          />
        </div>
        <article className="overflow-hidden border border-line-500 bg-white">
          <div className="sports-table-head grid grid-cols-[3rem_1fr_7rem_5rem]">
            <span>#</span><span>Team</span><span>Record</span><span>Diff</span>
          </div>
          {data.teamPreview.length ? data.teamPreview.map((team, index) => (
            <Link key={`${team.teamId}-${team.leagueName}`} href={`/teams/${team.teamId}`} className="grid grid-cols-[3rem_1fr_7rem_5rem] items-center gap-2 border-b border-line-500 px-3 py-2 last:border-b-0 hover:bg-paper-500">
              <strong className="font-display text-xl font-black text-court-900">#{index + 1}</strong>
              <span className="min-w-0">
                <strong className="block truncate text-sm font-black text-court-900" title={team.displayName}>{team.displayName}</strong>
                <small className="block truncate text-xs font-semibold text-court-500">{team.ageGroup} {team.gender} / {team.leagueName}</small>
              </span>
              <span className="flex items-baseline justify-center gap-1.5">
                <span className="text-[0.65rem] font-black text-win-text">W</span>
                <strong className="font-display text-lg font-black text-court-900">{team.wins}</strong>
                <span className="text-court-300">|</span>
                <span className="text-[0.65rem] font-black text-loss-text">L</span>
                <strong className="font-display text-lg font-black text-court-900">{team.losses}</strong>
              </span>
              <strong className={`text-center font-display text-lg font-black ${team.pointDifferential >= 0 ? "text-win-text" : "text-loss-text"}`}>
                {team.pointDifferential >= 0 ? "+" : ""}{team.pointDifferential}
              </strong>
            </Link>
          )) : <div className="p-4"><EmptyState icon="teams" title="No team standings yet" /></div>}
        </article>
      </section>

      {data.recentGames.length ? (
        <section className="container-px border-b border-line-500 bg-paper-500 py-7 md:py-9">
          <div className="mb-5">
            <SectionHeader
              title="Latest Games"
              action={<Link href="/games" className="button secondary">View All Games</Link>}
              variant="content"
            />
          </div>
          <RecentResults games={data.recentGames} />
        </section>
      ) : null}
    </>
  );
}

function RecentResults({ games }: { games: HomeRecentGame[] }) {
  return (
    <article className="overflow-hidden border border-line-500 bg-white">
      <div className="sports-table-head grid grid-cols-[1fr_6rem_6rem_6rem]">
        <span>Matchup</span><span>League</span><span>Date</span><span className="text-right">Score</span>
      </div>
      {games.map((game) => (
        <Link key={game.id} href={`/games/${game.id}`} className="grid grid-cols-[1fr_6rem_6rem_6rem] items-center gap-2 border-b border-line-500 px-3 py-2 last:border-b-0 hover:bg-paper-500">
          <span className="min-w-0 truncate text-sm font-bold text-court-900">
            {getProgramAbbreviation(game.homeTeamName)} vs {getProgramAbbreviation(game.awayTeamName)}
          </span>
          <span className="truncate text-xs font-semibold text-court-500">{game.leagueName}</span>
          <span className="text-xs font-semibold text-court-500">{game.gameDate}</span>
          <strong className="text-right font-display text-lg font-black text-court-900">{game.homeScore}-{game.awayScore}</strong>
        </Link>
      ))}
    </article>
  );
}
