"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { FilterToolbar, FilterToolbarControlClass, FilterToolbarField, FilterToolbarRow } from "@/components/public/FilterToolbar";
import { PaginationToolbar } from "@/components/public/PaginationBar";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { RankingsToolbar } from "@/components/public/RankingsToolbar";
import { RankingTable } from "@/components/public/RankingTable";
import { EmptyState } from "@/components/ui";
import { getPublicBoardRows } from "@/lib/public-board-ranks";
import type { PublicCoverageAgeGroup } from "@/lib/public-rankings-coverage";
import { publicRankingsCoverageCopy, RECRUITING_CLASS_FILTER_ENABLED } from "@/lib/public-rankings-coverage";
import type { LatestNationalRankings, NationalRankingRow } from "@/lib/rankings";
import {
  buildRankingsSearchParams,
  defaultMinIndex,
  minGameStopsForGender,
  minimumGamesForState,
  parseRankingsUrlState,
  type RankingSortKey,
  type RankingsUrlState,
  type SortDirection
} from "@/lib/rankings-url-state";
import {
  applyClassYearFilter,
  getRecruitingClassYearOptions,
  parseClassYearParam,
  recruitingRankColumnLabel,
  shouldShowRecruitingSortBanner
} from "@/lib/recruiting-class-filter";

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

function hasActiveFilters(
  query: string,
  position: string,
  region: string,
  minIndex: number,
  gender: "Boys" | "Girls",
  ageGroup: PublicCoverageAgeGroup,
  classYear: number | "all"
) {
  return Boolean(
    query.trim() ||
      position !== "All" ||
      region !== "All" ||
      minIndex !== defaultMinIndex(gender, ageGroup) ||
      classYear !== "all"
  );
}

