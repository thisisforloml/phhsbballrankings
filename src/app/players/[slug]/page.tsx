import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPlayerProfileBySlug } from "@/lib/player-profile";
import type { PlayerProfile } from "@/lib/player-profile-types";
import type { GameResult } from "@/lib/mock-data";
import { formatPublicRank } from "@/lib/public-rank-display";
import { PlayerProfilePageClient } from "@/components/public/PlayerProfilePageClient";
import { PublicPageShell } from "@/components/public/PublicPageShell";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const profile = await getPlayerProfileBySlug(params.slug);
  if (!profile) return { title: "Player Profile" };
  const rankText = profile.nationalRank ? formatPublicRank(profile.nationalRank) : "Provisional";
  return {
    title: `${profile.displayName} - ${rankText}`,
    description: `${profile.displayName} player profile, ranking, recent games, and competition history on Peach Basket.`,
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
    performanceScore: game.finalPerformanceScore === null ? 0 : Number(game.finalPerformanceScore.toFixed(1)),
  }));
}

export default async function PlayerProfilePage({ params }: { params: { slug: string } }) {
  const profile = (await getPlayerProfileBySlug(params.slug)) as PlayerProfile | null;
  if (!profile) notFound();

  return (
    <PublicPageShell variant="paper" className="pt-0">
      <PlayerProfilePageClient profile={profile} recentGames={toRecentGames(profile)} />
    </PublicPageShell>
  );
}
