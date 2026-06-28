import { AgeGroup, PlayerGender, RankingScope } from "@prisma/client";
import { slugify } from "./format";
import { resolvePrimaryRankingAffiliation } from "./player-display-affiliation";
import { buildEligibilityInput, evaluateEligibility, type EligibilityVerdict } from "./eligibility";
import { getCurrentRankingAgeBracket, getEffectiveClassYear } from "./ranking-eligibility";
import { prisma } from "./prisma";
import { getPublicBoardRows, normalizePublicBoardPosition } from "./public-board-ranks";
import { getActivePlayerFormulaConfig } from "./ratings/active-formula";
import { resolveActivePlayerRatingFilter } from "./ratings/player-rating-query";
import {
  loadCompetitionParticipationByPlayerIds,
  primaryCompetitionFromSummary,
  type PrimaryCompetition
} from "./player-competition-context";

const defaultAgeGroup = AgeGroup.U19;
const rankingAgeGroups = [AgeGroup.U13, AgeGroup.U16, AgeGroup.U19] as const;

export type RankingGender = "Boys" | "Girls";
export type RankingAgeGroup = "U13" | "U16" | "U19";

export type NationalRankingRow = {
  rank: number;
  playerId: string;
  displayName: string;
  slug: string;
  city: string;
  region: string;
  position: string | null;
  heightCm: number | null;
  birthYear: number | null;
  age: number | null;
  currentTeam: string;
  photoUrl: string | null;
  gender: RankingGender;
  ageGroup: RankingAgeGroup;
  computedAgeBracket: RankingAgeGroup | "OUT_OF_RANGE" | null;
  effectiveClassYear: number | null;
  classYearLabel: string | null;
  eligibilityVerdict: EligibilityVerdict;
  rating: number;
  starRating: number;
  verifiedGameCount: number;
  primaryCompetition: PrimaryCompetition | null;
};

export type NationalRankingSnapshot = {
  snapshotId: string | null;
  gender: RankingGender;
  ageGroup: RankingAgeGroup;
  weekOf: string | null;
  formulaVersionId: string | null;
  totalRows: number;
  rows: NationalRankingRow[];
};

export type LatestNationalRankings = {
  formulaVersionId: string | null;
  snapshots: {
    boys: NationalRankingSnapshot;
    girls: NationalRankingSnapshot;
  };
  snapshotsByAge: Record<RankingAgeGroup, { boys: NationalRankingSnapshot; girls: NationalRankingSnapshot }>;
};

export type PublicBoardRankLookup = {
  nationalRank: number | null;
  regionRank: number | null;
  positionRank: number | null;
  snapshotWeekOf: string | null;
  snapshotRank: number | null;
  row: NationalRankingRow | null;
};

function toDisplayGender(gender: PlayerGender): RankingGender {
  return gender === PlayerGender.GIRLS ? "Girls" : "Boys";
}

function genderKey(gender: PlayerGender | RankingGender) {
  return gender === PlayerGender.GIRLS || gender === "Girls" ? "girls" : "boys";
}

function calculateAge(birthDate: Date | null) {
  if (!birthDate) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birthDate.getUTCDate())) age -= 1;
  return age;
}

function emptySnapshot(gender: PlayerGender, formulaVersionId: string | null, ageGroup: RankingAgeGroup): NationalRankingSnapshot {
  return { snapshotId: null, gender: toDisplayGender(gender), ageGroup, weekOf: null, formulaVersionId, totalRows: 0, rows: [] };
}

