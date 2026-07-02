import { AgeGroup } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getAgeBracketAsOfMarch31 } from "@/lib/ranking-eligibility";

export type AutoRosterMatch = {
  teamId: string;
  seasonId: string;
  teamName: string;
  seasonName: string;
};

export type AutoRosterResult =
  | { ok: true; match: AutoRosterMatch }
  | { ok: false; reason: "NO_AGE_BRACKET" | "NO_TEAMS" | "NO_SEASON" | "AMBIGUOUS"; candidates?: AutoRosterMatch[] };

const AGE_BRACKET_PATTERNS: Record<"U13" | "U16" | "U19", RegExp[]> = {
  U13: [/\bu13\b/i, /\b13u\b/i, /\b15u\b/i, /\b14u\b/i, /\b12u\b/i],
  U16: [/\bu16\b/i, /\b16u\b/i, /\b15u\b/i, /\b14u\b/i],
  U19: [/\bu19\b/i, /\b19u\b/i, /\b18u\b/i, /\b17u\b/i, /\bhs\b/i, /\bhigh school\b/i]
};

function resolvePlayerBracket(birthDate: Date | null, ageGroupOverride: string | null): "U13" | "U16" | "U19" | null {
  if (ageGroupOverride === "U13" || ageGroupOverride === "U16" || ageGroupOverride === "U19") {
    return ageGroupOverride;
  }
  const bracket = getAgeBracketAsOfMarch31(birthDate);
  if (bracket === "U13" || bracket === "U16" || bracket === "U19") return bracket;
  return null;
}

function teamMatchesBracket(teamName: string, bracket: "U13" | "U16" | "U19") {
  return AGE_BRACKET_PATTERNS[bracket].some((pattern) => pattern.test(teamName));
}

export async function resolveAutoRosterAssignment(input: {
  playerId: string;
  programId: string;
}): Promise<AutoRosterResult> {
  const player = await prisma.player.findFirst({
    where: { id: input.playerId, deletedAt: null },
    select: { birthDate: true, ageGroupOverride: true }
  });
  if (!player) return { ok: false, reason: "NO_AGE_BRACKET" };

  const bracket = resolvePlayerBracket(player.birthDate, player.ageGroupOverride);
  if (!bracket) return { ok: false, reason: "NO_AGE_BRACKET" };

  const teams = await prisma.team.findMany({
    where: { programId: input.programId, deletedAt: null },
    select: { id: true, name: true }
  });
  if (!teams.length) return { ok: false, reason: "NO_TEAMS" };

  const matchingTeams = teams.filter((team) => teamMatchesBracket(team.name, bracket));
  if (!matchingTeams.length) return { ok: false, reason: "NO_TEAMS" };

  const candidates: AutoRosterMatch[] = [];
  for (const team of matchingTeams) {
    const season = await prisma.season.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { games: { some: { deletedAt: null, OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }] } } },
          { rosterSeasons: { some: { teamId: team.id, deletedAt: null } } }
        ]
      },
      orderBy: { seasonYear: "desc" },
      select: { id: true, name: true }
    });
    if (!season) continue;
    candidates.push({ teamId: team.id, seasonId: season.id, teamName: team.name, seasonName: season.name });
  }

  if (!candidates.length) return { ok: false, reason: "NO_SEASON" };
  if (candidates.length > 1) return { ok: false, reason: "AMBIGUOUS", candidates };
  return { ok: true, match: candidates[0] };
}

export function ageGroupToBracket(ageGroup: AgeGroup): "U13" | "U16" | "U19" {
  return ageGroup;
}
