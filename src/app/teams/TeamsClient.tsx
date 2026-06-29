"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { TeamStandingsAgeGroup, TeamStandingsData, TeamStandingsGender } from "@/lib/team-ratings";
import type { NationalTeamRankingsData } from "@/lib/team-ratings/get-national-team-rankings";
import {
  buildNationalBoardRankByProgramId,
  sortNationalBoardRows,
  type NationalSortKey
} from "@/lib/team-ratings/national-board-display";
import { nationalTeamBoardCoverageCopy } from "@/lib/team-ratings/national-board-coverage";
import { buildTeamsSearchParams, parseTeamsUrlState } from "@/lib/teams-url-state";
import { mergeCompetitionBoardRows } from "@/lib/team-rankings-types";
import { PaginationSummary } from "@/components/public/PaginationBar";
import { EmptyState } from "@/components/ui";
import { TeamsToolbar } from "@/components/public/TeamsToolbar";
import { TeamStandingTable } from "@/components/public/TeamStandingTable";
import { NationalTeamRankingTable } from "@/components/public/NationalTeamRankingTable";
import type { PublicCoverageAgeGroup } from "@/lib/public-rankings-coverage";

type TeamSortKey = "rank" | "team" | "record" | "winPercentage" | "pointsFor" | "pointsAgainst" | "pointDifferential" | "league";
type SortDirection = "asc" | "desc";
type ViewMode = "national" | "competition";

function searchText(team: TeamStandingsData["rows"][number]) {
  return [team.displayName, team.internalTeamName, team.leagueName, team.seasonName, team.city, team.region]
    .join(" ")
    .toLowerCase();
}

function sortVisibleStandings(left: TeamStandingsData["rows"][number], right: TeamStandingsData["rows"][number]) {
  return right.wins - left.wins
    || right.winPercentage - left.winPercentage
    || right.pointDifferential - left.pointDifferential
    || right.pointsFor - left.pointsFor
    || left.displayName.localeCompare(right.displayName);
}

