import Link from "next/link";
import { getOfficialLeagueDetail } from "@/lib/official-games";
import { GameList } from "@/components/public/GameList";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { SectionHeader } from "@/components/public/SectionHeader";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const league = await getOfficialLeagueDetail(params.id);
  return { title: league.name };
}

export default async function LeagueDetailPage({ params }: { params: { id: string } }) {
  const league = await getOfficialLeagueDetail(params.id);
  const games = league.seasons.flatMap((season) => season.games.map((game) => ({ ...game, seasonName: season.name })));
  const teamIds = new Set(games.flatMap((game) => [game.homeTeamId, game.awayTeamId]));

  return (
    <PublicPageShell className="pb-20 pt-28">
      <section className="hero-brand text-white">
        <div className="container-px py-14">
          <SectionHeader
            title={league.name}
            dark
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Metric label="Programs / Teams" value={teamIds.size} />
            <Metric label="Official Games" value={games.length} />
            <Metric label="Games per team" value={teamIds.size ? (games.length / teamIds.size).toFixed(1) : "0"} />
          </div>
        </div>
      </section>

      <section className="container-px py-7 md:py-9">
        <div className="mb-5">
          <SectionHeader
            title="Schedule & Results"
            action={<Link href="/leagues" className="button secondary">Back to leagues</Link>}
            variant="content"
          />
        </div>
        {games.length ? <GameList games={games} /> : <p className="border border-line-500 bg-white p-4 text-court-600">No official games are listed for this league yet.</p>}
      </section>
    </PublicPageShell>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-white/15 bg-white/10 p-4">
      <strong className="block font-display text-stat-sm font-black text-white">{value}</strong>
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-white/62">{label}</span>
    </div>
  );
}
