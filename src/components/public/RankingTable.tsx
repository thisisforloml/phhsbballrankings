import Link from "next/link";

import { PortraitAvatar } from "@/components/public/PortraitAvatar";
import { SortIndicator } from "@/components/public/SortIndicator";
import { StarRating } from "@/components/ui";
import { formatHeight, getPlayerProfileHref } from "@/lib/format";
import { formatBoardRank, isPublicRankBand } from "@/lib/public-rank-display";
import type { NationalRankingRow } from "@/lib/rankings";
import type { RankingSortKey, SortDirection } from "@/lib/rankings-url-state";
import { getProgramDisplayName } from "@/lib/uaap-school-display";

function positionLabel(position: string | null) {
  return position?.trim() || "Not listed";
}

function leagueLabel(row: NationalRankingRow) {
  return row.primaryCompetition?.shortName ?? "—";
}

function schoolLabel(row: NationalRankingRow) {
  return getProgramDisplayName(row.currentTeam) || row.currentTeam || "—";
}

type RankingTableProps = {
  rows: NationalRankingRow[];
  rankByPlayerId?: Record<string, number>;
  rankDeltaByPlayerId?: Record<string, number>;
  rankColumnLabel?: string;
  sortKey?: RankingSortKey;
  sortDirection?: SortDirection;
  onSort?: (key: RankingSortKey) => void;
  variant?: "paper" | "scout";
  tone?: "dark" | "light";
};

const paperRowGrid = "lg:grid-cols-[4.5rem_minmax(14rem,26rem)_7rem_5.5rem_8.5rem_minmax(0,1fr)]";
const scoutDesktopGrid =
  "lg:grid-cols-[3rem_minmax(14rem,1.6fr)_minmax(8rem,1fr)_6rem_4rem_minmax(8rem,0.9fr)_6rem] lg:gap-x-4";
const scoutRatingColumnClass = "flex w-full items-center justify-center pr-4";

function hometownLabel(row: NationalRankingRow) {
  return row.city?.trim() || "—";
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = "left",
  variant = "scout",
  tone = "dark",
  className = "",
}: {
  label: string;
  sortKey: RankingSortKey;
  activeKey?: RankingSortKey;
  direction?: SortDirection;
  onSort?: (key: RankingSortKey) => void;
  align?: "left" | "center" | "right";
  variant?: "paper" | "scout";
  tone?: "dark" | "light";
  className?: string;
}) {
  const active = activeKey === sortKey;
  const interactive = Boolean(onSort);
  const isLight = variant === "scout" && tone === "light";
  const mutedClass = variant === "paper" || isLight ? "text-court-500" : "text-scout-500";
  const activeClass = variant === "paper" || isLight ? "text-hardwood-600" : "text-scout-orange-bright";
  const hoverClass = isLight ? "hover:text-court-900" : "hover:text-scout-50";
  const alignClass =
    align === "center" ? "justify-center text-center" : align === "right" ? "justify-end text-right" : "justify-start text-left";

  const staticAlignClass =
    align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";

  if (!interactive) {
    return (
      <span className={`flex h-full items-center justify-center font-bold ${staticAlignClass} ${mutedClass} ${className}`}>
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSort?.(sortKey)}
      className={`inline-flex h-full w-full items-center font-bold transition ${hoverClass} ${alignClass} ${
        active ? activeClass : mutedClass
      } ${className}`}
    >
      {label}
      {active && direction ? <SortIndicator direction={direction} /> : null}
    </button>
  );
}

