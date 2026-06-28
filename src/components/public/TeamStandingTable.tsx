import type { TeamStandingRow } from "@/lib/team-rankings";
import { SortIndicator } from "@/components/public/SortIndicator";
import { WinLossPill } from "@/components/ui";

type TeamSortKey = "rank" | "team" | "record" | "winPercentage" | "pointsFor" | "pointsAgainst" | "pointDifferential" | "league";
type SortDirection = "asc" | "desc";
type VisibleTeamRow = TeamStandingRow & { visibleRank: number };

export function TeamStandingTable({
  rows,
  sortKey,
  sortDirection,
  onSort
}: {
  rows: VisibleTeamRow[];
  sortKey?: TeamSortKey;
  sortDirection?: SortDirection;
  onSort?: (key: TeamSortKey) => void;
}) {
  return (
    <div className="overflow-hidden border border-line-500 bg-white">
      <div className="hidden grid-cols-[5rem_minmax(13rem,1.2fr)_8rem_8rem_7rem_7rem_7rem_minmax(13rem,1fr)] gap-3 border-b border-court-900 bg-court-900 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-white/70 lg:grid">
        <SortHeader label="Rank" column="rank" active={sortKey} direction={sortDirection} onSort={onSort} align="left" />
        <SortHeader label="Team" column="team" active={sortKey} direction={sortDirection} onSort={onSort} align="left" />
        <SortHeader label="Record" column="record" active={sortKey} direction={sortDirection} onSort={onSort} />
        <SortHeader label="Win %" column="winPercentage" active={sortKey} direction={sortDirection} onSort={onSort} />
        <SortHeader label="PF" column="pointsFor" active={sortKey} direction={sortDirection} onSort={onSort} title="Points For" />
        <SortHeader label="PA" column="pointsAgainst" active={sortKey} direction={sortDirection} onSort={onSort} title="Points Against" />
        <SortHeader label="Diff" column="pointDifferential" active={sortKey} direction={sortDirection} onSort={onSort} title="Point Difference" />
        <SortHeader label="League" column="league" active={sortKey} direction={sortDirection} onSort={onSort} align="left" />
      </div>
      {rows.map((team) => (
        <div key={team.id} className="grid gap-3 border-b border-line-500 px-4 py-4 last:border-b-0 hover:bg-paper-500 lg:grid-cols-[5rem_minmax(13rem,1.2fr)_8rem_8rem_7rem_7rem_7rem_minmax(13rem,1fr)] lg:items-center">
          <span className="text-[2rem] font-black leading-none text-court-900">#{team.visibleRank}</span>
          <span>
            <strong className="block text-lg font-black leading-tight text-court-900" title={team.displayName}>{team.displayName}</strong>
            <small className="block text-xs font-bold uppercase tracking-[0.08em] text-court-400" title={team.internalTeamName}>{team.internalTeamName}</small>
            <small className="block text-xs font-semibold text-court-500 lg:hidden">{team.leagueName} / {team.seasonName}</small>
          </span>
          <span className="flex items-center gap-2">
            <WinLossPill result="W" />
            <strong className="font-display text-xl font-black text-court-900">{team.wins}</strong>
            <WinLossPill result="L" />
            <strong className="font-display text-xl font-black text-court-900">{team.losses}</strong>
          </span>
          <Metric label="Win %" value={team.winPercentage.toFixed(3)} />
          <Metric label="PF" value={team.pointsFor} />
          <Metric label="PA" value={team.pointsAgainst} />
          <span>
            <strong className={`block font-display text-stat-sm font-black ${team.pointDifferential >= 0 ? "text-win-text" : "text-loss-text"}`}>
              {team.pointDifferential >= 0 ? "+" : ""}{team.pointDifferential}
            </strong>
            <small className="block text-[0.62rem] font-bold uppercase tracking-[0.12em] text-court-400 lg:hidden">Diff</small>
          </span>
          <span className="hidden min-w-0 text-sm font-semibold text-court-600 lg:block" title={`${team.leagueName} / ${team.seasonName}`}>
            <span className="block truncate">{team.leagueName}</span>
            <small className="block text-xs uppercase tracking-[0.08em] text-court-400">{team.seasonName}</small>
          </span>
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
  align = "center",
  title
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
  return (
    <button type="button" title={title} onClick={() => onSort?.(column)} className={`${align === "left" ? "text-left" : "text-center"} font-black hover:text-white`}>
      {label}
      {isActive && direction ? <SortIndicator direction={direction} /> : null}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <span>
      <strong className="block font-display text-stat-sm font-black text-court-900">{value}</strong>
      <small className="block text-[0.62rem] font-bold uppercase tracking-[0.12em] text-court-400 lg:hidden">{label}</small>
    </span>
  );
}
