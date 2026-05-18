import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPlayerProfileBySlug, type PlayerProfile } from "@/lib/player-profile";
import type { GameResult, LeagueHistory, Player } from "@/lib/mock-data";
import { CompetitionHistory, PlayerHero, RecentGames } from "@/components/sections";
import { PremiumGate, StarRating } from "@/components/ui";
import { formatHeight } from "@/lib/format";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const profile = await getPlayerProfileBySlug(params.slug);
  if (!profile) return { title: "Player Profile" };

  const rankText = profile.nationalRank ? `#${profile.nationalRank}` : "Provisional";

  return {
    title: `${profile.displayName} - ${profile.ageGroup} - ${rankText}`,
    description: `${profile.displayName} player profile, ranking, recent games, and competition history on OnCourt.`
  };
}

function toMockPlayer(profile: PlayerProfile): Player {
  const nationalRank = profile.nationalRank ?? 0;

  return {
    id: profile.slug,
    firstName: profile.firstName,
    lastName: profile.lastName,
    gender: profile.gender === "GIRLS" ? "Girls" : "Boys",
    position: profile.position as Player["position"],
    city: profile.city,
    region: profile.region,
    birthYear: profile.birthYear ?? undefined,
    ageGroup: profile.ageGroup,
    rating: profile.rating,
    stars: profile.starRating,
    gamesPlayed: profile.verifiedGameCount,
    isRankEligible: profile.nationalRank !== null,
    isVerified: profile.nationalRank !== null,
    isClaimed: false,
    nationalRank,
    regionalRank: nationalRank,
    cityRank: nationalRank,
    positionRank: profile.position && nationalRank ? nationalRank : undefined,
    avgPoints: profile.ppg,
    avgAssists: profile.apg,
    avgRebounds: profile.rpg,
    school: profile.currentTeam,
    photoUrl: profile.photoUrl ?? undefined,
    topLeague: profile.leagues[0]?.leagueName ?? "League not on record",
    topLeagueTier: (profile.leagues[0]?.tier ?? 1) as Player["topLeagueTier"],
    weeklyTrend: "flat",
    trendDelta: 0,
    lastFiveGames: toRecentGames(profile),
    leaguesPlayed: toLeagueHistory(profile)
  };
}

function toRecentGames(profile: PlayerProfile): GameResult[] {
  return profile.latestFiveGames.map((game) => ({
    league: game.leagueName,
    opponent: game.opponentName,
    result: game.result,
    points: game.points,
    assists: game.assists,
    rebounds: game.rebounds,
    performanceScore: game.finalPerformanceScore === null ? 0 : Number(game.finalPerformanceScore.toFixed(1))
  }));
}

function toLeagueHistory(profile: PlayerProfile): LeagueHistory[] {
  return profile.leagues.map((league) => ({
    leagueName: league.leagueName,
    season: league.seasonName,
    tier: league.tier as LeagueHistory["tier"],
    gamesPlayed: league.gamesPlayed,
    avgPoints: league.avgPoints,
    avgAssists: league.avgAssists,
    avgRebounds: league.avgRebounds
  }));
}

export default async function PlayerProfilePage({ params }: { params: { slug: string } }) {
  const profile = await getPlayerProfileBySlug(params.slug);
  if (!profile) notFound();

  const player = toMockPlayer(profile);
  const rankLabel = profile.nationalRank ? `#${profile.nationalRank}` : "Provisional ranking";

  return (
    <main>
      <PlayerHero player={player} />
      <section className="container-px grid gap-10 py-14">
        <div className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
          <p className="font-mono text-mono-sm uppercase text-ink-500">Profile status</p>
          <div className="mt-3 grid gap-3 text-ink-700 md:grid-cols-3 lg:grid-cols-7">
            <span><strong className="block text-ink-900">{rankLabel}</strong>Rank</span>
            <span><strong className="block text-ink-900">{profile.rating.toFixed(2)}</strong><span className="mt-1 block"><StarRating stars={profile.starRating} /></span></span>
            <span><strong className="block text-ink-900">{profile.position ?? "Position not on record"}</strong>Position</span>
            <span><strong className="block text-ink-900">{profile.currentTeam}</strong>School/Team</span>
            <span><strong className="block text-ink-900">{formatHeight(profile.heightCm)}</strong>Height</span>
            <span><strong className="block text-ink-900">{profile.birthYear ?? "Not on record"}</strong>Birth year</span>
            <span><strong className="block text-ink-900">{profile.age !== null ? `${profile.age} years old` : "Not on record"}</strong>Age</span>
          </div>
        </div>
        <RecentGames games={player.lastFiveGames} />
        <CompetitionHistory leagues={player.leaguesPlayed} />
        <details className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer font-mono text-label uppercase tracking-[0.12em] text-navy-800">How is this rating calculated?</summary>
          <p className="mt-4 max-w-4xl leading-7 text-ink-700">
            This profile uses Formula v1, a possession-informed baseline rating from submitted box-score data. Game performance scores are scaled within the same competition pool, then averaged into the current player rating. Public ranking eligibility is currently 10 verified games for U19 boys and 5 verified games for U19 girls.
          </p>
        </details>
        <div className="rounded-lg bg-navy-800 p-5 text-white md:flex md:items-center md:justify-between md:gap-6">
          <div>
            <h2 className="font-display text-3xl">Is this you?</h2>
            <p className="mt-1 text-white/75">Claim your profile to add your photo, school, birthdate, contact information, and social links.</p>
          </div>
          <a href="/claim" className="button primary mt-4 md:mt-0">Claim Profile</a>
        </div>
        <PremiumGate description="Full career history, movement charts, analytics, trend data, and exports are available behind Premium Access.">
          <section className="grid gap-4 rounded-lg border border-surface-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-3xl text-ink-900">Licensed Performance Analytics</h2>
            <p className="text-ink-600">All games played, week-by-week ranking movement, advanced analytics, performance trends, and exportable data.</p>
          </section>
        </PremiumGate>
      </section>
    </main>
  );
}
