"use client";

import { useMemo, useState } from "react";
import type { TeamStandingsAgeGroup, TeamStandingsData, TeamStandingsGender } from "@/lib/team-ratings";
import type { NationalTeamRankingsData } from "@/lib/team-ratings/get-national-team-rankings";
import {
  buildNationalBoardRankByProgramId,
  sortNationalBoardRows,
  type NationalSortKey
} from "@/lib/team-ratings/national-board-display";
import { nationalTeamBoardCoverageCopy } from "@/lib/team-ratings/national-board-coverage";
import { EmptyState } from "@/components/ui";
import { AgeGroupPill } from "@/components/public/AgeGroupPill";
import { FilterToolbar, FilterToolbarControlClass, FilterToolbarField, FilterToolbarRow } from "@/components/public/FilterToolbar";
import { PageBand } from "@/components/public/PageBand";
import { SegmentedControl } from "@/components/public/SegmentedControl";
import { TeamStandingTable } from "@/components/public/TeamStandingTable";
import { NationalTeamRankingTable } from "@/components/public/NationalTeamRankingTable";

const ageGroups: TeamStandingsAgeGroup[] = ["U13", "U16", "U19"];
const genders: TeamStandingsGender[] = ["Boys", "Girls"];
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
  const defaultNational = nationalData?.filters.default;
  const [viewMode, setViewMode] = useState<ViewMode>(nationalEnabled ? "national" : "competition");
  const [ageGroup, setAgeGroup] = useState<TeamStandingsAgeGroup>(
    defaultNational?.ageGroup ?? competitionData.filters.default?.ageGroup ?? "U16"
  );
  const [gender, setGender] = useState<TeamStandingsGender>(
    defaultNational
      ? (defaultNational.gender === "GIRLS" ? "Girls" : "Boys")
      : competitionData.filters.default?.gender ?? "Boys"
  );
  const [leagueId, setLeagueId] = useState("All");
  const [region, setRegion] = useState("All");
  const [query, setQuery] = useState("");
  const [minimumGames, setMinimumGames] = useState(1);
  const [sortKey, setSortKey] = useState<TeamSortKey>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [nationalSortKey, setNationalSortKey] = useState<NationalSortKey>("rank");
  const [nationalSortDirection, setNationalSortDirection] = useState<SortDirection>("asc");

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
    return scopeRows
      .filter((team) => leagueId === "All" || team.leagueId === leagueId)
      .filter((team) => region === "All" || team.region === region)
      .filter((team) => !value || searchText(team).includes(value))
      .filter((team) => team.gamesPlayed >= selectedMinimumGames);
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

  function updateScope(nextAgeGroup: TeamStandingsAgeGroup, nextGender = gender) {
    setAgeGroup(nextAgeGroup);
    setGender(nextGender);
    setLeagueId("All");
    setRegion("All");
    setQuery("");
    setMinimumGames(1);
  }

  function clearFilters() {
    setLeagueId("All");
    setRegion("All");
    setQuery("");
    setMinimumGames(1);
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

  const controlClass = FilterToolbarControlClass();
  const isNationalView = nationalEnabled && viewMode === "national";
  const headerTitle = isNationalView ? `${ageGroup} National Team Rankings` : `${ageGroup} Competition Board`;

  return (
    <>
      <PageBand
        eyebrow="Team Rankings"
        title={headerTitle}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {nationalEnabled ? (
              <SegmentedControl
                dark
                options={[
                  { value: "national" as const, label: "National" },
                  { value: "competition" as const, label: "Competition" }
                ]}
                value={viewMode}
                onChange={setViewMode}
              />
            ) : null}
            <SegmentedControl
              dark
              options={genders.map((item) => ({ value: item, label: item }))}
              value={gender}
              onChange={(item) => updateScope(ageGroup, item)}
            />
          </div>
        }
      />

      <FilterToolbar action={<button type="button" onClick={clearFilters} className="text-xs font-bold text-court-500 hover:text-hardwood-600">Clear filters</button>}>
        <div className="flex flex-wrap gap-2">
          {ageGroups.map((group) => (
            <AgeGroupPill key={group} group={group} active={ageGroup === group} onClick={() => updateScope(group)} />
          ))}
        </div>
        <FilterToolbarRow>
          <FilterToolbarField label="Search" className="min-w-[14rem] flex-[1.4]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={controlClass}
              placeholder={isNationalView ? "Program, city, region" : "Team, program, league"}
            />
          </FilterToolbarField>
          {!isNationalView ? (
            <>
              <FilterToolbarField label="League">
                <select value={leagueId} onChange={(event) => setLeagueId(event.target.value)} className={controlClass}>
                  <option value="All">All</option>
                  {leagueOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </FilterToolbarField>
              <FilterToolbarField label="Region">
                <select value={region} onChange={(event) => setRegion(event.target.value)} className={controlClass}>
                  <option>All</option>
                  {regionOptions.map((item) => <option key={item}>{item}</option>)}
                </select>
              </FilterToolbarField>
              <FilterToolbarField label={`Min. ${selectedMinimumGames} game${selectedMinimumGames === 1 ? "" : "s"} played`} className="min-w-[12rem]">
                <input type="range" min={1} max={maxGamesPlayed} step={1} value={selectedMinimumGames} onChange={(event) => setMinimumGames(Number(event.target.value))} className="h-12 w-full accent-hardwood-600" />
              </FilterToolbarField>
            </>
          ) : null}
        </FilterToolbarRow>
      </FilterToolbar>

      <section id="team-profiles" className="container-px mt-6">
        <div className="mx-auto mb-3 max-w-[74rem] border border-line-500 bg-white px-3 py-2">
          <p className="text-xs font-bold text-court-500">
            {isNationalView
              ? `Showing ${sortedNational.length} programs | ${ageGroup} ${gender} | TPI-v1 national board`
              : `Showing ${visibleCompetitionRows.length} teams | ${ageGroup} ${gender} | Min. ${selectedMinimumGames} game${selectedMinimumGames === 1 ? "" : "s"} played`}
          </p>
          {isNationalView && nationalData?.meta.lastComputedAt ? (
            <p className="mt-1 text-[0.65rem] font-semibold text-court-400">
              Last computed {new Date(nationalData.meta.lastComputedAt).toLocaleString("en-PH")}
            </p>
          ) : null}
        </div>

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
      </section>
    </>
  );
}
