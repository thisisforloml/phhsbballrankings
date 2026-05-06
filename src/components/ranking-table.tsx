import Link from "next/link";
import { initials, starText } from "@/lib/format";
import type { PlayerSummary } from "@/lib/types";

interface RankingTableProps {
  players: PlayerSummary[];
  rankLabels?: string[];
  title?: string;
}

export function RankingTable({ players, rankLabels, title = "Top verified player rankings" }: RankingTableProps) {
  return (
    <div className="rounded-lg border border-surface-200 bg-white shadow-sm">
      <div className="flex justify-between gap-4 border-b border-surface-200 px-4 py-4 font-mono text-mono-sm uppercase text-ink-500">
        <span>{title}</span>
        <span>Updated every Monday</span>
      </div>
      <div className="hidden grid-cols-[4rem_1.6fr_5rem_1fr_5rem_6rem_6rem] border-b border-surface-200 px-4 py-3 font-mono text-mono-sm uppercase text-ink-500 md:grid">
        <span>Rank</span><span>Player</span><span>Age</span><span>Location</span><span>Games</span><span>Rating</span><span>Stars</span>
      </div>
      {players.map((player, index) => (
        <div key={player.id} className="grid gap-3 border-b border-l-0 border-surface-200 px-4 py-4 transition hover:border-l-[3px] hover:border-l-navy-800 hover:bg-navy-50 last:border-b-0 md:grid-cols-[4rem_1.6fr_5rem_1fr_5rem_6rem_6rem] md:items-center">
          <span className="font-mono text-ink-500">#{rankLabels?.[index] ?? index + 1}</span>
          <Link className="grid grid-cols-[auto_1fr] items-center gap-3" href={`/players/${player.slug}`}>
            {player.photoUrl ? (
              <img className="h-10 w-10 rounded-full object-cover" src={player.photoUrl} alt="" />
            ) : (
              <span className="inline-grid h-10 w-10 place-items-center rounded-full bg-navy-50 font-display font-bold text-navy-800">{initials(player.displayName)}</span>
            )}
            <span>
              <span className="block text-ink-900">{player.displayName}</span>
              <small className="text-ink-500">{player.position} · {player.team}</small>
            </span>
          </Link>
          <span className="text-ink-500">{player.ageGroup}</span>
          <span className="text-ink-500">{player.city}, {player.region}</span>
          <span className="font-mono text-ink-600">{player.games}</span>
          <span className="font-display text-stat-sm text-navy-800">{player.rating.toFixed(1)}</span>
          <span className="text-amber-700">{starText(player.stars)}</span>
        </div>
      ))}
      {!players.length ? <div className="p-6 text-ink-500">No eligible players match these filters yet.</div> : null}
    </div>
  );
}
