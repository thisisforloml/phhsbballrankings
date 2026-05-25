import Link from "next/link";
import type { NationalRankingRow } from "@/lib/rankings";
import { formatHeight, getPlayerProfileHref } from "@/lib/format";
import { StarRating } from "@/components/ui";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function positionLabel(position: string | null) {
  return position?.trim() || "Not listed";
}

export function RankingTable({ rows }: { rows: NationalRankingRow[] }) {
  return (
    <div className="overflow-hidden border border-line-500 bg-white">
      <div className="hidden grid-cols-[5.5rem_minmax(20rem,1.8fr)_8rem_8rem_11rem_8rem] border-b border-court-900 bg-court-900 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-white/72 lg:grid">
        <span>Rank</span>
        <span>Athlete</span>
        <span>Height</span>
        <span>Position</span>
        <span>Rating</span>
        <span>Games</span>
      </div>
      {rows.map((row, index) => (
        <Link
          key={row.playerId}
          href={getPlayerProfileHref(row)}
          className="group grid gap-3 border-b border-line-500 bg-white px-4 py-4 transition last:border-b-0 hover:bg-paper-500 lg:grid-cols-[5.5rem_minmax(20rem,1.8fr)_8rem_8rem_11rem_8rem] lg:items-center"
        >
          <span className="flex items-center gap-3">
            <strong className="text-[2.25rem] font-black leading-none text-court-900 group-hover:text-hardwood-600">#{index + 1}</strong>
          </span>
          <span className="grid grid-cols-[auto_1fr] items-center gap-3">
            <span className="grid size-12 place-items-center overflow-hidden border border-court-900 bg-court-900 text-sm font-black text-gold-500">
              {row.photoUrl ? <img src={row.photoUrl} alt="" className="h-full w-full object-cover" /> : initials(row.displayName)}
            </span>
            <span>
              <strong className="block text-lg font-black leading-tight text-court-900">{row.displayName}</strong>
              <small className="block text-sm font-semibold text-court-500">{row.currentTeam}</small>
              <small className="block text-xs uppercase tracking-[0.08em] text-court-400">{row.city}, {row.region}</small>
            </span>
          </span>
          <span className="text-sm font-semibold text-court-700">{formatHeight(row.heightCm)}</span>
          <span className="w-fit border border-line-500 bg-paper-500 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.08em] text-court-700">
            {positionLabel(row.position)}
          </span>
          <span>
            <strong className="block text-2xl font-black leading-none text-court-900">{row.rating.toFixed(2)}</strong>
            <span className="mt-1 block"><StarRating stars={row.starRating} /></span>
          </span>
          <span className="text-sm font-bold uppercase tracking-[0.08em] text-court-500">{row.verifiedGameCount} GP</span>
        </Link>
      ))}
    </div>
  );
}

