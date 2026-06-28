import { AgeGroup, PlayerGender } from "@prisma/client";
import { slugify } from "@/lib/format";
import { buildEligibilityInput, evaluateEligibility } from "@/lib/eligibility";
import { getCurrentRankingAgeBracket, getEffectiveClassYear } from "@/lib/ranking-eligibility";
import { resolvePrimaryRankingAffiliation } from "@/lib/player-display-affiliation";
import { prisma } from "@/lib/prisma";
import type { NationalRankingRow, NationalRankingSnapshot, RankingAgeGroup } from "@/lib/rankings";
import { computeShadowBoard } from "@/lib/ratings/formula-vnext";
import { resolveShadowFormulaParams } from "@/lib/ratings/formula-vnext/resolve-params";
import { FORMULA_VNEXT_POLICY_ID } from "@/lib/ratings/formula-vnext/types";

function toDisplayGender(gender: PlayerGender): "Boys" | "Girls" {
  return gender === PlayerGender.GIRLS ? "Girls" : "Boys";
}

function calculateAge(birthDate: Date | null) {
  if (!birthDate) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birthDate.getUTCDate())) age -= 1;
  return age;
}

export async function buildShadowNationalSnapshot(
  gender: PlayerGender,
  ageGroup: RankingAgeGroup,
  formulaVersionId: string | null
): Promise<NationalRankingSnapshot> {
  const asOfDate = new Date();
  const params = resolveShadowFormulaParams();
  const shadow = await computeShadowBoard({
    ageGroup: ageGroup as AgeGroup,
    gender,
    asOfDate,
    params
  });

  if (!shadow.rows.length) {
    return {
      snapshotId: null,
      gender: toDisplayGender(gender),
      ageGroup,
      weekOf: null,
      formulaVersionId,
      totalRows: 0,
      rows: []
    };
  }

  const players = await prisma.player.findMany({
    where: { id: { in: shadow.rows.map((row) => row.playerId) }, deletedAt: null },
    select: {
      id: true,
      displayName: true,
      city: true,
      region: true,
      position: true,
      heightCm: true,
      birthDate: true,
      firstRankingEligibilityAt: true,
      classYearOverride: true,
      photoUrl: true,
      gender: true,
      schoolOverride: true,
      ageGroupOverride: true,
      currentProgram: { select: { fullName: true, abbreviation: true, type: true } },
      gameStats: {
        where: { deletedAt: null },
        include: {
          team: { include: { program: { select: { fullName: true, abbreviation: true, type: true } } } },
          game: { select: { gameDate: true } }
        },
        orderBy: { game: { gameDate: "desc" } },
        take: 40
      }
    }
  });
  const playerMap = new Map(players.map((player) => [player.id, player]));

  const rows: NationalRankingRow[] = shadow.rows.map((shadowRow, index) => {
    const player = playerMap.get(shadowRow.playerId);
    const birthDate = player?.birthDate ?? null;
    const eligibilityVerdict = evaluateEligibility(
      buildEligibilityInput({
        playerId: shadowRow.playerId,
        gender: shadowRow.gender,
        birthDate,
        firstRankingEligibilityAt: player?.firstRankingEligibilityAt ?? null,
        classYearOverride: player?.classYearOverride,
        ageGroupOverride: player?.ageGroupOverride,
        ratingAgeGroup: ageGroup,
        verifiedGameCount: shadowRow.verifiedGameCount,
        evaluatedBoard: ageGroup,
        formulaVersionId,
        evaluationDate: asOfDate
      })
    );
    const effectiveClassYear = getEffectiveClassYear(birthDate, player?.classYearOverride);

    return {
      rank: index + 1,
      playerId: shadowRow.playerId,
      displayName: shadowRow.displayName,
      slug: slugify(shadowRow.displayName),
      city: player?.city ?? "",
      region: player?.region ?? "",
      position: player?.position ?? null,
      heightCm: player?.heightCm ?? null,
      birthYear: birthDate ? birthDate.getUTCFullYear() : null,
      age: calculateAge(birthDate),
      currentTeam: resolvePrimaryRankingAffiliation({
        schoolOverride: player?.schoolOverride,
        currentProgram: player?.currentProgram,
        gameStats: player?.gameStats
      }),
      photoUrl: player?.photoUrl ?? null,
      gender: toDisplayGender(shadowRow.gender),
      ageGroup,
      computedAgeBracket: getCurrentRankingAgeBracket(birthDate, asOfDate, player?.classYearOverride, ageGroup),
      effectiveClassYear,
      classYearLabel: effectiveClassYear ? `Class of ${effectiveClassYear}` : null,
      eligibilityVerdict,
      rating: shadowRow.adjustedRating,
      starRating: shadowRow.starRating,
      verifiedGameCount: shadowRow.verifiedGameCount,
      primaryCompetition: null
    };
  });

  return {
    snapshotId: null,
    gender: toDisplayGender(gender),
    ageGroup,
    weekOf: asOfDate.toISOString(),
    formulaVersionId,
    totalRows: rows.length,
    rows
  };
}

export function shadowPolicyVersionId(): string {
  return FORMULA_VNEXT_POLICY_ID;
}
