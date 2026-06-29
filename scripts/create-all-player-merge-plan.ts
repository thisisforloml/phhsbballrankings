import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { prisma } from "../src/lib/prisma";
import { slugify } from "../src/lib/format";
import { getClassYear } from "../src/lib/ranking-eligibility";

type ReviewClassification = "MERGE_APPROVED_CANDIDATE" | "NEEDS_MANUAL_CONFIRMATION" | "KEEP_SEPARATE";

type InputPlayerGroup = {
  groupId: string;
  detectionType: string;
  similarityScore?: number;
  classification: string;
  playerIds: string[];
  displayNames: string[];
  recommendedCanonicalPlayer?: { playerId: string; displayName: string } | null;
};

type CleanupReport = {
  playerDuplicatePlan: InputPlayerGroup[];
};

const inputPath = join(process.cwd(), "scripts", "reports", "duplicate-cleanup-plan.json");
const outputPath = join(process.cwd(), "scripts", "reports", "all-player-merge-plan.json");

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactName(value: string) {
  return normalizeName(value).replace(/\s+/g, "");
}

function namesAreSimilar(names: string[]) {
  if (names.length < 2) return false;
  const compact = names.map(compactName).filter(Boolean);
  if (new Set(compact).size === 1) return true;
  return compact.every((name) => compact.some((other) => name !== other && (name.includes(other) || other.includes(name) || levenshteinRatio(name, other) >= 0.82)));
}

