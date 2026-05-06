import type { GameResult } from "@/lib/mock-data";
import { EmptyState, WinLossPill } from "@/components/ui";

export function RecentGames({ games }: { games: GameResult[] }) {
  return (
    <section>
      <h2 className="label">Recent Games</h2>
      {!games.length ? <div className="mt-6"><EmptyState icon="scores" title="No scores available" /></div> : null}
      {games.length ? (
      <div className="mt-6 overflow-hidden rounded-lg border border-surface-200 bg-white shadow-sm">
        <div className="grid grid-cols-[1.2fr_1fr_3rem_repeat(4,3.8rem)] gap-3 border-b border-surface-200 px-4 py-3 font-mono text-mono-sm uppercase text-ink-500">
          <span>League</span><span>Opponent</span><span>Result</span><span>PTS</span><span>AST</span><span>REB</span><span>Score</span>
        </div>
        {games.map((game, index) => (
          <div key={`${game.opponent}-${index}`} className="grid grid-cols-[1.2fr_1fr_3rem_repeat(4,3.8rem)] items-center gap-3 border-b border-surface-200 px-4 py-4 last:border-b-0">
            <span className="truncate text-ink-700" title={game.league}>{game.league}</span>
            <span className="text-ink-900">{game.opponent}</span>
            <WinLossPill result={game.result} />
            <span className="font-display text-stat-sm text-ink-900">{game.points}</span>
            <span className="font-display text-stat-sm text-ink-900">{game.assists ?? "â€”"}</span>
            <span className="font-display text-stat-sm text-ink-900">{game.rebounds ?? "â€”"}</span>
            <span className="font-display text-stat-sm text-navy-800">{game.performanceScore}</span>
          </div>
        ))}
      </div>
      ) : null}
    </section>
  );
}
