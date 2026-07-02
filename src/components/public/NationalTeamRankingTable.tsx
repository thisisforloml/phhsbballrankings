import Link from "next/link";

import { SortIndicator } from "@/components/public/SortIndicator";
import { formatBoardRank } from "@/lib/public-rank-display";
import type { NationalTeamRatingRow } from "@/lib/team-ratings/get-national-team-rankings";

type NationalSortKey = "rank" | "program" | "rating" | "games" | "opponents";
type SortDirection = "asc" | "desc";
type VisibleNationalRow = NationalTeamRatingRow & { visibleRank: number };

const desktopGrid = "lg:grid-cols-[3.5rem_minmax(14rem,1.6fr)_6rem_5rem_5rem] lg:gap-x-4";

export function NationalTeamRankingTable({
  rows,
  sortKey,
  sortDirection,
  onSort,
}: {
  rows: VisibleNationalRow[];
  sortKey?: NationalSortKey;
  sortDirection?: SortDirection;
  onSort?: (key: NationalSortKey) => void;
}) {
  return (
    <div>
      <div className="hidden px-4 lg:block">
        <div className={`grid items-center border-b border-line-500 py-3 ${desktopGrid}`}>
          <SortHeader label="Rank" column="rank" active={sortKey} direction={sortDirection} onSort={onSort} />
          <SortHeader label="Program" column="program" active={sortKey} direction={sortDirection} onSort={onSort} />
          <SortHeader label="TPI" column="rating" active={sortKey} direction={sortDirection} onSort={onSort} />
          <SortHeader label="Games" column="games" active={sortKey} direction={sortDirection} onSort={onSort} />
          <SortHeader label="Opponents" column="opponents" active={sortKey} direction={sortDirection} onSort={onSort} />
        </div>
      </div>

      {rows.map((team, index) => {
        const isLast = index === rows.length - 1;
        const href = team.teamId ? `/teams/${team.teamId}` : null;

        if (!href) {
          return (
            <div key={team.id} className={`block px-4 ${isLast ? "" : "border-b border-line-500"}`}>
              <NationalRowContent team={team} isLast={isLast} />
            </div>
          );
        }

        return (
          <Link
            key={team.id}
            href={href}
            className={`group block px-4 transition hover:bg-paper-500/70 ${isLast ? "" : "border-b border-line-500"}`}
          >
            <NationalRowContent team={team} isLast={isLast} linked />
          </Link>
        );
      })}
    </div>
  );
}

function NationalRowContent({ team, isLast, linked = false }: { team: VisibleNationalRow; isLast: boolean; linked?: boolean }) {
  return (
    <>
      <div className={`hidden items-center py-3.5 lg:grid ${desktopGrid}`}>
        <span className="flex items-center justify-center font-numeric text-2xl font-bold leading-none tracking-wide text-court-800 group-hover:text-hardwood-600">
          {formatBoardRank(team.visibleRank)}
        </span>
        <span className="min-w-0">
          <strong className={`block truncate text-base font-bold leading-tight ${linked ? "text-court-900 group-hover:text-hardwood-600" : "text-court-900"}`}>
            {team.programName}
          </strong>
          <small className="mt-0.5 block text-sm font-semibold text-court-500">
            {team.city} · {team.region}
          </small>
        </span>
        <span className="text-center">
          <strong className="font-numeric text-xl font-bold italic leading-none text-hardwood-600">{team.rating.toFixed(2)}</strong>
        </span>
        <Metric value={team.verifiedGameCount} />
        <Metric value={team.verifiedOpponentCount} />
      </div>

      <div className={`grid grid-cols-12 items-center gap-3 py-3.5 lg:hidden ${isLast ? "" : "border-b border-line-500"}`}>
        <div className="col-span-2 flex justify-center">
          <span className="font-numeric text-2xl font-bold leading-none text-court-800">{formatBoardRank(team.visibleRank)}</span>
        </div>
        <div className="col-span-6 min-w-0">
          <strong className="block truncate text-base font-bold text-court-900">{team.programName}</strong>
          <small className="mt-0.5 block text-xs font-semibold text-court-500">
            {team.city} · {team.region}
          </small>
        </div>
        <div className="col-span-4 text-center">
          <strong className="font-numeric block text-xl font-bold italic text-hardwood-600">{team.rating.toFixed(2)}</strong>
          <small className="block text-[0.62rem] font-bold uppercase tracking-[0.12em] text-court-400">TPI</small>
        </div>
      </div>
    </>
  );
}

function SortHeader({
  label,
  column,
  active,
  direction,
  onSort,
  align = "center",
}: {
  label: string;
  column: NationalSortKey;
  active?: NationalSortKey;
  direction?: SortDirection;
  onSort?: (key: NationalSortKey) => void;
  align?: "left" | "center";
}) {
  const isActive = active === column;
  const alignClass = align === "left" ? "justify-start text-left" : "justify-center text-center";

  return (
    <button
      type="button"
      onClick={() => onSort?.(column)}
      className={`inline-flex h-full w-full items-center text-[0.65rem] font-bold uppercase tracking-[0.1em] transition hover:text-court-900 ${alignClass} ${
        isActive ? "text-hardwood-600" : "text-court-500"
      }`}
    >
      {label}
      {isActive && direction ? <SortIndicator direction={direction} /> : null}
    </button>
  );
}

function Metric({ value }: { value: string | number }) {
  return (
    <span className="text-center">
      <strong className="font-numeric text-base font-bold text-court-900">{value}</strong>
    </span>
  );
}
