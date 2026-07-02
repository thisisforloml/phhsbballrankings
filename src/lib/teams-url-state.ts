import type { ReadonlyURLSearchParams } from "next/navigation";

import type { RankingAgeGroup, RankingGender } from "@/lib/rankings";
import { normalizedAge, normalizedGender } from "@/lib/rankings-url-state";

export type TeamsUrlState = {
  gender: RankingGender;
  ageGroup: RankingAgeGroup;
};

export function parseTeamsUrlState(searchParams: Pick<ReadonlyURLSearchParams, "get">): TeamsUrlState {
  return {
    gender: normalizedGender(searchParams.get("gender")),
    ageGroup: normalizedAge(searchParams.get("age")),
  };
}

export function buildTeamsSearchParams(state: TeamsUrlState) {
  const params = new URLSearchParams();
  if (state.gender !== "Boys") params.set("gender", state.gender);
  if (state.ageGroup !== "U19") params.set("age", state.ageGroup);
  return params;
}
