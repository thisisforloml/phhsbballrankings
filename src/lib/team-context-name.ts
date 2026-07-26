import type { AgeGroup, PlayerGender } from "@prisma/client";

const AGE_LABELS = new Set(["U13", "U15", "U16", "U17", "U18", "U19"]);

export function extractCompetitionAgeLabel(value: string) {
  const normalized = value.toUpperCase();
  const match = normalized.match(/\bU\s*(1[3-9])\b/) ?? normalized.match(/\b(1[3-9])\s*U\b/);
  const label = match ? "U" + match[1] : null;
  return label && AGE_LABELS.has(label) ? label : null;
}

export function inferCompetitionAgeLabel(leagueName: string, fallback: AgeGroup | string) {
  return extractCompetitionAgeLabel(leagueName) ?? String(fallback).toUpperCase();
}

export function buildContextualTeamName(
  baseName: string,
  ageLabel: string,
  gender: PlayerGender | "BOYS" | "GIRLS" | string,
) {
  const normalizedAge = ageLabel.trim().toUpperCase();
  if (!AGE_LABELS.has(normalizedAge)) {
    throw new Error("Team age group must be U13, U15, U16, U17, U18, or U19.");
  }

  const normalizedGender = String(gender).trim().toUpperCase();
  if (normalizedGender !== "BOYS" && normalizedGender !== "GIRLS") {
    throw new Error("Team gender must be Boys or Girls.");
  }

  const cleanBase = baseName
    .trim()
    .replace(/\s+(?:U\s*)?1[3-9](?:\s*(?:Boys|Girls))?\s*$/i, "")
    .replace(/\s+(?:Boys|Girls)\s*$/i, "")
    .trim();

  if (!cleanBase) throw new Error("Team name is required.");
  return cleanBase + " " + normalizedAge + " " + (normalizedGender === "GIRLS" ? "Girls" : "Boys");
}
