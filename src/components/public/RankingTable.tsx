import Link from "next/link";
import type { NationalRankingRow } from "@/lib/rankings";
import type { RankingSortKey, SortDirection } from "@/lib/rankings-url-state";
import { formatHeight, getPlayerProfileHref } from "@/lib/format";
import { PortraitAvatar } from "@/components/public/PortraitAvatar";
import { SortIndicator } from "@/components/public/SortIndicator";
import { StarRating } from "@/components/ui";

function positionLabel(position: string | null) {
  return position?.trim() || "Not listed";
}

type RankingTableProps = {
  rows: NationalRankingRow[];
  rankByPlayerId?: Record<string, number>;
  sortKey?: RankingSortKey;
  sortDirection?: SortDirection;
  onSort?: (key: RankingSortKey) => void;
};

function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort
}: {
  label: string;
  sortKey: RankingSortKey;
  activeKey?: RankingSortKey;
  direction?: SortDirection;
  onSort?: (key: RankingSortKey) => void;
}) {
  const active = activeKey === sortKey;
  const interactive = Boolean(onSort);

  if (!interactive) {
    return <span>{label}</span>;
  }

  return (
    <button
      type="button"
      onClick={() => onSort?.(sortKey)}
      className={`inline-flex items-center text-left transition hover:text-white ${active ? "text-white" : ""}`}
    >
      {label}
      {active && direction ? <SortIndicator direction={direction} /> : null}
    </button>
  );
}

export function RankingTable({
  rows,
  rankByPlayerId,
  sortKey,
  sortDirection,
  onSort
}: RankingTableProps) {
  return (
    <div className="mx-auto max-w-[74rem] overflow-hidden border border-line-500 bg-white">
      <div className="hidden grid-cols-[5.5rem_minmax(20rem,1.8fr)_8rem_8rem_11rem] border-b border-court-900 bg-court-900 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-white/72 lg:grid">
        <SortableHeader label="Rank" sortKey="rank" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
        <SortableHeader label="Athlete" sortKey="athlete" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
        <SortableHeader label="Height" sortKey="height" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
        <SortableHeader label="Position" sortKey="position" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
        <SortableHeader label="Rating" sortKey="rating" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
      </div>
      {rows.map((row) => {
        const rank = rankByPlayerId?.[row.playerId] ?? row.rank;
        return (
          <Link
            key={row.playerId}
            href={getPlayerProfileHref(row)}
            className="group grid gap-3 border-b border-line-500 bg-white px-4 py-4 transition last:border-b-0 hover:bg-paper-500 lg:grid-cols-[5.5rem_minmax(20rem,1.8fr)_8rem_8rem_11rem] lg:items-center"
          >
            <span className="flex items-center gap-3">
              <strong className="text-[2.25rem] font-black leading-none text-court-900 group-hover:text-hardwood-600">#{rank}</strong>
            </span>
            <span className="grid grid-cols-[auto_1fr] items-center gap-3">
              <PortraitAvatar photoUrl={row.photoUrl} name={row.displayName} />
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
          </Link>
        );
      })}
    </div>
  );
}
