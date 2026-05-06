import { notFound } from "next/navigation";
import { getLeagueById, leagues, scoreGames } from "@/lib/mock-data";
import { PremiumGate, VerifiedBadge } from "@/components/ui";

export function generateStaticParams() {
  return leagues.map((league) => ({ id: league.id }));
}

export default function LeagueDetailPage({ params }: { params: { id: string } }) {
  const league = getLeagueById(params.id);
  if (!league) notFound();
  const games = scoreGames.filter((game) => game.league === league.name);

  return (
    <main className="bg-surface-50 pb-20">
      <section className="hero-brand pt-32 text-white">
        <div className="container-px py-14">
          <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">League Detail</p>
          <h1 className="mt-3 font-display text-stat-lg">{league.name}</h1>
          <p className="mt-4 max-w-2xl text-white/70">{league.organizerName}</p>
        </div>
      </section>
      <section className="container-px grid gap-8 pt-10">
        <article className="rounded-lg border border-surface-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl text-ink-900">{league.name}</h2>
              <p className="mt-2 text-ink-600">{league.city} · {league.region} · {league.ageGroup} {league.gender}</p>
            </div>
            {league.isVerified ? <VerifiedBadge label="Verified League" /> : null}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <span className="rounded-lg bg-surface-100 p-4"><strong className="block font-display text-stat-sm text-navy-800">{league.teamCount}</strong><small className="font-mono text-mono-sm text-ink-500">Teams</small></span>
            <span className="rounded-lg bg-surface-100 p-4"><strong className="block font-display text-stat-sm text-navy-800">{league.gamesPerTeam}</strong><small className="font-mono text-mono-sm text-ink-500">Games per team</small></span>
            <span className="rounded-lg bg-surface-100 p-4"><strong className="block font-display text-stat-sm text-navy-800">{league.qualityScore}</strong><small className="font-mono text-mono-sm text-ink-500">Quality score</small></span>
          </div>
        </article>
        <PremiumGate description="League games, player statistics, and box scores are available to Premium members.">
          <section className="grid gap-4">
            <h2 className="label">Games and Box Scores</h2>
            {games.map((game) => (
              <article key={game.id} className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
                <p className="font-mono text-mono-sm uppercase text-ink-500">{game.date}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
                  <h3 className="font-display text-3xl text-ink-900">{game.homeTeam} vs {game.awayTeam}</h3>
                  <strong className="font-display text-stat-md text-navy-800">{game.homeScore} â€“ {game.awayScore}</strong>
                </div>
              </article>
            ))}
          </section>
        </PremiumGate>
      </section>
    </main>
  );
}
