import Link from "next/link";
import type { TeamStandingRow } from "@/lib/team-rankings-types";
import { formatBoardRank } from "@/lib/public-rank-display";
import { SortIndicator } from "@/components/public/SortIndicator";
import { WinLossPill } from "@/components/ui";

type TeamSortKey = "rank" | "team" | "record" | "winPercentage" | "pointsFor" | "pointsAgainst" | "pointDifferential" | "league";
type SortDirection = "asc" | "desc";
type VisibleTeamRow = TeamStandingRow & { visibleRank: number };

const desktopGrid =
  "lg:grid-cols-[3.5rem_minmax(14rem,1.5fr)_minmax(8rem,0.9fr)_5rem_4.5rem_4.5rem_5rem_minmax(8rem,1fr)] lg:gap-x-4";

export function TeamStandingTable({
  rows,
  sortKey,
  sortDirection,
  onSort,
}: {
  rows: VisibleTeamRow[];
  sortKey?: TeamSortKey;
  sortDirection?: SortDirection;
  onSort?: (key: TeamSortKey) => void;
}) {
  return (
    <div>
      <div className="hidden px-4 lg:block">
        <div className={`grid items-center border-b border-line-500 py-3 ${desktopGrid}`}>
          <SortHeader label="Rank" column="rank" active={sortKey} direction={sortDirection} onSort={onSort} />
          <SortHeader label="Team" column="team" active={sortKey} direction={sortDirection} onSort={onSort} />
          <SortHeader label="Record" column="record" active={sortKey} direction={sortDirection} onSort={onSort} />
          <SortHeader label="Win %" column="winPercentage" active={sortKey} direction={sortDirection} onSort={onSort} />
          <SortHeader label="PF" column="pointsFor" active={sortKey} direction={sortDirection} onSort={onSort} title="Points For" />
          <SortHeader label="PA" column="pointsAgainst" active={sortKey} direction={sortDirection} onSort={onSort} title="Points Against" />
          <SortHeader label="Diff" column="pointDifferential" active={sortKey} direction={sortDirection} onSort={onSort} title="Point Difference" />
          <SortHeader label="League" column="league" active={sortKey} direction={sortDirection} onSort={onSort} />
        </div>
      </div>

      {rows.map((team, index) => {
        const isLast = index === rows.length - 1;
        return (
          <Link
            key={team.id}
            href={`/teams/${team.teamId}`}
            className={`group block px-4 transition hover:bg-paper-500/70 ${isLast ? "" : "border-b border-line-500"}`}
          >
            <div className={`hidden items-center py-3.5 lg:grid ${desktopGrid}`}>
              <span className="flex items-center justify-center font-numeric text-2xl font-bold leading-none tracking-wide text-court-800 group-hover:text-hardwood-600">
                {formatBoardRank(team.visibleRank)}
              </span>
              <span className="min-w-0">
                <strong className="block truncate text-base font-bold leading-tight text-court-900 group-hover:text-hardwood-600" title={team.displayName}>
                  {team.displayName}
                </strong>
                <small className="mt-0.5 block truncate text-sm font-semibold text-court-500" title={team.internalTeamName}>
                  {team.internalTeamName}
                </small>
                <small className="mt-0.5 block text-xs font-medium text-court-400">
                  {team.city}, {team.region}
                </small>
              </span>
              <span className="flex items-center justify-center gap-2">
                <WinLossPill result="W" />
                <strong className="font-numeric text-lg font-bold text-court-900">{team.wins}</strong>
                <WinLossPill result="L" />
                <strong className="font-numeric text-lg font-bold text-court-900">{team.losses}</strong>
              </span>
              <Metric value={team.winPercentage.toFixed(3)} />
              <Metric value={team.pointsFor} />
              <Metric value={team.pointsAgainst} />
              <span className="text-center">
                <strong className={`font-numeric text-lg font-bold ${team.pointDifferential >= 0 ? "text-win-text" : "text-loss-text"}`}>
                  {team.pointDifferential >= 0 ? "+" : ""}
                  {team.pointDifferential}
                </strong>
              </span>
              <span className="min-w-0 text-left text-sm font-semibold text-court-600" title={`${team.leagueName} / ${team.seasonName}`}>
                <span className="block truncate">{team.leagueName}</span>
                <small className="block truncate text-xs text-court-400">{team.seasonName}</small>
              </span>
            </div>

            <div className={`grid grid-cols-12 items-center gap-3 py-3.5 lg:hidden ${isLast ? "" : "border-b border-line-500"}`}>
              <div className="col-span-2 flex justify-center">
                <span className="font-numeric text-2xl font-bold leading-none text-court-800">{formatBoardRank(team.visibleRank)}</span>
              </div>
              <div className="col-span-7 min-w-0">
                <strong className="block truncate text-base font-bold text-court-900">{team.displayName}</strong>
                <small className="mt-0.5 block truncate text-sm font-semibold text-court-500">{team.leagueName}</small>
                <small className="mt-1 block text-xs font-semibold text-court-500">
                  {team.wins}-{team.losses} · {team.winPercentage.toFixed(3)} win% · Diff {team.pointDifferential >= 0 ? "+" : ""}
                  {team.pointDifferential}
                </small>
              </div>
              <div className="col-span-3 text-center">
                <strong className="font-numeric block text-xl font-bold text-court-900">{team.pointsFor}</strong>
                <small className="block text-[0.62rem] font-bold uppercase tracking-[0.12em] text-court-400">PF</small>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function SortHeader({
  label,
  column,
  active,
  direction,
  onSort,
  align = "center",
  title,
}: {
  label: string;
  column: TeamSortKey;
  active?: TeamSortKey;
  direction?: SortDirection;
  onSort?: (key: TeamSortKey) => void;
  align?: "left" | "center";
  title?: string;
}) {
  const isActive = active === column;
  const interactive = Boolean(onSort);
  const alignClass = align === "left" ? "justify-start text-left" : "justify-center text-center";

  if (!interactive) {
    return (
      <span className={`flex h-full items-center text-[0.65rem] font-bold uppercase tracking-[0.1em] text-court-500 ${alignClass}`}>
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      title={title}
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
