import type { LeagueHistory } from "@/lib/mock-data";
import { EmptyState } from "@/components/ui";
import { SectionHeader } from "@/components/public/SectionHeader";

export function CompetitionHistory({ leagues }: { leagues: LeagueHistory[] }) {
  return (
    <section>
      <SectionHeader title="League History" />
      {!leagues.length ? <div className="mt-6"><EmptyState icon="leagues" title="No leagues listed" /></div> : null}
      {leagues.length ? (
        <div className="mt-6 grid gap-3">
          {leagues.map((league) => (
            <article key={`${league.leagueName}-${league.season}`} className="grid gap-4 border border-line-500 bg-white p-5 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-hardwood-600">{tierLabel(league.tier)}</p>
                <h3 className="mt-1 font-display text-2xl font-black leading-tight text-court-900">{league.leagueName}</h3>
                <p className="mt-1 text-sm font-semibold text-court-500">{league.season} | {league.gamesPlayed} games</p>
              </div>
              <div className="grid grid-cols-3 gap-4 md:text-right">
                <LeagueStat label="PPG" value={league.avgPoints} />
                <LeagueStat label="APG" value={league.avgAssists ?? "-"} />
                <LeagueStat label="RPG" value={league.avgRebounds ?? "-"} />
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function tierLabel(tier: LeagueHistory["tier"]) {
  if (tier >= 4) return "Elite";
  if (tier === 3) return "Competitive";
  if (tier === 2) return "Developmental";
  return "Entry";
}

function LeagueStat({ label, value }: { label: string; value: string | number }) {
  return (
    <span>
      <strong className="block font-display text-stat-sm font-black text-court-900">{value}</strong>
      <small className="text-xs font-bold uppercase tracking-[0.12em] text-court-400">{label}</small>
    </span>
  );
}
