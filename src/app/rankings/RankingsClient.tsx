"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { LatestNationalRankings, NationalRankingRow } from "@/lib/rankings";
import { publicRankingsCoverageCopy } from "@/lib/public-rankings-coverage";
import { getPublicBoardRows, sortRankingRows } from "@/lib/public-board-ranks";
import {
  buildRankingsSearchParams,
  defaultMinIndex,
  eligibilityMinimum,
  minGameStopsForGender,
  minimumGamesForState,
  normalizedAge,
  normalizedGender,
  parseRankingsUrlState,
  rankingsSearchEqual,
  type RankingSortKey,
  type SortDirection
} from "@/lib/rankings-url-state";
import { EmptyState } from "@/components/ui";
import { AgeGroupPill } from "@/components/public/AgeGroupPill";
import { FilterToolbar, FilterToolbarControlClass, FilterToolbarField, FilterToolbarRow } from "@/components/public/FilterToolbar";
import { PageBand } from "@/components/public/PageBand";
import { PaginationBar } from "@/components/public/PaginationBar";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { RankingTable } from "@/components/public/RankingTable";
import { RankingsCoverageNotice } from "@/components/public/RankingsCoverageNotice";
import { SegmentedControl } from "@/components/public/SegmentedControl";

const ageGroups = ["U13", "U16", "U19"] as const;
const genders = ["Boys", "Girls"] as const;
const pageSize = 100;
const maxPublicRows = 300;
const notListedPosition = "Not listed";
const positionOrder = ["G", "PG", "SG", "F", "SF", "PF", "C"];

function positionLabel(position: string | null) {
  return position?.trim() || notListedPosition;
}

function searchText(row: NationalRankingRow) {
  return [row.displayName, row.currentTeam, row.position ?? notListedPosition, row.city, row.region]
    .join(" ")
    .toLowerCase();
}

