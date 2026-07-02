import { ProfileModule } from "@/components/public/ProfileModule";
import { EmptyState, WinLossPill } from "@/components/ui";
import type { GameResult } from "@/lib/mock-data";
import type { PlayerProfileRecentForm } from "@/lib/player-profile-types";

function signed(value: number | null) {
  if (value === null) return null;
  return `${value > 0 ? "+" : ""}${value}`;
}

function avgStat(games: GameResult[], key: keyof Pick<GameResult, "points" | "assists" | "rebounds">) {
  if (!games.length) return null;
  const sum = games.reduce((acc, g) => acc + (Number(g[key]) || 0), 0);
  return (sum / games.length).toFixed(1);
}

export function RecentGames({ games, recentForm }: { games: GameResult[]; recentForm?: PlayerProfileRecentForm }) {
  const wins = games.filter((g) => g.result === "W").length;
  const record = `${wins}-${games.length - wins}`;
  const ppg = recentForm?.recentAverages?.points ?? (games.length ? avgStat(games, "points") : null);
  const rpg = recentForm?.recentAverages?.rebounds ?? (games.length ? avgStat(games, "rebounds") : null);
  const apg = recentForm?.recentAverages?.assists ?? (games.length ? avgStat(games, "assists") : null);
  const ptsDelta = signed(recentForm?.pointsDelta ?? null);

  const summaryParts: string[] = [];
  if (ppg !== null) summaryParts.push(`${ppg} PTS${ptsDelta ? ` (${ptsDelta})` : ""}`);
  if (rpg !== null) summaryParts.push(`${rpg} RPG`);
  if (apg !== null) summaryParts.push(`${apg} APG`);
  if (games.length) summaryParts.push(record);

  return (
    <ProfileModule id="recent-form" title="Recent Form" eyebrow="Latest 5">
      {summaryParts.length > 0 && (
        <p className="mb-3 text-sm font-bold text-court-700">
          Last {games.length}:&nbsp;
          <span className="font-semibold text-court-500">{summaryParts.join(" · ")}</span>
        </p>
      )}

      {!games.length ? <EmptyState icon="scores" title="No scores available" /> : null}
      {games.length > 0 && (
        <div className="overflow-hidden border border-line-500 bg-paper-500">
          <div className="sports-table-head hidden grid-cols-[1.25fr_1fr_4rem_repeat(3,3.5rem)] gap-2 md:grid">
            <span>League</span><span>Opponent</span><span>Result</span>
            <span>PTS</span><span>AST</span><span>REB</span>
          </div>
          {games.map((game, index) => (
            <div
              key={`${game.opponent}-${index}`}
              className="grid gap-2 border-b border-line-500 bg-white px-3 py-1.5 last:border-b-0 md:grid-cols-[1.25fr_1fr_4rem_repeat(3,3.5rem)] md:items-center"
            >
              <span className="truncate text-sm font-semibold text-court-700" title={game.league}>{game.league}</span>
              <span className="font-bold text-court-900">{game.opponent}</span>
              <span><WinLossPill result={game.result} /></span>
              <Stat label="PTS" value={game.points} />
              <Stat label="AST" value={game.assists ?? "-"} />
              <Stat label="REB" value={game.rebounds ?? "-"} />
            </div>
          ))}
        </div>
      )}
    </ProfileModule>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <span>
      <strong className={`block font-display text-lg font-bold leading-none ${highlight ? "text-hardwood-600" : "text-court-900"}`}>{value}</strong>
      <small className="block text-[0.62rem] font-bold uppercase tracking-[0.12em] text-court-400 md:hidden">{label}</small>
    </span>
  );
}