async function getLatestSnapshot(gender: PlayerGender, formulaVersionId: string | null, ageGroup: RankingAgeGroup): Promise<NationalRankingSnapshot> {
  const ratingFilter = await resolveActivePlayerRatingFilter();
  const activeFormulaVersionId = ratingFilter.formulaVersionId ?? formulaVersionId;
  if (!activeFormulaVersionId) return emptySnapshot(gender, null, ageGroup);

  const latestSnapshot = await prisma.rankingSnapshot.findFirst({
    where: {
      scope: RankingScope.NATIONAL,
      ageGroup: ageGroup as AgeGroup,
      gender,
      formulaVersionId: activeFormulaVersionId,
      city: null,
      region: null
    },
    orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }]
  });

  const ratings = await prisma.playerRating.findMany({
    where: {
      ageGroup: ageGroup as AgeGroup,
      formulaVersionId: activeFormulaVersionId,
      policyVersionId: ratingFilter.policyVersionId,
      player: { gender, deletedAt: null }
    },
    include: {
      player: {
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
      }
    },
    orderBy: [{ adjustedRating: "desc" }, { verifiedGameCount: "desc" }, { player: { displayName: "asc" } }]
  });

  const participationByPlayer = await loadCompetitionParticipationByPlayerIds(
    ratings.map((rating) => rating.playerId)
  );

  return {
    snapshotId: latestSnapshot?.id ?? null,
    gender: toDisplayGender(gender),
    ageGroup,
    weekOf: latestSnapshot?.weekOf.toISOString() ?? null,
    formulaVersionId: activeFormulaVersionId,
    totalRows: ratings.length,
    rows: ratings.map((rating, index) => {
      const eligibilityVerdict = evaluateEligibility(buildEligibilityInput({
        playerId: rating.playerId,
        gender: rating.player.gender,
        birthDate: rating.player.birthDate,
        firstRankingEligibilityAt: rating.player.firstRankingEligibilityAt,
        classYearOverride: rating.player.classYearOverride,
        ageGroupOverride: rating.player.ageGroupOverride,
        ratingAgeGroup: rating.ageGroup as RankingAgeGroup,
        verifiedGameCount: rating.verifiedGameCount,
        evaluatedBoard: ageGroup,
        formulaVersionId: activeFormulaVersionId
      }));

      const effectiveClassYear = getEffectiveClassYear(rating.player.birthDate, rating.player.classYearOverride);

      return {
        rank: index + 1,
        playerId: rating.playerId,
        displayName: rating.player.displayName,
        slug: slugify(rating.player.displayName),
        city: rating.player.city,
        region: rating.player.region,
        position: rating.player.position,
        heightCm: rating.player.heightCm,
        birthYear: rating.player.birthDate ? rating.player.birthDate.getUTCFullYear() : null,
        age: calculateAge(rating.player.birthDate),
        currentTeam: resolvePrimaryRankingAffiliation({
          schoolOverride: rating.player.schoolOverride,
          currentProgram: rating.player.currentProgram,
          gameStats: rating.player.gameStats
        }),
        photoUrl: rating.player.photoUrl,
        gender: toDisplayGender(rating.player.gender),
        ageGroup: (rating.player.ageGroupOverride || ageGroup) as RankingAgeGroup,
        computedAgeBracket: getCurrentRankingAgeBracket(rating.player.birthDate, new Date(), rating.player.classYearOverride, ageGroup),
        effectiveClassYear,
        classYearLabel: effectiveClassYear ? `Class of ${effectiveClassYear}` : null,
        eligibilityVerdict,
        rating: Number(rating.adjustedRating),
        starRating: rating.starRating,
        verifiedGameCount: rating.verifiedGameCount,
        primaryCompetition: primaryCompetitionFromSummary(
          participationByPlayer.get(rating.playerId) ?? {
            primary: null,
            totalVerifiedGames: 0,
            competitionCount: 0,
            competitions: []
          }
        )
      };
    })
  };
}

export async function getLatestNationalRankings(): Promise<LatestNationalRankings> {
  const activeFormula = getActivePlayerFormulaConfig();
  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: activeFormula.formulaVersionNumber },
    select: { id: true }
  });
  const formulaVersionId = formulaVersion?.id ?? null;
  const entries = await Promise.all(rankingAgeGroups.map(async (ageGroup) => {
    const [boys, girls] = await Promise.all([
      getLatestSnapshot(PlayerGender.BOYS, formulaVersionId, ageGroup),
      getLatestSnapshot(PlayerGender.GIRLS, formulaVersionId, ageGroup)
    ]);
    return [ageGroup, { boys, girls }] as const;
  }));
  const snapshotsByAge = Object.fromEntries(entries) as Record<RankingAgeGroup, { boys: NationalRankingSnapshot; girls: NationalRankingSnapshot }>;
  return { formulaVersionId, snapshots: snapshotsByAge[defaultAgeGroup], snapshotsByAge };
}

export async function getCurrentPublicBoardRankForPlayer(playerId: string, gender: PlayerGender, ageGroup: AgeGroup): Promise<PublicBoardRankLookup> {
  const rankings = await getLatestNationalRankings();
  const snapshot = rankings.snapshotsByAge[ageGroup as RankingAgeGroup]?.[genderKey(gender)];
  if (!snapshot) return { nationalRank: null, regionRank: null, positionRank: null, snapshotWeekOf: null, snapshotRank: null, row: null };

  const rows = getPublicBoardRows(snapshot);
  const rowIndex = rows.findIndex((row) => row.playerId === playerId);
  if (rowIndex < 0) return { nationalRank: null, regionRank: null, positionRank: null, snapshotWeekOf: snapshot.weekOf, snapshotRank: null, row: null };

  const row = rows[rowIndex];
  const region = row.region?.trim().toLowerCase();
  const position = normalizePublicBoardPosition(row.position);
  const regionRows = region ? rows.filter((candidate) => candidate.region?.trim().toLowerCase() === region) : [];
  const positionRows = position ? rows.filter((candidate) => normalizePublicBoardPosition(candidate.position) === position) : [];
  const regionIndex = regionRows.findIndex((candidate) => candidate.playerId === playerId);
  const positionIndex = positionRows.findIndex((candidate) => candidate.playerId === playerId);

  return {
    nationalRank: rowIndex + 1,
    regionRank: regionIndex >= 0 ? regionIndex + 1 : null,
    positionRank: positionIndex >= 0 ? positionIndex + 1 : null,
    snapshotWeekOf: snapshot.weekOf,
    snapshotRank: row.rank,
    row
  };
}
