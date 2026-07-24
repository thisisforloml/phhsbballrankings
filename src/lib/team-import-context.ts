import { AgeGroup, PlayerGender } from "@prisma/client";

const AGE_CONTEXT_PATTERN = /\b(?:U(?:NDER)?[\s-]?(\d{2})|(\d{2})[\s-]?U)\b/i;

export function inferTeamAgeGroupFromName(value: string): AgeGroup | null {
  const match = value.match(AGE_CONTEXT_PATTERN);
  const age = Number(match?.[1] ?? match?.[2]);
  if (!Number.isFinite(age)) return null;
  if (age <= 13) return AgeGroup.U13;
  if (age <= 16) return AgeGroup.U16;
  if (age <= 19) return AgeGroup.U19;
  return null;
}

export function inferTeamGenderFromName(value: string): PlayerGender | null {
  if (/\b(?:GIRLS?|WOMEN|LADY|TIGRESS(?:ES)?)\b/i.test(value)) return PlayerGender.GIRLS;
  if (/\b(?:BOYS?|MEN)\b/i.test(value)) return PlayerGender.BOYS;
  return null;
}

export function teamNameHasCompetitionContext(value: string) {
  return inferTeamAgeGroupFromName(value) !== null || inferTeamGenderFromName(value) !== null;
}

export function teamNameMatchesCompetitionContext(
  value: string,
  ageGroup: AgeGroup,
  gender: PlayerGender,
) {
  const namedAgeGroup = inferTeamAgeGroupFromName(value);
  const namedGender = inferTeamGenderFromName(value);
  return (!namedAgeGroup || namedAgeGroup === ageGroup) && (!namedGender || namedGender === gender);
}