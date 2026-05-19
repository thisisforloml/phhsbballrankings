import Link from "next/link";
import { getOfficialGameDetail } from "@/lib/official-games";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const game = await getOfficialGameDetail(params.id);
  return { title: `${game.gameNumber ?? "Game"} - ${game.homeTeam.name} vs ${game.awayTeam.name}` };
}

function statPair(made: number | null, attempt: number | null) {
  return `${made ?? 0}/${attempt ?? 0}`;
}

function minutes(value: unknown) {
  if (value === null || value === undefined) return "-";
  return Number(value).toFixed(1).replace(/\.0$/, "");
}

export default async function GameDetailPage({ params }: { params: { id: string } }) {
  const game = await getOfficialGameDetail(params.id);
  const teams = [game.homeTeam, game.awayTeam];

  return (
    <main className="bg-surface-50 pb-20 pt-28">
      <section className="hero-brand text-white">
        <div className="container-px py-14">
          <Link href={`/leagues/${game.season.league.id}`} className="font-mono text-mono-sm uppercase text-amber-400 hover:text-amber-300">Back to league</Link>
          <p className="mt-6 font-mono text-label uppercase tracking-[0.12em] text-amber-500">Official Game</p>
          <h1 className="mt-3 max-w-4xl font-display text-stat-lg">{game.homeTeam.name} {game.homeScore} - {game.awayScore} {game.awayTeam.name}</h1>
          <dl className="mt-6 grid gap-3 text-sm text-white/75 md:grid-cols-3">
            <div><dt className="font-semibold text-white">League</dt><dd>{game.season.league.name}</dd></div>
            <div><dt className="font-semibold text-white">Scope</dt><dd>{game.season.league.ageGroup} {game.gender}</dd></div>
            <div><dt className="font-semibold text-white">Season</dt><dd>{game.season.name}</dd></div>
            <div><dt className="font-semibold text-white">Date</dt><dd>{game.gameDate.toISOString().slice(0, 10)}</dd></div>
            <div><dt className="font-semibold text-white">Game number</dt><dd>{game.gameNumber ?? "-"}</dd></div>
            <div><dt className="font-semibold text-white">Status</dt><dd>{game.verificationStatus}</dd></div>
          </dl>
        </div>
      </section>

      <section className="container-px grid gap-8 py-10">
        {teams.map((team) => {
          const rows = game.stats.filter((stat) => stat.teamId === team.id);
          return (
            <article key={team.id} className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-3xl text-navy-800">{team.name}</h2>
                <span className="rounded-full bg-navy-50 px-4 py-2 font-mono text-mono-sm uppercase text-navy-800">{team.id === game.homeTeamId ? game.homeScore : game.awayScore} points</span>
              </div>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[58rem] text-left text-sm">
                  <thead className="font-mono text-mono-sm uppercase text-ink-500">
                    <tr className="border-b border-surface-200">
                      <th className="py-3 pr-3">Player</th><th className="px-3 py-3">Team</th><th className="px-3 py-3">MIN</th><th className="px-3 py-3">PTS</th><th className="px-3 py-3">REB</th><th className="px-3 py-3">AST</th><th className="px-3 py-3">STL</th><th className="px-3 py-3">BLK</th><th className="px-3 py-3">TO</th><th className="px-3 py-3">PF</th><th className="px-3 py-3">FGM/FGA</th><th className="px-3 py-3">3PM/3PA</th><th className="px-3 py-3">FTM/FTA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((stat) => (
                      <tr key={stat.id} className="border-b border-surface-100 last:border-b-0">
                        <td className="py-3 pr-3 font-semibold text-ink-900">{stat.player.displayName}</td>
                        <td className="px-3 py-3 text-ink-600">{stat.team.name}</td>
                        <td className="px-3 py-3">{minutes(stat.minutes)}</td>
                        <td className="px-3 py-3 font-semibold">{stat.points}</td>
                        <td className="px-3 py-3">{stat.rebounds}</td>
                        <td className="px-3 py-3">{stat.assists}</td>
                        <td className="px-3 py-3">{stat.steals ?? 0}</td>
                        <td className="px-3 py-3">{stat.blocks ?? 0}</td>
                        <td className="px-3 py-3">{stat.turnovers ?? 0}</td>
                        <td className="px-3 py-3">{stat.fouls ?? 0}</td>
                        <td className="px-3 py-3">{statPair(stat.fieldGoalsMade, stat.fieldGoalsAttempt)}</td>
                        <td className="px-3 py-3">{statPair(stat.threeMade, stat.threeAttempt)}</td>
                        <td className="px-3 py-3">{statPair(stat.freeThrowsMade, stat.freeThrowsAttempt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
