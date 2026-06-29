import Link from "next/link";
import type { Metadata } from "next";
import { getPublicProgramHub } from "@/lib/program-hub";
import { formatPublicRank } from "@/lib/public-rank-display";
import { PageBand } from "@/components/public/PageBand";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { SectionHeader } from "@/components/public/SectionHeader";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const hub = await getPublicProgramHub(params.id);
  return {
    title: `${hub.program.fullName} Program Hub`,
    description: `Teams, rosters, and top rated players from ${hub.program.fullName} on Peach Basket.`
  };
}

export default async function ProgramHubPage({ params }: { params: { id: string } }) {
  const hub = await getPublicProgramHub(params.id);

  return (
    <PublicPageShell className="pb-12 pt-24">
      <PageBand
        eyebrow="Program Hub"
        title={hub.program.fullName}
      />
      <section className="container-px py-8">
        <div className="mx-auto max-w-[74rem] grid gap-10">
          <div className="grid gap-4 sm:grid-cols-3">
            <Metric label="Abbreviation" value={hub.program.abbreviation ?? "—"} />
            <Metric label="Teams" value={hub.teams.length} />
            <Metric label="Top players" value={hub.topPlayers.length} />
          </div>

          <section>
            <SectionHeader title="Top players from this program" variant="content" />
            <div className="mt-5 overflow-hidden border border-line-500 bg-white">
              {hub.topPlayers.map((player) => (
                <Link
                  key={player.playerId}
                  href={`/players/${player.slug}`}
                  className="grid grid-cols-[1fr_6rem_6rem] items-center gap-3 border-b border-line-500 px-4 py-3 last:border-b-0 hover:bg-paper-500"
                >
                  <span>
                    <strong className="block text-court-900">{player.displayName}</strong>
                    <small className="text-court-500">{player.position ?? "Position not listed"}</small>
                  </span>
                  <strong className="text-right font-display text-lg font-black text-court-900">{player.rating.toFixed(1)}</strong>
                  <span className="text-right text-sm font-bold text-court-500">
                    {player.nationalRank ? formatPublicRank(player.nationalRank) : "Unranked"}
                  </span>
                </Link>
              ))}
              {!hub.topPlayers.length ? <p className="p-5 text-court-600">No rated players linked to this program yet.</p> : null}
            </div>
          </section>

          <section>
            <SectionHeader title="Teams" variant="content" />
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {hub.teams.map((team) => (
                <Link key={team.id} href={`/teams/${team.id}`} className="border border-line-500 bg-white p-4 hover:bg-paper-500">
                  <strong className="block text-lg font-black text-court-900">{team.name}</strong>
                  <small className="text-court-500">{team.city ?? "City not listed"} · {team.region ?? "Region not listed"}</small>
                </Link>
              ))}
              {!hub.teams.length ? <p className="text-court-600">No competition teams linked yet.</p> : null}
            </div>
          </section>
        </div>
      </section>
    </PublicPageShell>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-line-500 bg-white p-4">
      <strong className="block font-display text-stat-sm font-black text-court-900">{value}</strong>
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-court-500">{label}</span>
    </div>
  );
}
