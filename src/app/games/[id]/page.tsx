import Link from "next/link";
import { getOfficialGameDetail } from "@/lib/official-games";
import { BoxScoreTable } from "@/components/public/BoxScoreTable";
import { PublicPageShell } from "@/components/public/PublicPageShell";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const game = await getOfficialGameDetail(params.id);
  return { title: `${game.gameNumber ?? "Game"} - ${game.homeTeam.name} vs ${game.awayTeam.name}` };
}

type StatRow = Awaited<ReturnType<typeof getOfficialGameDetail>>["stats"][number];

function numberValue(value: number | null | undefined) {
  return value ?? 0;
}

function sum(rows: StatRow[], selector: (row: StatRow) => number | null | undefined) {
  return rows.reduce((total, row) => total + numberValue(selector(row)), 0);
}

function totalMinutes(rows: StatRow[]) {
  const value = rows.reduce((total, row) => total + Number(row.minutes ?? 0), 0);
  return value ? value.toFixed(1).replace(/\.0$/, "") : "-";
}

function buildTotals(rows: StatRow[]) {
  return {
    minutes: totalMinutes(rows),
    points: sum(rows, (row) => row.points),
    offensiveRebounds: sum(rows, (row) => row.offensiveRebounds),
    defensiveRebounds: sum(rows, (row) => row.defensiveRebounds),
    rebounds: sum(rows, (row) => row.rebounds),
    assists: sum(rows, (row) => row.assists),
    steals: sum(rows, (row) => row.steals),
    blocks: sum(rows, (row) => row.blocks),
    turnovers: sum(rows, (row) => row.turnovers),
    fouls: sum(rows, (row) => row.fouls),
    foulsDrawn: sum(rows, (row) => row.foulsDrawn),
    plusMinus: sum(rows, (row) => row.plusMinus),
    fieldGoalsMade: sum(rows, (row) => row.fieldGoalsMade),
    fieldGoalsAttempt: sum(rows, (row) => row.fieldGoalsAttempt),
    twoMade: sum(rows, (row) => row.twoMade),
    twoAttempt: sum(rows, (row) => row.twoAttempt),
    threeMade: sum(rows, (row) => row.threeMade),
    threeAttempt: sum(rows, (row) => row.threeAttempt),
    freeThrowsMade: sum(rows, (row) => row.freeThrowsMade),
    freeThrowsAttempt: sum(rows, (row) => row.freeThrowsAttempt)
  };
}

export default async function GameDetailPage({ params }: { params: { id: string } }) {
  const game = await getOfficialGameDetail(params.id);
  const teams = [game.homeTeam, game.awayTeam];
  const homeWon = game.homeScore > game.awayScore;
  const awayWon = game.awayScore > game.homeScore;

  return (
    <PublicPageShell className="pb-20 pt-28">
      <section className="hero-brand text-white">
        <div className="container-px py-14">
          <Link href={`/leagues/${game.season.league.id}`} className="text-xs font-black uppercase tracking-[0.14em] text-gold-500 hover:text-white">Back to league</Link>
          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
            <TeamScore name={game.homeTeam.name} score={game.homeScore} winner={homeWon} align="left" />
            <span className="hidden text-center text-xs font-black uppercase tracking-[0.16em] text-white/42 lg:block">Final</span>
            <TeamScore name={game.awayTeam.name} score={game.awayScore} winner={awayWon} align="right" />
          </div>
          <dl className="mt-8 grid gap-3 text-sm text-white/75 md:grid-cols-3">
            <Meta label="League" value={game.season.league.name} />
            <Meta label="Scope" value={`${game.season.league.ageGroup} ${game.gender}`} />
            <Meta label="Season" value={game.season.name} />
            <Meta label="Date" value={game.gameDate.toISOString().slice(0, 10)} />
            <Meta label="Game number" value={game.gameNumber ?? "-"} />
            <Meta label="Status" value={game.verificationStatus} />
          </dl>
        </div>
      </section>

      <section className="container-px grid gap-8 py-7 md:py-9">
        {teams.map((team) => {
          const rows = game.stats.filter((stat) => stat.teamId === team.id);
          const expectedScore = team.id === game.homeTeamId ? game.homeScore : game.awayScore;
          const totals = buildTotals(rows);
          return <BoxScoreTable key={team.id} team={team} rows={rows} expectedScore={expectedScore} totals={totals} />;
        })}
      </section>
    </PublicPageShell>
  );
}

function TeamScore({ name, score, winner, align }: { name: string; score: number; winner: boolean; align: "left" | "right" }) {
  return (
    <div className={align === "right" ? "lg:text-right" : undefined}>
      <h1 className={`font-display text-[clamp(2.4rem,6vw,5rem)] font-black leading-none ${winner ? "text-white" : "text-white/62"}`}>{name}</h1>
      <strong className={`mt-3 block font-display text-[clamp(4rem,12vw,8rem)] font-black leading-none ${winner ? "text-gold-500" : "text-white"}`}>{score}</strong>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/15 bg-white/10 p-3">
      <dt className="text-xs font-black uppercase tracking-[0.12em] text-white/55">{label}</dt>
      <dd className="mt-1 font-semibold text-white">{value}</dd>
    </div>
  );
}
