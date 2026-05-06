import type { LeagueHistory } from "@/lib/mock-data";
import { EmptyState } from "@/components/ui";

export function CompetitionHistory({ leagues }: { leagues: LeagueHistory[] }) {
  return (
    <section>
      <h2 className="label">Competition History</h2>
      {!leagues.length ? <div className="mt-6"><EmptyState icon="leagues" title="No leagues listed" /></div> : null}
      {leagues.length ? (
      <div className="mt-6 grid gap-4">
        {leagues.map((league) => (
          <article key={`${league.leagueName}-${league.season}`} className="grid gap-4 rounded-lg border border-surface-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h3 className="font-display text-2xl font-bold text-ink-900">{league.leagueName}</h3>
              <p className="text-ink-500">{league.season} · {league.gamesPlayed} games</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-right">
              <span><strong className="block font-display text-stat-sm text-navy-800">{league.avgPoints}</strong><small className="font-mono text-mono-sm text-ink-500">PPG</small></span>
              <span><strong className="block font-display text-stat-sm text-navy-800">{league.avgAssists ?? "â€”"}</strong><small className="font-mono text-mono-sm text-ink-500">APG</small></span>
              <span><strong className="block font-display text-stat-sm text-navy-800">{league.avgRebounds ?? "â€”"}</strong><small className="font-mono text-mono-sm text-ink-500">RPG</small></span>
            </div>
          </article>
        ))}
      </div>
      ) : null}
    </section>
  );
}
