import Link from "next/link";

type BoxScoreRow = {
  id: string;
  teamId: string;
  minutes: unknown;
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  fouls: number | null;
  foulsDrawn: number | null;
  plusMinus: number | null;
  fieldGoalsMade: number | null;
  fieldGoalsAttempt: number | null;
  twoMade: number | null;
  twoAttempt: number | null;
  threeMade: number | null;
  threeAttempt: number | null;
  freeThrowsMade: number | null;
  freeThrowsAttempt: number | null;
  player: { displayName: string; slug?: string | null };
  team: { name: string };
};

type BoxScoreTotals = {
  minutes: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  foulsDrawn: number;
  plusMinus: number;
  fieldGoalsMade: number;
  fieldGoalsAttempt: number;
  twoMade: number;
  twoAttempt: number;
  threeMade: number;
  threeAttempt: number;
  freeThrowsMade: number;
  freeThrowsAttempt: number;
};

function statPair(made: number | null, attempt: number | null) {
  return `${made ?? 0}/${attempt ?? 0}`;
}

function minutes(value: unknown) {
  if (value === null || value === undefined) return "-";
  return Number(value).toFixed(1).replace(/\.0$/, "");
}

function ScoreCheck({ points, expected }: { points: number; expected: number }) {
  const pass = points === expected;
  return (
    <span className={`border px-3 py-2 text-xs font-black uppercase tracking-[0.1em] ${pass ? "border-win-text bg-win-bg text-win-text" : "border-loss-text bg-loss-bg text-loss-text"}`}>
      Player PTS {points} / Score {expected} - {pass ? "Matched" : "Needs review"}
    </span>
  );
}

export function BoxScoreTable({ team, rows, expectedScore, totals, showScoreCheck = false }: {
  team: { id: string; name: string };
  rows: BoxScoreRow[];
  expectedScore: number;
  totals: BoxScoreTotals;
  showScoreCheck?: boolean;
}) {
  return (
    <article className="border border-line-500 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-500 p-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-hardwood-600">Box Score</p>
          <h2 className="mt-1 font-display text-3xl font-black leading-tight text-court-900">{team.name}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="border border-court-900 bg-court-900 px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-white">{expectedScore} points</span>
          {showScoreCheck ? <ScoreCheck points={totals.points} expected={expectedScore} /> : null}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[76rem] text-left text-sm">
          <thead className="bg-court-900 text-xs font-bold uppercase tracking-[0.12em] text-white/70">
            <tr>
              <th className="py-3 pl-4 pr-3">Player</th><th className="px-3 py-3">MIN</th><th className="px-3 py-3">PTS</th><th className="px-3 py-3">REB</th><th className="px-3 py-3">AST</th><th className="px-3 py-3">STL</th><th className="px-3 py-3">BLK</th><th className="px-3 py-3">TO</th><th className="px-3 py-3">PF</th><th className="px-3 py-3">FD</th><th className="px-3 py-3">+/-</th><th className="px-3 py-3">FGM/FGA</th><th className="px-3 py-3">2PM/2PA</th><th className="px-3 py-3">3PM/3PA</th><th className="px-3 py-3">FTM/FTA</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((stat) => (
              <tr key={stat.id} className="border-b border-line-500 last:border-b-0">
                <td className="py-3 pl-4 pr-3 font-black text-court-900">
                  {stat.player.slug ? <Link href={`/players/${stat.player.slug}`}>{stat.player.displayName}</Link> : stat.player.displayName}
                  <small className="block text-xs font-semibold text-court-400">{stat.team.name}</small>
                </td>
                <td className="px-3 py-3">{minutes(stat.minutes)}</td>
                <td className="px-3 py-3 font-black text-court-900">{stat.points}</td>
                <td className="px-3 py-3">{stat.rebounds}</td>
                <td className="px-3 py-3">{stat.assists}</td>
                <td className="px-3 py-3">{stat.steals ?? 0}</td>
                <td className="px-3 py-3">{stat.blocks ?? 0}</td>
                <td className="px-3 py-3">{stat.turnovers ?? 0}</td>
                <td className="px-3 py-3">{stat.fouls ?? 0}</td>
                <td className="px-3 py-3">{stat.foulsDrawn ?? 0}</td>
                <td className="px-3 py-3">{stat.plusMinus ?? 0}</td>
                <td className="px-3 py-3">{statPair(stat.fieldGoalsMade, stat.fieldGoalsAttempt)}</td>
                <td className="px-3 py-3">{statPair(stat.twoMade, stat.twoAttempt)}</td>
                <td className="px-3 py-3">{statPair(stat.threeMade, stat.threeAttempt)}</td>
                <td className="px-3 py-3">{statPair(stat.freeThrowsMade, stat.freeThrowsAttempt)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-court-900 bg-paper-500 font-black text-court-900">
              <td className="py-3 pl-4 pr-3">Team Totals</td>
              <td className="px-3 py-3">{totals.minutes}</td>
              <td className="px-3 py-3">{totals.points}</td>
              <td className="px-3 py-3">{totals.rebounds}</td>
              <td className="px-3 py-3">{totals.assists}</td>
              <td className="px-3 py-3">{totals.steals}</td>
              <td className="px-3 py-3">{totals.blocks}</td>
              <td className="px-3 py-3">{totals.turnovers}</td>
              <td className="px-3 py-3">{totals.fouls}</td>
              <td className="px-3 py-3">{totals.foulsDrawn}</td>
              <td className="px-3 py-3">{totals.plusMinus}</td>
              <td className="px-3 py-3">{statPair(totals.fieldGoalsMade, totals.fieldGoalsAttempt)}</td>
              <td className="px-3 py-3">{statPair(totals.twoMade, totals.twoAttempt)}</td>
              <td className="px-3 py-3">{statPair(totals.threeMade, totals.threeAttempt)}</td>
              <td className="px-3 py-3">{statPair(totals.freeThrowsMade, totals.freeThrowsAttempt)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  );
}

