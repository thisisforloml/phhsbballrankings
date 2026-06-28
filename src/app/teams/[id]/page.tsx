import Link from "next/link";
import type { Metadata } from "next";
import { getPublicTeamProfile } from "@/lib/team-profile";
import { formatHeight } from "@/lib/format";
import { GameList } from "@/components/public/GameList";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { SectionHeader } from "@/components/public/SectionHeader";
import { WinLossPill } from "@/components/ui";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const profile = await getPublicTeamProfile(params.id);
  return {
    title: `${profile.team.name} Team Profile`,
    description: `${profile.team.name} record, roster, recent games, and official team stats on Peach Basket Rankings PH.`
  };
}

export default async function TeamProfilePage({ params }: { params: { id: string } }) {
  const profile = await getPublicTeamProfile(params.id);

  return (
    <PublicPageShell className="pb-20 pt-28">
      <section className="hero-brand text-white">
        <div className="container-px grid gap-8 py-14 lg:grid-cols-[1fr_24rem] lg:items-end">
          <div>
            <Link href="/teams" className="text-xs font-black uppercase tracking-[0.14em] text-gold-500 hover:text-white">Back to team rankings</Link>
            <h1 className="mt-6 max-w-5xl font-display text-[clamp(3.2rem,8vw,6.5rem)] font-black leading-none">{profile.team.name}</h1>
            <p className="mt-5 max-w-3xl text-lg font-medium leading-8 text-white/72">
              {profile.team.programFullName} {profile.team.programAbbreviation ? `(${profile.team.programAbbreviation})` : ""} | {profile.team.city ?? "City not listed"}, {profile.team.region ?? "Region not listed"}
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {profile.contexts.map((context) => (
                <span key={`${context.leagueId}-${context.seasonId}`} className="border border-white/15 bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-white">
                  {context.ageGroup} {context.gender} | {context.seasonName}
                </span>
              ))}
            </div>
          </div>
          <aside className="rounded-lg border border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-white p-6 text-court-900 shadow-panel">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-hardwood-600">Current Record</p>
            <div className="mt-4 flex items-center gap-3">
              <WinLossPill result="W" />
              <strong className="font-display text-stat-lg font-black leading-none">{profile.standings.wins}</strong>
              <WinLossPill result="L" />
              <strong className="font-display text-stat-lg font-black leading-none">{profile.standings.losses}</strong>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line-500 pt-5">
              <Metric label="Games" value={profile.standings.gamesPlayed} />
              <Metric label="Win %" value={profile.standings.winPercentage.toFixed(3)} />
              <Metric label="PF" value={profile.standings.pointsFor} />
              <Metric label="PA" value={profile.standings.pointsAgainst} />
              <Metric label="Diff" value={`${profile.standings.pointDifferential >= 0 ? "+" : ""}${profile.standings.pointDifferential}`} />
              <Metric label="Roster" value={profile.roster.length} />
            </div>
          </aside>
        </div>
      </section>

      <section className="container-px grid gap-10 py-7 md:py-9">
        <section>
          <div className="mb-5">
            <SectionHeader title="Players" variant="content" />
          </div>
          <div className="mt-6 overflow-hidden border border-line-500 bg-white">
            <div className="hidden grid-cols-[minmax(14rem,1.4fr)_7rem_8rem_8rem_repeat(4,5rem)] gap-3 border-b border-court-900 bg-court-900 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-white/70 lg:grid">
              <span>Player</span><span>Pos</span><span>Class</span><span>Height</span><span>GP</span><span>PPG</span><span>RPG</span><span>APG</span>
            </div>
            {profile.roster.map((player) => (
              <Link key={player.playerId} href={`/players/${player.slug}`} className="grid gap-3 border-b border-line-500 px-4 py-4 last:border-b-0 hover:bg-paper-500 lg:grid-cols-[minmax(14rem,1.4fr)_7rem_8rem_8rem_repeat(4,5rem)] lg:items-center">
                <strong className="text-lg font-black leading-tight text-court-900">{player.displayName}</strong>
                <RosterValue label="Pos" value={player.position ?? "Not listed"} />
                <RosterValue label="Class" value={player.classYear ?? "Not listed"} />
                <RosterValue label="Height" value={formatHeight(player.heightCm)} />
                <RosterValue label="GP" value={player.gamesPlayed} />
                <RosterValue label="PPG" value={player.ppg} />
                <RosterValue label="RPG" value={player.rpg} />
                <RosterValue label="APG" value={player.apg} />
              </Link>
            ))}
            {!profile.roster.length ? <p className="p-5 text-court-600">No active official player stats are linked to this team yet.</p> : null}
          </div>
        </section>

        <section>
          <div className="mb-5">
            <SectionHeader title="Last 5 Results" variant="content" />
          </div>
          <div className="mt-6">
            {profile.recentGames.length ? <GameList games={profile.recentGames} /> : <p className="border border-line-500 bg-white p-5 text-court-600">No recent games are listed for this team yet.</p>}
          </div>
        </section>
      </section>
    </PublicPageShell>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <span>
      <strong className="block font-display text-stat-sm font-black leading-none text-court-900">{value}</strong>
      <small className="mt-1 block text-xs font-black uppercase tracking-[0.12em] text-court-500">{label}</small>
    </span>
  );
}

function RosterValue({ label, value }: { label: string; value: string | number }) {
  return (
    <span>
      <strong className="block text-sm font-black text-court-800">{value}</strong>
      <small className="block text-[0.62rem] font-bold uppercase tracking-[0.12em] text-court-400 lg:hidden">{label}</small>
    </span>
  );
}