export function RankingsClient({ rankings }: { rankings: LatestNationalRankings }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlState = useMemo(() => parseRankingsUrlState(searchParams), [searchParams]);

  const [ageGroup, setAgeGroup] = useState(urlState.ageGroup);
  const [gender, setGender] = useState(urlState.gender);
  const [region, setRegion] = useState("All");
  const [position, setPosition] = useState("All");
  const [query, setQuery] = useState("");
  const [minIndex, setMinIndex] = useState(urlState.minIndex);
  const [page, setPage] = useState(urlState.page);
  const [sortKey, setSortKey] = useState<RankingSortKey>(urlState.sortKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(urlState.sortDirection);

  useEffect(() => {
    setAgeGroup(urlState.ageGroup);
    setGender(urlState.gender);
    setMinIndex(urlState.minIndex);
    setSortKey(urlState.sortKey);
    setSortDirection(urlState.sortDirection);
    setPage(urlState.page);
  }, [urlState]);

  useEffect(() => {
    const nextParams = buildRankingsSearchParams({ gender, ageGroup, minIndex, sortKey, sortDirection, page });
    const currentParams = new URLSearchParams(searchParams.toString());
    if (rankingsSearchEqual(nextParams, currentParams)) return;

    const nextUrl = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [ageGroup, gender, minIndex, page, pathname, router, searchParams, sortDirection, sortKey]);

  const selectedAgeSnapshots = rankings.snapshotsByAge?.[ageGroup];
  const selectedSnapshot = selectedAgeSnapshots ? (gender === "Girls" ? selectedAgeSnapshots.girls : selectedAgeSnapshots.boys) : (gender === "Girls" ? rankings.snapshots.girls : rankings.snapshots.boys);
  const rowsForAge = selectedSnapshot.rows;
  const publicBoardRows = useMemo(() => getPublicBoardRows(selectedSnapshot), [selectedSnapshot]);
  const boardRankByPlayerId = useMemo(() => {
    return Object.fromEntries(publicBoardRows.map((row, index) => [row.playerId, index + 1]));
  }, [publicBoardRows]);
  const minGameOptions = minGameStopsForGender(gender);
  const selectedMinIndex = Math.min(minIndex, minGameOptions.length - 1);
  const minimumGames = minimumGamesForState(gender, ageGroup, selectedMinIndex);

  const regionOptions = useMemo(
    () => Array.from(new Set(rowsForAge.map((row) => row.region))).sort(),
    [rowsForAge]
  );
  const positionOptions = useMemo(
    () => Array.from(new Set(rowsForAge.map((row) => positionLabel(row.position)))).sort((left, right) => {
      if (left === notListedPosition) return 1;
      if (right === notListedPosition) return -1;

      const leftIndex = positionOrder.indexOf(left.toUpperCase());
      const rightIndex = positionOrder.indexOf(right.toUpperCase());
      if (leftIndex !== -1 && rightIndex !== -1) return leftIndex - rightIndex;
      if (leftIndex !== -1) return -1;
      if (rightIndex !== -1) return 1;
      return left.localeCompare(right);
    }),
    [rowsForAge]
  );

  const filteredRows = useMemo(() => {
    const value = query.trim().toLowerCase();

    return sortRankingRows(publicBoardRows
      .filter((row) => region === "All" || row.region === region)
      .filter((row) => position === "All" || positionLabel(row.position) === position)
      .filter((row) => !value || searchText(row).includes(value))
      .filter((row) => row.verifiedGameCount >= minimumGames));
  }, [minimumGames, position, publicBoardRows, query, region]);
  const sortedRows = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;
    const boardRank = (row: NationalRankingRow) => boardRankByPlayerId[row.playerId] ?? row.rank;
    return filteredRows.slice().sort((left, right) => {
      if (sortKey === "rank") return (boardRank(left) - boardRank(right)) * direction;
      if (sortKey === "athlete") return left.displayName.localeCompare(right.displayName) * direction || boardRank(left) - boardRank(right);
      if (sortKey === "height") return ((left.heightCm ?? 0) - (right.heightCm ?? 0)) * direction || boardRank(left) - boardRank(right);
      if (sortKey === "position") return positionLabel(left.position).localeCompare(positionLabel(right.position)) * direction || boardRank(left) - boardRank(right);
      return (left.rating - right.rating) * direction || boardRank(left) - boardRank(right);
    });
  }, [boardRankByPlayerId, filteredRows, sortDirection, sortKey]);
  const visibleRows = sortedRows.slice(0, maxPublicRows);
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = visibleRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageStart = visibleRows.length ? (currentPage - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(currentPage * pageSize, visibleRows.length);

  const controlClass = FilterToolbarControlClass();

  function resetBoard() {
    setPage(1);
  }

  function clearFilters() {
    setRegion("All");
    setPosition("All");
    setQuery("");
    setMinIndex(defaultMinIndex(gender, ageGroup));
    resetBoard();
  }

  function updateSort(nextKey: RankingSortKey) {
    setSortDirection((current) => sortKey === nextKey ? (current === "asc" ? "desc" : "asc") : nextKey === "rank" || nextKey === "athlete" || nextKey === "position" ? "asc" : "desc");
    setSortKey(nextKey);
    setPage(1);
  }

  return (
    <PublicPageShell className="pb-12 pt-24">
      <PageBand
        eyebrow="Player Rankings"
        title={`${ageGroup} National Board`}
        action={
          <SegmentedControl
            dark
            options={genders.map((item) => ({ value: item, label: item }))}
            value={gender}
            onChange={(item) => {
              setGender(item);
              setMinIndex(defaultMinIndex(item, ageGroup));
              setRegion("All");
              setPosition("All");
              setQuery("");
              resetBoard();
            }}
          />
        }
      />

      <FilterToolbar
        action={
          <button type="button" onClick={clearFilters} className="text-xs font-bold text-court-500 hover:text-hardwood-600">
            Clear filters
          </button>
        }
      >
        <div className="flex flex-wrap gap-2">
          {ageGroups.map((group) => (
            <AgeGroupPill
              key={group}
              group={group}
              active={ageGroup === group}
              onClick={() => {
                setAgeGroup(group);
                setMinIndex(defaultMinIndex(gender, group));
                setRegion("All");
                setPosition("All");
                resetBoard();
              }}
            />
          ))}
        </div>
        <FilterToolbarRow>
          <FilterToolbarField label="Search" className="min-w-[14rem] flex-[1.4]">
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                resetBoard();
              }}
              className={controlClass}
              placeholder="Name, team, hometown"
            />
          </FilterToolbarField>
          <FilterToolbarField label="Position">
            <select
              value={position}
              onChange={(event) => {
                setPosition(event.target.value);
                resetBoard();
              }}
              className={controlClass}
            >
              <option>All</option>
              {positionOptions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </FilterToolbarField>
          <FilterToolbarField label="Region">
            <select
              value={region}
              onChange={(event) => {
                setRegion(event.target.value);
                resetBoard();
              }}
              className={controlClass}
            >
              <option>All</option>
              {regionOptions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </FilterToolbarField>
          <FilterToolbarField label={minimumGames === 100 ? "Min. 100+ games" : `Min. ${minimumGames} games`} className="min-w-[12rem]">
            <input
              type="range"
              min={0}
              max={minGameOptions.length - 1}
              step={1}
              value={selectedMinIndex}
              onChange={(event) => {
                setMinIndex(Number(event.target.value));
                resetBoard();
              }}
              className="h-12 w-full accent-hardwood-600"
            />
          </FilterToolbarField>
        </FilterToolbarRow>
      </FilterToolbar>

      <section className="container-px mt-4">
        <div className="mx-auto max-w-[74rem]">
          <RankingsCoverageNotice />
        </div>
      </section>

      <section className="container-px mt-6">
        <PaginationBar
          className="mx-auto mb-3 max-w-[74rem]"
          pageStart={pageStart}
          pageEnd={pageEnd}
          total={visibleRows.length}
          page={currentPage}
          pageCount={pageCount}
          onChange={setPage}
          labelSuffix={`${ageGroup} ${gender}`}
        />

        {visibleRows.length > 0 && visibleRows.length < 25 ? (
          <p className="mx-auto mb-3 max-w-[74rem] text-sm font-semibold text-court-600">
            {publicRankingsCoverageCopy.sparseBoard(ageGroup, gender, visibleRows.length)}
          </p>
        ) : null}

        {pagedRows.length ? (
          <div className="mx-auto max-w-[74rem]">
            <RankingTable
              rows={pagedRows}
              rankByPlayerId={boardRankByPlayerId}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={updateSort}
            />
          </div>
        ) : (
          <div className="mx-auto max-w-[74rem]">
            <EmptyState icon="players" title="No players ranked yet" />
          </div>
        )}
      </section>
    </PublicPageShell>
  );
}
