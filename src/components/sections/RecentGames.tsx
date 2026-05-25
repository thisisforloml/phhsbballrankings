import type { GameResult } from "@/lib/mock-data";
import { EmptyState, WinLossPill } from "@/components/ui";
import { SectionHeader } from "@/components/public/SectionHeader";

export function RecentGames({ games }: { games: GameResult[] }) {
  return (
    <section>
      <SectionHeader eyebrow="Game Log" title="Recent Games" description="Latest verified box-score performances from official submissions." />
      {!games.length ? <div className="mt-6"><EmptyState icon="scores" title="No scores available" /></div> : null}
      {games.length ? (
        <div className="mt-6 overflow-hidden border border-line-500 bg-white">
          <div className="hidden grid-cols-[1.25fr_1fr_4rem_repeat(4,4.4rem)] gap-3 border-b border-court-900 bg-court-900 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-white/70 md:grid">
            <span>League</span><span>Opponent</span><span>Result</span><span>PTS</span><span>AST</span><span>REB</span><span>Score</span>
          </div>
          {games.map((game, index) => (
            <div key={`${game.opponent}-${index}`} className="grid gap-3 border-b border-line-500 px-4 py-4 last:border-b-0 md:grid-cols-[1.25fr_1fr_4rem_repeat(4,4.4rem)] md:items-center">
              <span className="truncate text-sm font-semibold text-court-700" title={game.league}>{game.league}</span>
              <span className="font-black text-court-900">{game.opponent}</span>
              <span><WinLossPill result={game.result} /></span>
              <Stat label="PTS" value={game.points} />
              <Stat label="AST" value={game.assists ?? "-"} />
              <Stat label="REB" value={game.rebounds ?? "-"} />
              <Stat label="Score" value={game.performanceScore} highlight />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <span>
      <strong className={`block font-display text-stat-sm font-black ${highlight ? "text-hardwood-600" : "text-court-900"}`}>{value}</strong>
      <small className="block text-[0.62rem] font-bold uppercase tracking-[0.12em] text-court-400 md:hidden">{label}</small>
    </span>
  );
}

