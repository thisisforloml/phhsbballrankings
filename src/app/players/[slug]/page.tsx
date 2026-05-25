import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPlayerProfileBySlug, type PlayerProfile } from "@/lib/player-profile";
import type { GameResult, LeagueHistory, Player } from "@/lib/mock-data";
import { CompetitionHistory, RecentGames } from "@/components/sections";
import { PremiumGate } from "@/components/ui";
import { PlayerProfileHeader } from "@/components/public/PlayerProfileHeader";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { SectionHeader } from "@/components/public/SectionHeader";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const profile = await getPlayerProfileBySlug(params.slug);
  if (!profile) return { title: "Player Profile" };

  const rankText = profile.nationalRank ? `#${profile.nationalRank}` : "Provisional";

  return {
    title: `${profile.displayName} - ${rankText}`,
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
    classYear: profile.classYear,
    ageGroup: profile.ageGroup,
    rating: profile.rating,
    stars: profile.starRating,
    gamesPlayed: profile.verifiedGameCount,
    isRankEligible: profile.nationalRank !== null,
    isVerified: profile.nationalRank !== null,
    isClaimed: false,
    nationalRank,
    regionalRank: profile.regionRank ?? 0,
    cityRank: profile.regionRank ?? 0,
    positionRank: profile.positionRank ?? undefined,
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

  return (
    <PublicPageShell>
      <PlayerProfileHeader profile={profile} />
      <section className="container-px grid gap-10 py-12 pb-28">
        <section className="grid gap-4 border-y border-line-500 bg-white px-5 py-5 md:grid-cols-3">
          <StatTile label="PPG" value={profile.ppg} />
          <StatTile label="RPG" value={profile.rpg} />
          <StatTile label="APG" value={profile.apg} />
        </section>
        <RecentGames games={player.lastFiveGames} />
        <CompetitionHistory leagues={player.leaguesPlayed} />
        <details className="border border-line-500 bg-white p-5">
          <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-court-900">How is this rating calculated?</summary>
          <p className="mt-4 max-w-4xl leading-7 text-court-700">
            This profile uses Formula v1, a possession-informed baseline rating from submitted box-score data. Game performance scores are scaled within the same competition pool, then averaged into the current player rating. Public ranking eligibility is currently 10 verified games for U19 boys and 5 verified games for U19 girls.
          </p>
        </details>
        <div className="border border-court-900 bg-court-900 p-6 text-white md:flex md:items-center md:justify-between md:gap-6">
          <div>
            <h2 className="font-display text-3xl font-black">Is this you?</h2>
            <p className="mt-1 text-white/75">Claim your profile to add your photo, program, birthdate, contact information, and social links.</p>
          </div>
          <a href={`/claim?player=${profile.slug}`} className="button primary mt-4 md:mt-0">Claim Profile</a>
        </div>
        <PremiumGate description="">
          <section className="grid gap-4 border border-line-500 bg-white p-6">
            <SectionHeader
              title="Licensed Performance Analytics"
            />
          </section>
        </PremiumGate>
      </section>
    </PublicPageShell>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-l-4 border-hardwood-600 pl-4">
      <strong className="block font-display text-stat-md font-black leading-none text-court-900">{value}</strong>
      <span className="mt-1 block text-xs font-black uppercase tracking-[0.12em] text-court-500">{label}</span>
    </div>
  );
}
