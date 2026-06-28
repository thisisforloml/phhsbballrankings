import Link from "next/link";
import type { NationalTeamRatingRow } from "@/lib/team-ratings/get-national-team-rankings";
import { SortIndicator } from "@/components/public/SortIndicator";

type NationalSortKey = "rank" | "program" | "rating" | "games" | "opponents";
type SortDirection = "asc" | "desc";
type VisibleNationalRow = NationalTeamRatingRow & { visibleRank: number };

export function NationalTeamRankingTable({
  rows,
  sortKey,
  sortDirection,
  onSort
}: {
  rows: VisibleNationalRow[];
  sortKey?: NationalSortKey;
  sortDirection?: SortDirection;
  onSort?: (key: NationalSortKey) => void;
}) {
  return (
    <div className="overflow-hidden border border-line-500 bg-white">
      <div className="sports-table-head hidden grid-cols-[4rem_minmax(15rem,1.3fr)_6rem_5rem_5rem] gap-2 lg:grid">
        <SortHeader label="Rank" column="rank" active={sortKey} direction={sortDirection} onSort={onSort} align="left" />
        <SortHeader label="Program" column="program" active={sortKey} direction={sortDirection} onSort={onSort} align="left" />
        <SortHeader label="TPI" column="rating" active={sortKey} direction={sortDirection} onSort={onSort} />
        <SortHeader label="Games" column="games" active={sortKey} direction={sortDirection} onSort={onSort} />
        <SortHeader label="Opponents" column="opponents" active={sortKey} direction={sortDirection} onSort={onSort} />
      </div>
      {rows.map((team) => (
        <div
          key={team.id}
          className="grid gap-2 border-b border-line-500 px-3 py-2 last:border-b-0 hover:bg-paper-500 lg:grid-cols-[4rem_minmax(15rem,1.3fr)_6rem_5rem_5rem] lg:items-center"
        >
          <span className="font-display text-[1.45rem] font-black leading-none text-court-900">#{team.visibleRank}</span>
          <span>
            {team.teamId ? (
              <Link href={`/teams/${team.teamId}`} className="block text-sm font-black leading-tight text-court-900 hover:text-hardwood-600 md:text-base">
                {team.programName}
              </Link>
            ) : (
              <span className="block text-sm font-black leading-tight text-court-900 md:text-base">{team.programName}</span>
            )}
            <small className="block text-xs font-semibold text-court-500">
              {team.city} · {team.region}
            </small>
          </span>
          <span className="text-center">
            <strong className="block font-display text-stat-sm font-black text-court-900">{team.rating.toFixed(2)}</strong>
            <small className="block text-[0.62rem] font-bold uppercase tracking-[0.12em] text-court-400 lg:hidden">TPI</small>
          </span>
          <Metric label="Games" value={team.verifiedGameCount} />
          <Metric label="Opponents" value={team.verifiedOpponentCount} />
        </div>
      ))}
    </div>
  );
}

function SortHeader({
  label,
  column,
  active,
  direction,
  onSort,
  align = "center"
}: {
  label: string;
  column: NationalSortKey;
  active?: NationalSortKey;
  direction?: SortDirection;
  onSort?: (key: NationalSortKey) => void;
  align?: "left" | "center";
}) {
  const isActive = active === column;
  return (
    <button type="button" onClick={() => onSort?.(column)} className={`${align === "left" ? "text-left" : "text-center"} font-black hover:text-white`}>
      {label}
      {isActive && direction ? <SortIndicator direction={direction} /> : null}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="text-center">
      <strong className="block font-display text-stat-sm font-black text-court-900">{value}</strong>
      <small className="block text-[0.62rem] font-bold uppercase tracking-[0.12em] text-court-400 lg:hidden">{label}</small>
    </span>
  );
}
