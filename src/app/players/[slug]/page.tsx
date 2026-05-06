import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { players, getPlayerById, formatPlayerName } from "@/lib/mock-data";
import { CompetitionHistory, PlayerHero, RecentGames } from "@/components/sections";
import { PremiumGate } from "@/components/ui";

export function generateStaticParams() {
  return players.map((player) => ({ slug: player.id }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const player = getPlayerById(params.slug);
  if (!player) return { title: "Player Profile" };
  return {
    title: `${formatPlayerName(player)} · ${player.ageGroup} · #${player.nationalRank}`,
    description: `${formatPlayerName(player)} player profile, ranking, recent games, and competition history on OnCourt.`
  };
}

export default function PlayerProfilePage({ params }: { params: { slug: string } }) {
  const player = players.find((item) => item.id === params.slug);
  if (!player) notFound();

  return (
    <main>
      <PlayerHero player={player} />
      <section className="container-px grid gap-10 py-14">
        <RecentGames games={player.lastFiveGames} />
        <CompetitionHistory leagues={player.leaguesPlayed} />
        <details className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer font-mono text-label uppercase tracking-[0.12em] text-navy-800">How is this rating calculated?</summary>
          <p className="mt-4 max-w-4xl leading-7 text-ink-700">
            The rating is based on production such as points, assists, rebounds, and advanced metrics when organizers submit them. Field goal percentage, three-point percentage, free throw percentage, steals, blocks, turnovers, offensive rebounds, and defensive rebounds can all contribute. The score is then adjusted for league weight, opponent strength, team context, and gender-specific eligibility thresholds of 10 verified games for boys and 8 verified games for girls.
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