function buildRankingsUrl(
  pathname: string,
  state: RankingsUrlState,
  classYear: number | "all"
) {
  const params = buildRankingsSearchParams(state);
  if (RECRUITING_CLASS_FILTER_ENABLED && state.ageGroup === "U19" && classYear !== "all") {
    params.set("classYear", String(classYear));
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function RankingsClient({
  rankings,
  lastUpdated,
}: {
  rankings: LatestNationalRankings;
  lastUpdated?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlState = useMemo(() => parseRankingsUrlState(searchParams), [searchParams]);
  const { gender, ageGroup, minIndex, page, sortKey, sortDirection } = urlState;
  const classYear = useMemo(
    () => parseClassYearParam(searchParams.get("classYear") ?? searchParams.get("class")),
    [searchParams]
  );

  const [region, setRegion] = useState("All");
  const [position, setPosition] = useState("All");
  const [query, setQuery] = useState("");
  const [includeUnknownClass, setIncludeUnknownClass] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [previewMinIndex, setPreviewMinIndex] = useState<number | null>(null);

  const navigateRankings = useCallback(
    (patch: Partial<RankingsUrlState> & { classYear?: number | "all" }) => {
      const nextState: RankingsUrlState = {
        gender: patch.gender ?? urlState.gender,
        ageGroup: patch.ageGroup ?? urlState.ageGroup,
        minIndex: patch.minIndex ?? urlState.minIndex,
        sortKey: patch.sortKey ?? urlState.sortKey,
        sortDirection: patch.sortDirection ?? urlState.sortDirection,
        page: patch.page ?? urlState.page,
      };
      const nextClassYear = patch.classYear ?? classYear;
      const nextUrl = buildRankingsUrl(pathname, nextState, nextClassYear);
      const currentQs = searchParams.toString();
      const currentUrl = currentQs ? `${pathname}?${currentQs}` : pathname;
      if (nextUrl === currentUrl) return;
      router.replace(nextUrl, { scroll: false });
    },
    [classYear, pathname, router, searchParams, urlState]
  );

  useEffect(() => {
    if (!mobileFiltersOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileFiltersOpen]);

  const selectedAgeSnapshots = rankings.snapshotsByAge?.[ageGroup];
  const selectedSnapshot = selectedAgeSnapshots
    ? gender === "Girls"
      ? selectedAgeSnapshots.girls
      : selectedAgeSnapshots.boys
    : gender === "Girls"
      ? rankings.snapshots.girls
      : rankings.snapshots.boys;
  const rowsForAge = selectedSnapshot.rows;
  const publicBoardRows = useMemo(() => getPublicBoardRows(selectedSnapshot), [selectedSnapshot]);
  const boardRankByPlayerId = useMemo(() => {
    return Object.fromEntries(publicBoardRows.map((row, index) => [row.playerId, index + 1]));
  }, [publicBoardRows]);
  const minGameOptions = minGameStopsForGender(gender);
  const activeMinIndex = previewMinIndex ?? minIndex;
  const selectedMinIndex = Math.min(activeMinIndex, minGameOptions.length - 1);
  const minimumGames = minimumGamesForState(gender, ageGroup, selectedMinIndex);

  useEffect(() => {
    setPreviewMinIndex(null);
  }, [minIndex]);

  const regionOptions = useMemo(
    () => Array.from(new Set(rowsForAge.map((row) => row.region))).sort(),
    [rowsForAge]
  );
  const positionOptions = useMemo(
    () =>
      Array.from(new Set(rowsForAge.map((row) => positionLabel(row.position)))).sort((left, right) => {
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
    const rows = publicBoardRows
      .filter((row) => region === "All" || row.region === region)
      .filter((row) => position === "All" || positionLabel(row.position) === position)
      .filter((row) => !value || searchText(row).includes(value))
      .filter((row) => row.verifiedGameCount >= minimumGames);

    if (!RECRUITING_CLASS_FILTER_ENABLED || ageGroup !== "U19" || classYear === "all") {
      return rows;
    }

    return applyClassYearFilter(rows, { classYear, includeUnknownClass });
  }, [ageGroup, classYear, includeUnknownClass, minimumGames, position, publicBoardRows, query, region]);

  const recruitingClassOptions = useMemo(() => {
    if (!RECRUITING_CLASS_FILTER_ENABLED || ageGroup !== "U19") return [];
    const baseRows = publicBoardRows.filter((row) => row.verifiedGameCount >= minimumGames);
    return getRecruitingClassYearOptions(baseRows);
  }, [ageGroup, minimumGames, publicBoardRows]);

  const showRecruitingFilter = RECRUITING_CLASS_FILTER_ENABLED && ageGroup === "U19" && recruitingClassOptions.length > 1;
  const recruitingFilterActive = showRecruitingFilter && classYear !== "all";

  const sortedRows = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;
    const boardRank = (row: NationalRankingRow) => boardRankByPlayerId[row.playerId] ?? row.rank;

    if (sortKey === "rank") {
      const top100 = filteredRows
        .filter((row) => boardRank(row) <= 100)
        .sort((left, right) => (boardRank(left) - boardRank(right)) * direction);
      const banded = filteredRows
        .filter((row) => boardRank(row) > 100)
        .sort((left, right) => left.displayName.localeCompare(right.displayName) * direction);
      return direction === 1 ? [...top100, ...banded] : [...banded, ...top100];
    }

    return filteredRows.slice().sort((left, right) => {
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
  const filtersActive = hasActiveFilters(query, position, region, minIndex, gender, ageGroup, classYear);
  const controlClass = FilterToolbarControlClass();

  useEffect(() => {
    if (page > pageCount) {
      navigateRankings({ page: pageCount });
    }
  }, [navigateRankings, page, pageCount]);

  function resetBoard() {
    navigateRankings({ page: 1 });
  }

  function resetFilterFields() {
    setRegion("All");
    setPosition("All");
    setQuery("");
    setIncludeUnknownClass(false);
  }

  function clearFilters() {
    resetFilterFields();
    navigateRankings({
      minIndex: defaultMinIndex(gender, ageGroup),
      classYear: "all",
      page: 1,
    });
  }

  function updateSort(nextKey: RankingSortKey) {
    const nextDirection: SortDirection =
      sortKey === nextKey
        ? sortDirection === "asc"
          ? "desc"
          : "asc"
        : nextKey === "rank" || nextKey === "athlete" || nextKey === "position"
          ? "asc"
          : "desc";
    navigateRankings({ sortKey: nextKey, sortDirection: nextDirection, page: 1 });
  }

  function switchAgeGroup(group: PublicCoverageAgeGroup) {
    navigateRankings({
      ageGroup: group,
      minIndex: defaultMinIndex(gender, group),
      page: 1,
      classYear: "all",
    });
    setRegion("All");
    setPosition("All");
    setQuery("");
    setIncludeUnknownClass(false);
  }

  function switchGender(nextGender: typeof gender) {
    navigateRankings({
      gender: nextGender,
      minIndex: defaultMinIndex(nextGender, ageGroup),
      page: 1,
      classYear: "all",
    });
    setRegion("All");
    setPosition("All");
    setQuery("");
    setIncludeUnknownClass(false);
  }

  return (
    <PublicPageShell variant="paper" className="pb-12 pt-20">
      <RankingsToolbar
        ageGroup={ageGroup}
        gender={gender}
        query={query}
        position={position}
        region={region}
        positionOptions={positionOptions}
        regionOptions={regionOptions}
        minimumGames={minimumGames}
        minGameOptions={minGameOptions}
        selectedMinIndex={selectedMinIndex}
        recruitingOptions={recruitingClassOptions}
        classYear={classYear}
        includeUnknownClass={includeUnknownClass}
        showRecruiting={showRecruitingFilter}
        filtersActive={filtersActive}
        visibleCount={visibleRows.length}
        lastUpdated={lastUpdated}
        onAgeGroupChange={switchAgeGroup}
        onGenderChange={switchGender}
        onQueryChange={(value) => {
          setQuery(value);
          resetBoard();
        }}
        onPositionChange={(value) => {
          setPosition(value);
          resetBoard();
        }}
        onRegionChange={(value) => {
          setRegion(value);
          resetBoard();
        }}
        onMinIndexPreview={setPreviewMinIndex}
        onMinIndexCommit={(index) => {
          setPreviewMinIndex(null);
          navigateRankings({ minIndex: index, page: 1 });
        }}
        onClassYearChange={(year) => {
          navigateRankings({ classYear: year, page: 1 });
        }}
        onIncludeUnknownChange={(value) => {
          setIncludeUnknownClass(value);
          resetBoard();
        }}
        onClear={clearFilters}
        onMobileFiltersOpen={() => setMobileFiltersOpen(true)}
      />

      {mobileFiltersOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close filters" onClick={() => setMobileFiltersOpen(false)} />
          <aside className="absolute bottom-0 left-0 right-0 max-h-[88vh] overflow-y-auto border-t border-white/10 bg-scout-800 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-scout-50">More filters</h2>
              <button type="button" onClick={() => setMobileFiltersOpen(false)} className="text-sm text-scout-500">
                Done
              </button>
            </div>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <FilterToolbarField label="Age group">
                  <select
                    value={ageGroup}
                    onChange={(event) => switchAgeGroup(event.target.value as PublicCoverageAgeGroup)}
                    className={controlClass}
                  >
                    <option value="U13">U13</option>
                    <option value="U16">U16</option>
                    <option value="U19">U19</option>
                  </select>
                </FilterToolbarField>
                <FilterToolbarField label="Gender">
                  <select
                    value={gender}
                    onChange={(event) => switchGender(event.target.value as "Boys" | "Girls")}
                    className={controlClass}
                  >
                    <option value="Boys">Boys</option>
                    <option value="Girls">Girls</option>
                  </select>
                </FilterToolbarField>
              </div>
              <FilterToolbar>
                <FilterToolbarRow>
                  <FilterToolbarField label="Search" className="min-w-full">
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
                      <option value="All">All</option>
                      {positionOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
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
                      <option value="All">All</option>
                      {regionOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </FilterToolbarField>
                  {showRecruitingFilter ? (
                    <FilterToolbarField label="Graduation class">
                      <select
                        value={classYear === "all" ? "all" : String(classYear)}
                        onChange={(event) => {
                          const value = event.target.value;
                          navigateRankings({ classYear: value === "all" ? "all" : Number(value), page: 1 });
                        }}
                        className={controlClass}
                      >
                        {recruitingClassOptions.map((option) => (
                          <option key={String(option.year)} value={String(option.year)}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </FilterToolbarField>
                  ) : null}
                  <FilterToolbarField label={`Min. games: ${minimumGames}`} className="max-w-[11rem]">
                    <div className="flex h-7 items-center overflow-visible px-0.5 pb-0.5">
                      <input
                        type="range"
                        min={0}
                        max={minGameOptions.length - 1}
                        step={1}
                        value={selectedMinIndex}
                        onChange={(event) => setPreviewMinIndex(Number(event.target.value))}
                        onPointerUp={(event) => {
                          const index = Number(event.currentTarget.value);
                          setPreviewMinIndex(null);
                          navigateRankings({ minIndex: index, page: 1 });
                        }}
                        className="h-2 w-full accent-hardwood-600"
                      />
                    </div>
                  </FilterToolbarField>
                </FilterToolbarRow>
              </FilterToolbar>
              {showRecruitingFilter && classYear !== "all" ? (
                <label className="flex items-center gap-2 text-sm text-scout-500">
                  <input
                    type="checkbox"
                    checked={includeUnknownClass}
                    onChange={(event) => {
                      setIncludeUnknownClass(event.target.checked);
                      resetBoard();
                    }}
                    className="accent-scout-orange"
                  />
                  Include unknown class year
                </label>
              ) : null}
              <div className="flex gap-3">
                <button type="button" onClick={clearFilters} className="flex-1 rounded-sm border border-white/10 py-3 text-sm text-scout-500">
                  Clear
                </button>
                <button type="button" onClick={() => setMobileFiltersOpen(false)} className="flex-1 rounded-sm bg-scout-orange py-3 text-sm text-white">
                  Apply
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      <section className="container-px">
        <div className="mx-auto max-w-[74rem]">
          {recruitingFilterActive && shouldShowRecruitingSortBanner(classYear, sortKey) ? (
            <p className="mb-3 text-xs text-court-500">Sorted by {sortKey}; national board rank numbers are unchanged.</p>
          ) : null}

          {visibleRows.length > 0 && visibleRows.length < 25 ? (
            <p className="mb-3 text-sm text-court-500">{publicRankingsCoverageCopy.sparseBoard(ageGroup, gender, visibleRows.length)}</p>
          ) : null}

          {visibleRows.length > 0 ? (
            <PaginationToolbar
              className="mb-3"
              pageStart={pageStart}
              pageEnd={pageEnd}
              total={visibleRows.length}
              page={currentPage}
              pageCount={pageCount}
              onChange={(nextPage) => navigateRankings({ page: nextPage })}
              labelSuffix={`${ageGroup} ${gender}`}
            />
          ) : null}

          <div className="overflow-hidden rounded-sm border border-line-500 bg-white shadow-panel">
            {pagedRows.length ? (
              <RankingTable
                rows={pagedRows}
                rankByPlayerId={boardRankByPlayerId}
                rankColumnLabel={recruitingFilterActive ? recruitingRankColumnLabel(gender, classYear) : undefined}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={updateSort}
                variant="scout"
                tone="light"
              />
            ) : (
              <div className="p-8">
                <EmptyState icon="players" title="No players ranked yet" />
              </div>
            )}
          </div>

        </div>
      </section>
    </PublicPageShell>
  );
}