function ScoutRatingCell({
  rating,
  starRating,
  light = false,
  starsOnly = false,
  compact = false,
}: {
  rating: number;
  starRating: number;
  light?: boolean;
  starsOnly?: boolean;
  compact?: boolean;
}) {
  if (compact) {
    if (starsOnly) {
      return (
        <div className="flex items-center justify-end">
          <StarRating stars={starRating} />
        </div>
      );
    }

    return (
      <div className="flex flex-col items-end justify-center">
        <span
          className={`font-numeric text-lg font-bold italic leading-none tracking-wide ${
            light ? "text-hardwood-600" : "text-scout-orange-bright"
          }`}
        >
          {rating.toFixed(1)}
        </span>
        <span className="mt-0.5 block origin-right scale-90">
          <StarRating stars={starRating} />
        </span>
      </div>
    );
  }

  if (starsOnly) {
    return (
      <div className="flex items-center justify-center">
        <StarRating stars={starRating} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <span
        className={`font-numeric text-xl font-bold italic leading-none tracking-wide ${
          light ? "text-hardwood-600" : "text-scout-orange-bright"
        }`}
      >
        {rating.toFixed(2)}
      </span>
      <span className="mt-1.5 block">
        <StarRating stars={starRating} />
      </span>
    </div>
  );
}

export function RankingTable({
  rows,
  rankByPlayerId,
  rankColumnLabel = "Rank",
  sortKey,
  sortDirection,
  onSort,
  variant = "scout",
  tone = "dark",
}: RankingTableProps) {
  const isScout = variant === "scout";
  const isLight = isScout && tone === "light";

  if (isScout) {
    const headerTone = isLight ? "light" : "dark";
    return (
      <div>
        <div className="hidden px-4 lg:block">
          <div className={`grid items-center ${scoutDesktopGrid} border-b border-line-500 py-3`}>
          <SortableHeader
            label={rankColumnLabel}
            sortKey="rank"
            activeKey={sortKey}
            direction={sortDirection}
            onSort={onSort}
            align="center"
            variant="scout"
            tone={headerTone}
            className="text-[0.65rem] uppercase tracking-[0.1em]"
          />
          <SortableHeader
            label="Player"
            sortKey="athlete"
            activeKey={sortKey}
            direction={sortDirection}
            onSort={onSort}
            align="center"
            variant="scout"
            tone={headerTone}
            className="text-[0.65rem] uppercase tracking-[0.1em]"
          />
          <span className={`flex items-center justify-center text-center text-[0.65rem] font-bold uppercase tracking-[0.1em] ${isLight ? "text-court-500" : "text-scout-500"}`}>
            Hometown
          </span>
          <SortableHeader
            label="Height"
            sortKey="height"
            activeKey={sortKey}
            direction={sortDirection}
            onSort={onSort}
            align="center"
            variant="scout"
            tone={headerTone}
            className="text-[0.65rem] uppercase tracking-[0.1em]"
          />
          <SortableHeader
            label="Position"
            sortKey="position"
            activeKey={sortKey}
            direction={sortDirection}
            onSort={onSort}
            align="center"
            variant="scout"
            tone={headerTone}
            className="px-1 text-[0.65rem] uppercase tracking-[0.1em]"
          />
          <span className={`flex items-center justify-center text-center text-[0.65rem] font-bold uppercase tracking-[0.1em] ${isLight ? "text-court-500" : "text-scout-500"}`}>
            League
          </span>
          <div className={scoutRatingColumnClass}>
            <SortableHeader
              label="Rating"
              sortKey="rating"
              activeKey={sortKey}
              direction={sortDirection}
              onSort={onSort}
              align="center"
              variant="scout"
              tone={headerTone}
              className="text-[0.65rem] uppercase tracking-[0.1em]"
            />
          </div>
          </div>
        </div>

        {rows.map((row, index) => {
          const rank = rankByPlayerId?.[row.playerId] ?? row.rank;
          const hideNumericRating = isPublicRankBand(rank);
          const rowBorder = isLight ? "border-b border-line-500" : "border-b border-white/[0.08]";
          const rankClass = isLight
            ? rank <= 3
              ? "text-hardwood-600 group-hover:text-hardwood-500"
              : "text-court-800 group-hover:text-court-900"
            : rank <= 3
              ? "text-scout-orange-bright group-hover:text-scout-orange"
              : "text-scout-50 group-hover:text-white";
          const nameClass = isLight ? "text-court-900 group-hover:text-hardwood-600" : "text-scout-50 group-hover:text-scout-orange-bright";
          const metaClass = isLight ? "text-court-500" : "text-scout-500";
          const cellClass = isLight ? "text-court-700" : "text-scout-50";
          const isLast = index === rows.length - 1;

          return (
            <Link
              key={row.playerId}
              href={getPlayerProfileHref(row)}
              className={`group block px-3 transition lg:px-4 ${isLight ? "bg-white hover:bg-paper-500/70" : "hover:bg-scout-800"}`}
            >
              <div
                className={`hidden items-center py-3.5 lg:grid ${scoutDesktopGrid} ${
                  isLast ? "" : rowBorder
                }`}
              >
                <span className={`flex items-center justify-center font-numeric text-2xl font-bold leading-none tracking-wide ${rankClass}`}>
                  {formatBoardRank(rank)}
                </span>

                <div className="flex min-w-0 items-center gap-2.5">
                  <PortraitAvatar photoUrl={row.photoUrl} name={row.displayName} variant={isLight ? "default" : "scout"} />
                  <div className="min-w-0">
                    <span className={`block truncate text-base font-bold leading-tight ${nameClass}`}>
                      {row.displayName}
                    </span>
                    <span className={`mt-0.5 block truncate text-sm font-semibold ${metaClass}`}>{schoolLabel(row)}</span>
                    {row.classYearLabel ? (
                      <span className={`mt-0.5 block text-xs font-medium ${metaClass}`}>{row.classYearLabel}</span>
                    ) : null}
                  </div>
                </div>

                <span className={`flex items-center justify-center text-center text-sm font-semibold ${metaClass}`}>
                  {hometownLabel(row)}
                </span>

                <span className={`flex items-center justify-center text-center font-numeric text-sm font-semibold tracking-wide ${metaClass}`}>
                  {formatHeight(row.heightCm)}
                </span>

                <span className={`flex items-center justify-center px-1 text-center text-sm font-semibold ${cellClass}`}>
                  {positionLabel(row.position)}
                </span>

                <span className={`flex min-w-0 items-center truncate pl-0.5 text-sm font-semibold ${metaClass}`} title={leagueLabel(row)}>
                  {leagueLabel(row)}
                </span>

                <div className={scoutRatingColumnClass}>
                  <ScoutRatingCell
                    rating={row.rating}
                    starRating={row.starRating}
                    light={isLight}
                    starsOnly={hideNumericRating}
                  />
                </div>
              </div>

              <div
                className={`grid min-h-[44px] grid-cols-[2.5rem_minmax(0,1fr)_4.25rem] items-center gap-x-3 py-2.5 lg:hidden ${
                  isLast ? "" : rowBorder
                }`}
              >
                <div className="flex items-center justify-center">
                  <span className={`font-numeric text-xl font-bold tabular-nums leading-none ${rankClass}`}>
                    {formatBoardRank(rank)}
                  </span>
                </div>

                <div className="min-w-0">
                  <span className={`block truncate text-[0.9375rem] font-bold leading-tight ${nameClass}`}>
                    {row.displayName}
                  </span>
                  <span className={`mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0 truncate text-[0.6875rem] font-semibold leading-tight ${metaClass}`}>
                    <span className="truncate">{schoolLabel(row)}</span>
                    {row.position ? (
                      <>
                        <span aria-hidden="true" className={isLight ? "text-court-300" : "text-white/20"}>
                          ·
                        </span>
                        <span className="shrink-0 uppercase">{positionLabel(row.position)}</span>
                      </>
                    ) : null}
                    {row.classYearLabel ? (
                      <>
                        <span aria-hidden="true" className={isLight ? "text-court-300" : "text-white/20"}>
                          ·
                        </span>
                        <span className="shrink-0">{row.classYearLabel}</span>
                      </>
                    ) : null}
                  </span>
                  <span className={`mt-0.5 block truncate text-[0.625rem] font-medium leading-tight ${metaClass}`}>
                    {hometownLabel(row)} · {leagueLabel(row)}
                  </span>
                </div>

                <div className="flex items-center justify-end">
                  <ScoutRatingCell
                    rating={row.rating}
                    starRating={row.starRating}
                    light={isLight}
                    starsOnly={hideNumericRating}
                    compact
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    );
  }

  const shellClass = "overflow-hidden rounded-sm border border-line-500 bg-white shadow-panel";
  const headClass = "sports-table-head hidden gap-2 lg:grid";
  const rowClass =
    "group grid gap-3 border-b border-line-500 bg-white px-4 py-4 transition last:border-b-0 hover:bg-paper-500";

  return (
    <div className={shellClass}>
      <div className={`${headClass} ${paperRowGrid}`}>
        <SortableHeader
          label={rankColumnLabel}
          sortKey="rank"
          activeKey={sortKey}
          direction={sortDirection}
          onSort={onSort}
          align="center"
          variant="paper"
        />
        <SortableHeader
          label="Athlete"
          sortKey="athlete"
          activeKey={sortKey}
          direction={sortDirection}
          onSort={onSort}
          align="left"
          variant="paper"
        />
        <SortableHeader
          label="Height"
          sortKey="height"
          activeKey={sortKey}
          direction={sortDirection}
          onSort={onSort}
          align="center"
          variant="paper"
        />
        <SortableHeader
          label="Position"
          sortKey="position"
          activeKey={sortKey}
          direction={sortDirection}
          onSort={onSort}
          align="center"
          variant="paper"
        />
        <SortableHeader
          label="Rating"
          sortKey="rating"
          activeKey={sortKey}
          direction={sortDirection}
          onSort={onSort}
          align="center"
          variant="paper"
        />
        <span aria-hidden="true" />
      </div>
      {rows.map((row) => {
        const rank = rankByPlayerId?.[row.playerId] ?? row.rank;
        return (
          <Link key={row.playerId} href={getPlayerProfileHref(row)} className={`${rowClass} ${paperRowGrid} lg:items-center`}>
            <span className="flex items-center justify-center lg:justify-center">
              <span className="font-numeric text-3xl font-bold leading-none tracking-wide text-court-800 group-hover:text-hardwood-600">
                {formatBoardRank(rank)}
              </span>
            </span>
            <span className="grid grid-cols-[auto_1fr] items-center gap-3">
              <PortraitAvatar photoUrl={row.photoUrl} name={row.displayName} variant="default" />
              <span>
                <span className="block text-base font-bold leading-tight text-court-900">{row.displayName}</span>
                <small className="block text-sm font-semibold text-court-500">{schoolLabel(row)}</small>
                {row.classYearLabel ? <small className="block text-xs text-court-500">{row.classYearLabel}</small> : null}
                {row.city ? <small className="block text-xs text-court-400">{row.city}</small> : null}
              </span>
            </span>
            <span className="text-center text-sm font-semibold text-court-600">
              <span className="font-numeric tracking-wide">{formatHeight(row.heightCm)}</span>
            </span>
            <span className="text-center text-sm font-semibold text-court-600">{positionLabel(row.position)}</span>
            <span className="flex flex-col items-center text-center">
              <span className="font-numeric block text-2xl font-bold italic leading-none text-court-900">
                {row.rating.toFixed(2)}
              </span>
              <span className="mt-1 block">
                <StarRating stars={row.starRating} />
              </span>
            </span>
            <span aria-hidden="true" />
          </Link>
        );
      })}
    </div>
  );
}