function levenshteinRatio(left: string, right: string) {
  const matrix = Array.from({ length: left.length + 1 }, () => Array<number>(right.length + 1).fill(0));
  for (let i = 0; i <= left.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  const distance = matrix[left.length][right.length];
  const maxLength = Math.max(left.length, right.length, 1);
  return 1 - distance / maxLength;
}

function dateOnly(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

function chooseCanonical(players: EnrichedPlayer[]) {
  return players.slice().sort((left, right) => {
    const leftScore = left.gameStatCount * 10 + left.gamePerformanceScoreCount * 8 + left.playerRatingCount * 5 + left.rankingSnapshotRowCount * 5;
    const rightScore = right.gameStatCount * 10 + right.gamePerformanceScoreCount * 8 + right.playerRatingCount * 5 + right.rankingSnapshotRowCount * 5;
    if (rightScore !== leftScore) return rightScore - leftScore;
    if (right.updatedAt !== left.updatedAt) return right.updatedAt.localeCompare(left.updatedAt);
    return left.displayName.localeCompare(right.displayName);
  })[0];
}

type EnrichedPlayer = {
  playerId: string;
  displayName: string;
  firstName: string;
  lastName: string;
  currentProgramId: string | null;
  currentProgram: { programId: string; fullName: string; abbreviation: string | null } | null;
  gender: string;
  birthDate: string | null;
  classYear: number | null;
  classYearOverride: number | null;
  ageGroupOverride: string | null;
  height: number | null;
  position: string | null;
  slug: string;
  gameStatCount: number;
  gamePerformanceScoreCount: number;
  playerRatingCount: number;
  rankingSnapshotRowCount: number;
  playerProfileSubmissionCount: number;
  ratingAgeGroups: string[];
  snapshotScopes: Array<{ snapshotId: string; ageGroup: string | null; gender: string; weekOf: string; rank: number }>;
  updatedAt: string;
  deletedAt: string | null;
};

function classifyGroup(players: EnrichedPlayer[]) {
  const names = players.map((player) => player.displayName);
  const programs = new Set(players.map((player) => player.currentProgramId ?? "none"));
  const genders = new Set(players.map((player) => player.gender));
  const birthDates = new Set(players.map((player) => player.birthDate).filter(Boolean));
  const similarName = namesAreSimilar(names);

  if (genders.size > 1 || birthDates.size > 1) return "KEEP_SEPARATE" as ReviewClassification;
  if (!similarName) return "NEEDS_MANUAL_CONFIRMATION" as ReviewClassification;
  if (programs.size !== 1) return "NEEDS_MANUAL_CONFIRMATION" as ReviewClassification;
  return "MERGE_APPROVED_CANDIDATE" as ReviewClassification;
}

function manualCheckNotes(classification: ReviewClassification, players: EnrichedPlayer[]) {
  const notes: string[] = [];
  const programs = new Set(players.map((player) => player.currentProgramId ?? "none"));
  const genders = new Set(players.map((player) => player.gender));
  const birthDates = new Set(players.map((player) => player.birthDate).filter(Boolean));
  if (classification === "MERGE_APPROVED_CANDIDATE") {
    notes.push("Same or very similar name, same current Program, same gender, and no conflicting birthDate. Admin should still verify identity from source box scores before repair.");
  }
  if (programs.size > 1) notes.push("Current Program differs; verify school/team history before merging.");
  if (genders.size > 1) notes.push("Gender differs; keep separate unless the underlying player record is wrong and separately approved for correction.");
  if (birthDates.size > 1) notes.push("BirthDate conflicts; keep separate unless bio source confirms one date is wrong.");
  if (!notes.length) notes.push("Similar-name group needs source document review before any merge.");
  return notes;
}

function collisionRisk(players: EnrichedPlayer[]) {
  const ratingKeys = new Map<string, string[]>();
  const snapshotKeys = new Map<string, string[]>();
  for (const player of players) {
    for (const ageGroup of player.ratingAgeGroups) {
      const list = ratingKeys.get(ageGroup) ?? [];
      list.push(player.playerId);
      ratingKeys.set(ageGroup, list);
    }
    for (const scope of player.snapshotScopes) {
      const key = `${scope.snapshotId}|${scope.ageGroup ?? "none"}|${scope.gender}`;
      const list = snapshotKeys.get(key) ?? [];
      list.push(player.playerId);
      snapshotKeys.set(key, list);
    }
  }
  const ratingCollisions = Array.from(ratingKeys.entries()).filter(([, ids]) => new Set(ids).size > 1).map(([ageGroup, playerIds]) => ({ ageGroup, playerIds: Array.from(new Set(playerIds)) }));
  const snapshotCollisions = Array.from(snapshotKeys.entries()).filter(([, ids]) => new Set(ids).size > 1).map(([key, playerIds]) => {
    const [snapshotId, ageGroup, gender] = key.split("|");
    return { snapshotId, ageGroup: ageGroup === "none" ? null : ageGroup, gender, playerIds: Array.from(new Set(playerIds)) };
  });
  return {
    hasRisk: ratingCollisions.length > 0 || snapshotCollisions.length > 0,
    ratingCollisions,
    snapshotCollisions
  };
}

async function main() {
  const input = JSON.parse(readFileSync(inputPath, "utf8")) as CleanupReport;
  const groups = input.playerDuplicatePlan ?? [];
  const allPlayerIds = Array.from(new Set(groups.flatMap((group) => group.playerIds)));

  const players = await prisma.player.findMany({
    where: { id: { in: allPlayerIds } },
    include: {
      currentProgram: true,
      gameStats: { where: { deletedAt: null }, select: { id: true } },
      performanceScores: { where: { deletedAt: null }, select: { id: true } },
      currentRatings: { select: { id: true, ageGroup: true } },
      rankingRows: { include: { snapshot: { select: { id: true, ageGroup: true, gender: true, weekOf: true } } } },
      _count: { select: { gameStats: true, performanceScores: true, currentRatings: true, rankingRows: true } }
    }
  });
  const profileSubmissionCounts = await prisma.playerProfileSubmission.groupBy({
    by: ["playerId"],
    where: { playerId: { in: allPlayerIds } },
    _count: { _all: true }
  });
  const profileSubmissionCountByPlayerId = new Map(profileSubmissionCounts.map((row) => [row.playerId, row._count._all]));
  const playerById = new Map(players.map((player) => [player.id, player]));

  const mergePlans = groups.map((group) => {
    const enrichedPlayers: EnrichedPlayer[] = group.playerIds.map((playerId) => {
      const player = playerById.get(playerId);
      if (!player) throw new Error(`Player not found: ${playerId}`);
      return {
        playerId: player.id,
        displayName: player.displayName,
        firstName: player.firstName,
        lastName: player.lastName,
        currentProgramId: player.currentProgramId,
        currentProgram: player.currentProgram ? { programId: player.currentProgram.id, fullName: player.currentProgram.fullName, abbreviation: player.currentProgram.abbreviation } : null,
        gender: player.gender,
        birthDate: dateOnly(player.birthDate),
        classYear: player.classYearOverride ?? getClassYear(player.birthDate),
        classYearOverride: player.classYearOverride,
        ageGroupOverride: player.ageGroupOverride,
        height: player.heightCm,
        position: player.position,
        slug: slugify(player.displayName),
        gameStatCount: player.gameStats.length,
        gamePerformanceScoreCount: player.performanceScores.length,
        playerRatingCount: player.currentRatings.length,
        rankingSnapshotRowCount: player.rankingRows.length,
        playerProfileSubmissionCount: profileSubmissionCountByPlayerId.get(player.id) ?? 0,
        ratingAgeGroups: Array.from(new Set(player.currentRatings.map((rating) => String(rating.ageGroup)))).sort(),
        snapshotScopes: player.rankingRows.map((row) => ({
          snapshotId: row.snapshotId,
          ageGroup: row.snapshot.ageGroup ? String(row.snapshot.ageGroup) : null,
          gender: String(row.snapshot.gender),
          weekOf: row.snapshot.weekOf.toISOString().slice(0, 10),
          rank: row.rank
        })),
        updatedAt: player.updatedAt.toISOString(),
        deletedAt: dateOnly(player.deletedAt)
      };
    });

    const classification = classifyGroup(enrichedPlayers);
    const canonical = chooseCanonical(enrichedPlayers);
    const sources = enrichedPlayers.filter((player) => player.playerId !== canonical.playerId);
    const risk = collisionRisk(enrichedPlayers);

    return {
      groupId: group.groupId,
      inputClassification: group.classification,
      detectionType: group.detectionType,
      similarityScore: group.similarityScore ?? null,
      classification,
      players: enrichedPlayers,
      suggestedCanonicalFromInput: group.recommendedCanonicalPlayer ?? null,
      proposedMerge: classification === "MERGE_APPROVED_CANDIDATE" ? {
        canonicalPlayerId: canonical.playerId,
        canonicalDisplayName: canonical.displayName,
        sourcePlayerIds: sources.map((player) => player.playerId),
        sourceDisplayNames: sources.map((player) => player.displayName),
        recordsToReassign: {
          GameStat_playerId: sources.reduce((sum, player) => sum + player.gameStatCount, 0),
          GamePerformanceScore_playerId: sources.reduce((sum, player) => sum + player.gamePerformanceScoreCount, 0),
          PlayerRating_playerId: sources.reduce((sum, player) => sum + player.playerRatingCount, 0),
          RankingSnapshotRow_playerId: sources.reduce((sum, player) => sum + player.rankingSnapshotRowCount, 0),
          PlayerProfileSubmission_playerId: sources.reduce((sum, player) => sum + player.playerProfileSubmissionCount, 0)
        },
        softDeleteSourcePlayersUsingDeletedAt: true,
        sourceSlugRetireOrChangeNeeded: true,
        slugNote: "Player has no stored slug column. Public slug is derived from displayName, so source displayName should be changed during an approved merge if duplicate profile routes must be avoided.",
        ratingsSnapshotsNeedConsolidationOrRegeneration: risk.hasRisk,
        ratingsSnapshotsNote: risk.hasRisk ? "Collision risk exists. Approved merge script must consolidate duplicate PlayerRating and/or RankingSnapshotRow rows in the same scope instead of blindly reassigning." : "No same-scope rating/snapshot collision found. Reassignment should not require rating or snapshot regeneration if stat values remain unchanged."
      } : null,
      manualConfirmationNeeded: classification === "NEEDS_MANUAL_CONFIRMATION" ? manualCheckNotes(classification, enrichedPlayers) : [],
      keepSeparateReason: classification === "KEEP_SEPARATE" ? manualCheckNotes(classification, enrichedPlayers) : null,
      duplicateRankingCollisionRisk: risk
    };
  });

  const summary = {
    totalGroupsInspected: mergePlans.length,
    mergeApprovedCandidateCount: mergePlans.filter((plan) => plan.classification === "MERGE_APPROVED_CANDIDATE").length,
    needsManualConfirmationCount: mergePlans.filter((plan) => plan.classification === "NEEDS_MANUAL_CONFIRMATION").length,
    keepSeparateCount: mergePlans.filter((plan) => plan.classification === "KEEP_SEPARATE").length,
    approvedCandidateNames: mergePlans.filter((plan) => plan.classification === "MERGE_APPROVED_CANDIDATE").map((plan) => plan.players.map((player) => player.displayName).join(" / ")),
    manualConfirmationNames: mergePlans.filter((plan) => plan.classification === "NEEDS_MANUAL_CONFIRMATION").map((plan) => plan.players.map((player) => player.displayName).join(" / ")),
    keepSeparateNames: mergePlans.filter((plan) => plan.classification === "KEEP_SEPARATE").map((plan) => plan.players.map((player) => player.displayName).join(" / ")),
    anyRatingSnapshotCollisionRisks: mergePlans.some((plan) => plan.duplicateRankingCollisionRisk.hasRisk),
    groupsWithRatingSnapshotCollisionRisk: mergePlans.filter((plan) => plan.duplicateRankingCollisionRisk.hasRisk).map((plan) => ({
      groupId: plan.groupId,
      names: plan.players.map((player) => player.displayName),
      risk: plan.duplicateRankingCollisionRisk
    })),
    recommendedNextRepairPrompt: "Review scripts/reports/all-player-merge-plan.json, manually verify identities for MERGE_APPROVED_CANDIDATE groups, then approve a transaction-safe player merge script for selected groups only. Do not merge NEEDS_MANUAL_CONFIRMATION or KEEP_SEPARATE groups without source evidence."
  };

  const report = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    inputPath,
    guardrails: {
      databaseModified: false,
      playersMerged: false,
      playersDeleted: false,
      migrationsRun: false,
      ratingsOrSnapshotsRecomputed: false,
      importsOrPublishRun: false,
      formulaV1Changed: false
    },
    classificationRules: {
      MERGE_APPROVED_CANDIDATE: "Same normalized/similar name, same current Program, same gender, and no conflicting birthDate. Still requires manual identity verification before execution.",
      NEEDS_MANUAL_CONFIRMATION: "Same/similar name but different Program or incomplete evidence that needs source review.",
      KEEP_SEPARATE: "Conflicting birthDate, gender, or strong evidence of different players. Do not merge."
    },
    mergePlans,
    summary
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outputPath, ...summary }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
