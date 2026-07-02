import type { ReadonlyURLSearchParams } from "next/navigation";

import type { RankingAgeGroup, RankingGender } from "@/lib/rankings";

export const boysMinGameStops = Array.from({ length: 19 }, (_, index) => 10 + index * 5);
export const girlsMinGameStops = Array.from({ length: 20 }, (_, index) => 5 + index * 5);

export type RankingSortKey = "rank" | "athlete" | "height" | "position" | "rating";
export type SortDirection = "asc" | "desc";

export type RankingsUrlState = {
  gender: RankingGender;
  ageGroup: RankingAgeGroup;
  minIndex: number;
  sortKey: RankingSortKey;
  sortDirection: SortDirection;
  page: number;
};

const sortKeys: RankingSortKey[] = ["rank", "athlete", "height", "position", "rating"];

export function normalizedAge(value: string | null): RankingAgeGroup {
  const upper = value?.toUpperCase();
  return upper === "U13" || upper === "U16" || upper === "U19" ? upper : "U19";
}

export function normalizedGender(value: string | null): RankingGender {
  return value?.toLowerCase() === "girls" ? "Girls" : "Boys";
}

export function eligibilityMinimum(gender: RankingGender, _ageGroup: RankingAgeGroup) {
  return gender === "Girls" ? 5 : 10;
}

export function minGameStopsForGender(gender: RankingGender) {
  return gender === "Girls" ? girlsMinGameStops : boysMinGameStops;
}

export function defaultMinIndex(gender: RankingGender, ageGroup: RankingAgeGroup) {
  const minimum = eligibilityMinimum(gender, ageGroup);
  const index = minGameStopsForGender(gender).findIndex((stop) => stop >= minimum);
  return index >= 0 ? index : 0;
}

function parseSortKey(value: string | null): RankingSortKey {
  return sortKeys.includes(value as RankingSortKey) ? (value as RankingSortKey) : "rank";
}

function parseSortDirection(value: string | null): SortDirection {
  return value === "desc" ? "desc" : "asc";
}

function parsePage(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

function parseMinIndex(gender: RankingGender, ageGroup: RankingAgeGroup, minGamesParam: string | null) {
  const stops = minGameStopsForGender(gender);
  const fallback = defaultMinIndex(gender, ageGroup);
  if (!minGamesParam) return fallback;

  const parsed = Number(minGamesParam);
  if (!Number.isFinite(parsed)) return fallback;

  const exactIndex = stops.findIndex((stop) => stop === parsed);
  if (exactIndex >= 0) return exactIndex;

  const nextIndex = stops.findIndex((stop) => stop >= parsed);
  return nextIndex >= 0 ? nextIndex : fallback;
}

export function parseRankingsUrlState(searchParams: Pick<ReadonlyURLSearchParams, "get">): RankingsUrlState {
  const gender = normalizedGender(searchParams.get("gender"));
  const ageGroup = normalizedAge(searchParams.get("age"));

  return {
    gender,
    ageGroup,
    minIndex: parseMinIndex(gender, ageGroup, searchParams.get("minGames")),
    sortKey: parseSortKey(searchParams.get("sort")),
    sortDirection: parseSortDirection(searchParams.get("dir")),
    page: parsePage(searchParams.get("page"))
  };
}

export function minimumGamesForState(gender: RankingGender, ageGroup: RankingAgeGroup, minIndex: number) {
  const stops = minGameStopsForGender(gender);
  const selectedIndex = Math.min(Math.max(minIndex, 0), stops.length - 1);
  return Math.max(stops[selectedIndex], eligibilityMinimum(gender, ageGroup));
}

export function buildRankingsSearchParams(state: RankingsUrlState) {
  const params = new URLSearchParams();
  const defaultMinGames = eligibilityMinimum(state.gender, state.ageGroup);
  const minGames = minimumGamesForState(state.gender, state.ageGroup, state.minIndex);

  if (state.gender !== "Boys") params.set("gender", state.gender);
  if (state.ageGroup !== "U19") params.set("age", state.ageGroup);
  if (minGames !== defaultMinGames) params.set("minGames", String(minGames));
  if (state.sortKey !== "rank") params.set("sort", state.sortKey);
  if (state.sortDirection !== "asc") params.set("dir", state.sortDirection);
  if (state.page > 1) params.set("page", String(state.page));

  return params;
}

export function rankingsSearchEqual(left: URLSearchParams, right: URLSearchParams) {
  const leftKeys = Array.from(left.keys()).sort();
  const rightKeys = Array.from(right.keys()).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key, index) => key === rightKeys[index] && left.get(key) === right.get(key));
}
