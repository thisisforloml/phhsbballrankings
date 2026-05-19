import Link from "next/link";
import { getOfficialLeagueDetail } from "@/lib/official-games";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const league = await getOfficialLeagueDetail(params.id);
  return { title: league.name };
}

function inferGender(name: string) {
  return name.toLowerCase().includes("girls") ? "Girls" : "Boys";
}

export default async function LeagueDetailPage({ params }: { params: { id: string } }) {
  const league = await getOfficialLeagueDetail(params.id);
  const games = league.seasons.flatMap((season) => season.games.map((game) => ({ ...game, seasonName: season.name })));
  const teamIds = new Set(games.flatMap((game) => [game.homeTeamId, game.awayTeamId]));

  return (
    <main className="bg-surface-50 pb-20 pt-28">
      <section className="hero-brand text-white">
        <div className="container-px py-14">
          <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">League Detail</p>
          <h1 className="mt-3 max-w-4xl font-display text-stat-lg">{league.name}</h1>
          <p className="mt-4 text-white/70">{league.ageGroup} {inferGender(league.name)} - {league.city ?? "Not listed"}, {league.region ?? "Not listed"}</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Metric label="Programs / Teams" value={teamIds.size} />
            <Metric label="Official Games" value={games.length} />
            <Metric label="Games per team" value={teamIds.size ? (games.length / teamIds.size).toFixed(1) : "0"} />
          </div>
        </div>
      </section>

      <section className="container-px py-10">
        <article className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="label">Official Games</p>
              <h2 className="mt-2 font-display text-3xl text-navy-800">Schedule & Results</h2>
            </div>
            <Link href="/leagues" className="button secondary">Back to leagues</Link>
          </div>
          <div className="mt-5 grid gap-3">
            {games.map((game) => (
              <Link key={game.id} href={`/games/${game.id}`} className="rounded-md border border-surface-200 p-4 transition hover:border-navy-800 hover:bg-navy-50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <strong className="text-ink-900">{game.gameNumber ?? "Game"}</strong>
                  <span className="font-mono text-mono-sm uppercase text-ink-500">{game.gameDate.toISOString().slice(0, 10)} · {game.verificationStatus}</span>
                </div>
                <p className="mt-2 text-ink-700">{game.homeTeam.name} {game.homeScore} - {game.awayScore} {game.awayTeam.name}</p>
                <p className="mt-1 text-sm text-ink-500">{game.seasonName}</p>
              </Link>
            ))}
            {!games.length ? <p className="rounded-md bg-surface-100 p-4 text-ink-600">No official games are listed for this league yet.</p> : null}
          </div>
        </article>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/15 bg-white/10 p-4">
      <strong className="block font-display text-stat-sm text-white">{value}</strong>
      <span className="font-mono text-mono-sm uppercase text-white/65">{label}</span>
    </div>
  );
}