export function TeamsClient({
  competitionData,
  nationalData = null,
  nationalEnabled = false
}: {
  competitionData: TeamStandingsData;
  nationalData?: NationalTeamRankingsData | null;
  nationalEnabled?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlState = useMemo(() => parseTeamsUrlState(searchParams), [searchParams]);

  const defaultNational = nationalData?.filters.default;
  const [viewMode, setViewMode] = useState<ViewMode>(nationalEnabled ? "national" : "competition");
  const [ageGroup, setAgeGroup] = useState<TeamStandingsAgeGroup>(
    urlState.ageGroup ?? defaultNational?.ageGroup ?? competitionData.filters.default?.ageGroup ?? "U16"
  );
  const [gender, setGender] = useState<TeamStandingsGender>(
    (urlState.gender as TeamStandingsGender) ??
      (defaultNational
        ? (defaultNational.gender === "GIRLS" ? "Girls" : "Boys")
        : competitionData.filters.default?.gender ?? "Boys")
  );
  const [leagueId, setLeagueId] = useState("All");
  const [region, setRegion] = useState("All");
  const [query, setQuery] = useState("");
  const [minimumGames, setMinimumGames] = useState(1);
  const [sortKey, setSortKey] = useState<TeamSortKey>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [nationalSortKey, setNationalSortKey] = useState<NationalSortKey>("rank");
  const [nationalSortDirection, setNationalSortDirection] = useState<SortDirection>("asc");

  useEffect(() => {
    setAgeGroup(urlState.ageGroup);
    setGender(urlState.gender as TeamStandingsGender);
  }, [urlState.ageGroup, urlState.gender]);

  const navigateTeams = useCallback(
    (next: { gender?: TeamStandingsGender; ageGroup?: TeamStandingsAgeGroup }) => {
      const params = buildTeamsSearchParams({
        gender: next.gender ?? gender,
        ageGroup: next.ageGroup ?? ageGroup,
      });
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [ageGroup, gender, pathname, router]
  );

  const playerGender = gender === "Girls" ? "GIRLS" : "BOYS";

  const nationalScopeRows = useMemo(() => {
    if (!nationalData) return [];
    return nationalData.rows
      .filter((row) => row.ageGroup === ageGroup)
      .filter((row) => row.gender === playerGender);
  }, [ageGroup, gender, nationalData, playerGender]);

  const scopeRows = useMemo(() => competitionData.rows
    .filter((team) => team.ageGroup === ageGroup)
    .filter((team) => team.gender === gender), [ageGroup, competitionData.rows, gender]);

  const leagueOptions = useMemo(() => competitionData.filters.leagues
    .filter((league) => competitionData.rows.some((team) => team.leagueId === league.id && team.ageGroup === ageGroup && team.gender === gender))
    .sort((left, right) => left.name.localeCompare(right.name)), [ageGroup, competitionData.filters.leagues, competitionData.rows, gender]);

  const regionOptions = useMemo(() => Array.from(new Set(scopeRows.map((team) => team.region))).sort(), [scopeRows]);

  const maxGamesPlayed = Math.max(1, ...scopeRows
    .filter((team) => leagueId === "All" || team.leagueId === leagueId)
    .filter((team) => region === "All" || team.region === region)
    .map((team) => team.gamesPlayed));
  const selectedMinimumGames = Math.min(minimumGames, maxGamesPlayed);

  const filteredCompetition = useMemo(() => {
    const value = query.trim().toLowerCase();
    const scoped = scopeRows
      .filter((team) => leagueId === "All" || team.leagueId === leagueId)
      .filter((team) => region === "All" || team.region === region)
      .filter((team) => !value || searchText(team).includes(value))
      .filter((team) => team.gamesPlayed >= selectedMinimumGames);
    return mergeCompetitionBoardRows(scoped);
  }, [leagueId, query, region, scopeRows, selectedMinimumGames]);

  const sortedCompetition = useMemo(() => {
    const ranked = filteredCompetition.map((team, index) => ({ team, baseRank: index + 1 })).sort((left, right) => sortVisibleStandings(left.team, right.team)).map(({ team }, index) => ({ ...team, baseRank: index + 1 }));
    const direction = sortDirection === "asc" ? 1 : -1;
    return ranked.sort((left, right) => {
      if (sortKey === "rank") return (left.baseRank - right.baseRank) * direction;
      if (sortKey === "team") return left.displayName.localeCompare(right.displayName) * direction || left.baseRank - right.baseRank;
      if (sortKey === "record") return ((left.wins - left.losses) - (right.wins - right.losses)) * direction || left.baseRank - right.baseRank;
      if (sortKey === "winPercentage") return (left.winPercentage - right.winPercentage) * direction || left.baseRank - right.baseRank;
      if (sortKey === "pointsFor") return (left.pointsFor - right.pointsFor) * direction || left.baseRank - right.baseRank;
      if (sortKey === "pointsAgainst") return (left.pointsAgainst - right.pointsAgainst) * direction || left.baseRank - right.baseRank;
      if (sortKey === "pointDifferential") return (left.pointDifferential - right.pointDifferential) * direction || left.baseRank - right.baseRank;
      return left.leagueName.localeCompare(right.leagueName) * direction || left.baseRank - right.baseRank;
    });
  }, [filteredCompetition, sortDirection, sortKey]);

  const boardRankByProgramId = useMemo(
    () => buildNationalBoardRankByProgramId(nationalScopeRows),
    [nationalScopeRows]
  );

  const filteredNational = useMemo(() => {
    const value = query.trim().toLowerCase();
    return nationalScopeRows.filter((row) => {
      if (!value) return true;
      return [row.programName, row.programAbbreviation, row.city, row.region].filter(Boolean).join(" ").toLowerCase().includes(value);
    });
  }, [nationalScopeRows, query]);

  const sortedNational = useMemo(
    () => sortNationalBoardRows(filteredNational, boardRankByProgramId, nationalSortKey, nationalSortDirection),
    [boardRankByProgramId, filteredNational, nationalSortDirection, nationalSortKey]
  );

  const visibleCompetitionRows = useMemo(() => sortedCompetition.map((team) => ({ ...team, visibleRank: team.baseRank })), [sortedCompetition]);

  function resetLocalFilters() {
    setLeagueId("All");
    setRegion("All");
    setQuery("");
    setMinimumGames(1);
  }

  function switchAgeGroup(group: PublicCoverageAgeGroup) {
    setAgeGroup(group);
    resetLocalFilters();
    navigateTeams({ ageGroup: group });
  }

  function switchGender(nextGender: TeamStandingsGender) {
    setGender(nextGender);
    resetLocalFilters();
    navigateTeams({ gender: nextGender });
  }

  function clearFilters() {
    resetLocalFilters();
  }

  function updateSort(nextKey: TeamSortKey) {
    setSortDirection((current) => sortKey === nextKey ? (current === "asc" ? "desc" : "asc") : nextKey === "rank" || nextKey === "team" || nextKey === "league" ? "asc" : "desc");
    setSortKey(nextKey);
  }

  function updateNationalSort(nextKey: NationalSortKey) {
    setNationalSortDirection((current) => nationalSortKey === nextKey ? (current === "asc" ? "desc" : "asc") : nextKey === "rank" || nextKey === "program" ? "asc" : "desc");
    setNationalSortKey(nextKey);
  }

  const nationalBoardHasData = nationalScopeRows.length > 0;
  const nationalBoardIsSparse = nationalBoardHasData && nationalScopeRows.length <= 2;
  const nationalSearchEmpty = nationalBoardHasData && sortedNational.length === 0 && query.trim().length > 0;
  const nationalEmptyCopy = nationalSearchEmpty
    ? { title: "No programs match your search", description: "Clear search or switch filters to see national rankings for this board." }
    : nationalTeamBoardCoverageCopy.emptyBoard(ageGroup, gender);

  const isNationalView = nationalEnabled && viewMode === "national";
  const filtersActive = Boolean(query.trim() || leagueId !== "All" || region !== "All" || selectedMinimumGames > 1);
  const lastUpdated = isNationalView
    ? nationalData?.meta.lastComputedAt ?? competitionData.lastUpdated
    : competitionData.lastUpdated;

  return (
    <>
      <TeamsToolbar
        ageGroup={ageGroup}
        gender={gender}
        query={query}
        viewMode={viewMode}
        nationalEnabled={nationalEnabled}
        leagueId={leagueId}
        region={region}
        leagueOptions={leagueOptions}
        regionOptions={regionOptions}
        minimumGames={selectedMinimumGames}
        maxGamesPlayed={maxGamesPlayed}
        showCompetitionFilters={!isNationalView}
        filtersActive={filtersActive}
        onAgeGroupChange={switchAgeGroup}
        onGenderChange={switchGender}
        onQueryChange={setQuery}
        onViewModeChange={setViewMode}
        onLeagueChange={setLeagueId}
        onRegionChange={setRegion}
        onMinimumGamesChange={setMinimumGames}
        onClear={clearFilters}
        lastUpdated={lastUpdated}
      />

      <section className="container-px mt-2 pb-4">
        <div className="mx-auto max-w-[74rem]">
          {isNationalView ? (
            sortedNational.length > 0 ? (
              <PaginationSummary
                className="mb-3"
                pageStart={1}
                pageEnd={sortedNational.length}
                total={sortedNational.length}
                unit="programs"
                labelSuffix={`${ageGroup} ${gender} | TPI-v1 national board`}
              />
            ) : null
          ) : visibleCompetitionRows.length > 0 ? (
            <PaginationSummary
              className="mb-3"
              pageStart={1}
              pageEnd={visibleCompetitionRows.length}
              total={visibleCompetitionRows.length}
              unit="teams"
              labelSuffix={`${ageGroup} ${gender} | Min. ${selectedMinimumGames} game${selectedMinimumGames === 1 ? "" : "s"} played`}
            />
          ) : null}

          <div className="overflow-hidden rounded-sm border border-line-500 bg-white shadow-panel">
          {isNationalView ? (
            sortedNational.length ? (
              <>
                {nationalBoardIsSparse ? (
                  <p className="mb-3 border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                    {nationalTeamBoardCoverageCopy.sparseBoard(sortedNational.length, ageGroup, gender)}
                  </p>
                ) : null}
                <NationalTeamRankingTable rows={sortedNational} sortKey={nationalSortKey} sortDirection={nationalSortDirection} onSort={updateNationalSort} />
              </>
            ) : (
              <EmptyState icon="teams" title={nationalEmptyCopy.title} description={nationalEmptyCopy.description} />
            )
          ) : visibleCompetitionRows.length ? (
            <TeamStandingTable rows={visibleCompetitionRows} sortKey={sortKey} sortDirection={sortDirection} onSort={updateSort} />
          ) : (
            <EmptyState icon="teams" title="No official team rankings yet" />
          )}
        </div>
        </div>
      </section>
    </>
  );
}
