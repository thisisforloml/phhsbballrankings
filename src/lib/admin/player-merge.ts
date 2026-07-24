import "server-only";

import { createHash } from "node:crypto";

import { type AgeGroup, PlayerGender, type Prisma } from "@prisma/client";

import {
  buildCumulativePlayerRatingTarget,
  type CumulativePlayerRatingTarget,
  loadCumulativeFormulaV1Gps,
} from "@/lib/player-rating-cumulative";
import { prisma } from "@/lib/prisma";
import {
  FORMULA_TIER_NORMALIZED_V1_POLICY_ID,
  FORMULA_V1_POLICY_ID,
} from "@/lib/ratings/formula-constants";
import {
  buildTierNormalizedRatingTargets,
  loadTierNormalizedGpsGames,
  resolveFormulaV1VersionId,
} from "@/lib/ratings/tier-normalized-v1";

export type PlayerMergePreview = {
  canonical: PlayerMergeRecord;
  duplicates: PlayerMergeRecord[];
  impact: {
    gameStats: number;
    performanceScores: number;
    rosterAssignments: number;
    redundantRosterAssignments: number;
    programHistory: number;
    profileSubmissions: number;
    profileClaims: number;
    claimProfile: number;
    aliases: number;
    externalAliases: number;
    ratings: number;
    snapshotRows: number;
    collidingSnapshotRows: number;
  };
  blockers: string[];
  warnings: string[];
  sameGameCollisions: string[];
  rosterConflicts: Array<{
    seasonId: string;
    seasonName: string;
    canonicalTeam: string;
    duplicateTeam: string;
  }>;
  canMerge: boolean;
  fingerprint: string;
};

export type PlayerMergeRecord = {
  id: string;
  displayName: string;
  gender: string;
  birthDate: string | null;
  heightCm: number | null;
  position: string | null;
  currentProgramId: string | null;
  currentProgramName: string | null;
  profileSlug: string | null;
  updatedAt: string;
};

export type PlayerMergeResult = {
  canonicalPlayerId: string;
  canonicalDisplayName: string;
  duplicatePlayerIds: string[];
  duplicateDisplayNames: string[];
  reassigned: {
    gameStats: number;
    performanceScores: number;
    rosterAssignments: number;
    programHistory: number;
    profileSubmissions: number;
    profileClaims: number;
    claimProfile: number;
    aliases: number;
    externalAliases: number;
    snapshotRows: number;
  };
  removedRedundant: {
    rosterAssignments: number;
    snapshotRows: number;
    ratings: number;
  };
  ratingsUpdated: number;
};

type PlayerMergePlan = {
  preview: PlayerMergePreview;
  duplicatePlayerIds: string[];
  redundantRosterIds: string[];
  movableRosterIds: string[];
  redundantSnapshotRowIds: string[];
  movableSnapshotRowIds: string[];
  displayAliasesToCreate: Array<{
    playerId: string;
    aliasName: string;
    gender: PlayerGender;
    source: string;
    note: string;
  }>;
  claimProfilePlayerId: string | null;
};

const playerSelect = {
  id: true,
  displayName: true,
  gender: true,
  birthDate: true,
  heightCm: true,
  position: true,
  currentProgramId: true,
  profileSlug: true,
  updatedAt: true,
  deletedAt: true,
  currentProgram: { select: { fullName: true } },
} as const;

export async function loadPlayerMergeOptions() {
  const players = await prisma.player.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      displayName: true,
      gender: true,
      currentProgram: { select: { fullName: true } },
    },
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
  });
  return players.map((player) => ({
    id: player.id,
    displayName: player.displayName,
    gender: player.gender,
    programName: player.currentProgram?.fullName ?? null,
  }));
}

function serializePlayer(player: {
  id: string;
  displayName: string;
  gender: PlayerGender;
  birthDate: Date | null;
  heightCm: number | null;
  position: string | null;
  currentProgramId: string | null;
  profileSlug: string | null;
  updatedAt: Date;
  currentProgram: { fullName: string } | null;
}): PlayerMergeRecord {
  return {
    id: player.id,
    displayName: player.displayName,
    gender: player.gender,
    birthDate: player.birthDate?.toISOString().slice(0, 10) ?? null,
    heightCm: player.heightCm,
    position: player.position,
    currentProgramId: player.currentProgramId,
    currentProgramName: player.currentProgram?.fullName ?? null,
    profileSlug: player.profileSlug,
    updatedAt: player.updatedAt.toISOString(),
  };
}

function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizeDuplicatePlayerIds(canonicalPlayerId: string, duplicatePlayerIds: string | string[]) {
  const normalized = Array.from(new Set(
    (Array.isArray(duplicatePlayerIds) ? duplicatePlayerIds : [duplicatePlayerIds])
      .map((playerId) => playerId.trim())
      .filter(Boolean),
  )).sort();

  if (!canonicalPlayerId || normalized.length === 0) {
    throw new Error("Choose a Player to keep and at least one duplicate Player.");
  }
  if (normalized.includes(canonicalPlayerId)) {
    throw new Error("The Player to keep cannot also be selected as a duplicate.");
  }
  if (normalized.length > 10) {
    throw new Error("Merge at most 10 duplicate profiles at one time.");
  }
  return normalized;
}

function combineCumulativeTargets(
  playerId: string,
  rows: Array<{ ageGroup: AgeGroup; gpsCount: number; avgFinalScore: number }>,
): CumulativePlayerRatingTarget[] {
  const grouped = new Map<AgeGroup, { count: number; total: number }>();
  for (const row of rows) {
    const current = grouped.get(row.ageGroup) ?? { count: 0, total: 0 };
    current.count += row.gpsCount;
    current.total += row.avgFinalScore * row.gpsCount;
    grouped.set(row.ageGroup, current);
  }
  return Array.from(grouped.entries()).map(([ageGroup, value]) =>
    buildCumulativePlayerRatingTarget({
      playerId,
      ageGroup,
      gpsCount: value.count,
      avgFinalScore: value.total / value.count,
    }),
  );
}

async function buildMergedRatingTargets(canonicalPlayerId: string, duplicatePlayerIds: string[]) {
  const playerIds = [canonicalPlayerId, ...duplicatePlayerIds];
  const [formulaVersionId, cumulativeRows, tierGames] = await Promise.all([
    resolveFormulaV1VersionId(),
    loadCumulativeFormulaV1Gps({ playerIds }),
    loadTierNormalizedGpsGames({ playerIds }),
  ]);
  return {
    formulaVersionId,
    productionTargets: combineCumulativeTargets(canonicalPlayerId, cumulativeRows),
    tierTargets: buildTierNormalizedRatingTargets(
      tierGames.map((row) => ({ ...row, playerId: canonicalPlayerId })),
    ),
  };
}

async function buildPlayerMergePlan(
  canonicalPlayerId: string,
  duplicatePlayerIdsInput: string | string[],
): Promise<PlayerMergePlan> {
  const duplicatePlayerIds = normalizeDuplicatePlayerIds(canonicalPlayerId, duplicatePlayerIdsInput);
  const selectedPlayerIds = [canonicalPlayerId, ...duplicatePlayerIds];
  const selectedPlayerIdSet = new Set(selectedPlayerIds);

  const players = await prisma.player.findMany({
    where: { id: { in: selectedPlayerIds } },
    select: playerSelect,
  });
  const canonical = players.find((player) => player.id === canonicalPlayerId);
  const duplicates = duplicatePlayerIds.map((playerId) => players.find((player) => player.id === playerId));

  if (!canonical || canonical.deletedAt) throw new Error("The Player record to keep is missing or archived.");
  if (duplicates.some((player) => !player || player.deletedAt)) {
    throw new Error("One or more duplicate Player records are missing or already archived.");
  }
  const activeDuplicates = duplicates.filter((player): player is NonNullable<typeof player> => Boolean(player));

  const [
    selectedStats,
    performanceScores,
    selectedRosters,
    programHistory,
    profileSubmissions,
    profileClaims,
    claimProfiles,
    aliases,
    externalAliases,
    ratings,
    selectedSnapshotRows,
    displayNameAliases,
  ] = await Promise.all([
    prisma.gameStat.findMany({
      where: { playerId: { in: selectedPlayerIds } },
      select: { playerId: true, gameId: true },
    }),
    prisma.gamePerformanceScore.count({ where: { playerId: { in: duplicatePlayerIds } } }),
    prisma.playerTeamSeason.findMany({
      where: { playerId: { in: selectedPlayerIds } },
      orderBy: [{ seasonId: "asc" }, { playerId: "asc" }, { id: "asc" }],
      select: {
        id: true,
        playerId: true,
        seasonId: true,
        teamId: true,
        team: { select: { name: true } },
        season: { select: { name: true } },
      },
    }),
    prisma.playerProgramHistory.count({ where: { playerId: { in: duplicatePlayerIds } } }),
    prisma.playerProfileSubmission.count({ where: { playerId: { in: duplicatePlayerIds } } }),
    prisma.profileClaim.count({ where: { playerId: { in: duplicatePlayerIds } } }),
    prisma.playerClaimProfile.findMany({
      where: { playerId: { in: selectedPlayerIds } },
      select: { playerId: true },
    }),
    prisma.playerAlias.count({ where: { playerId: { in: duplicatePlayerIds } } }),
    prisma.playerExternalAlias.count({ where: { playerId: { in: duplicatePlayerIds } } }),
    prisma.playerRating.count({ where: { playerId: { in: duplicatePlayerIds } } }),
    prisma.rankingSnapshotRow.findMany({
      where: { playerId: { in: selectedPlayerIds } },
      orderBy: [{ snapshotId: "asc" }, { playerId: "asc" }, { id: "asc" }],
      select: { id: true, playerId: true, snapshotId: true },
    }),
    prisma.playerAlias.findMany({
      where: {
        aliasName: { in: activeDuplicates.map((player) => player.displayName) },
        gender: canonical.gender,
      },
      select: { playerId: true, aliasName: true },
    }),
  ]);

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (activeDuplicates.some((duplicate) => canonical.gender !== duplicate.gender)) {
    blockers.push("Selected Players have different genders.");
  }

  const playersByGame = new Map<string, Set<string>>();
  for (const row of selectedStats) {
    const playerIds = playersByGame.get(row.gameId) ?? new Set<string>();
    playerIds.add(row.playerId);
    playersByGame.set(row.gameId, playerIds);
  }
  const sameGameCollisions = Array.from(playersByGame.entries())
    .filter(([, playerIds]) => playerIds.size > 1)
    .map(([gameId]) => gameId)
    .sort();
  if (sameGameCollisions.length) {
    blockers.push(`${sameGameCollisions.length} same-game GameStat collision(s) require manual stat review first.`);
  }

  const redundantRosterIds: string[] = [];
  const movableRosterIds: string[] = [];
  const rosterConflicts: PlayerMergePreview["rosterConflicts"] = [];
  const rostersBySeason = new Map<string, typeof selectedRosters>();
  for (const roster of selectedRosters) {
    const rows = rostersBySeason.get(roster.seasonId) ?? [];
    rows.push(roster);
    rostersBySeason.set(roster.seasonId, rows);
  }
  for (const rows of rostersBySeason.values()) {
    const teamIds = new Set(rows.map((row) => row.teamId));
    if (teamIds.size > 1) {
      const retained = rows.find((row) => row.playerId === canonicalPlayerId) ?? rows[0];
      for (const row of rows.filter((candidate) => candidate.teamId !== retained.teamId)) {
        rosterConflicts.push({
          seasonId: row.seasonId,
          seasonName: row.season.name,
          canonicalTeam: retained.team.name,
          duplicateTeam: row.team.name,
        });
      }
      continue;
    }

    const retained = rows.find((row) => row.playerId === canonicalPlayerId) ?? rows[0];
    for (const row of rows) {
      if (row.playerId === canonicalPlayerId) continue;
      if (row.id === retained.id) movableRosterIds.push(row.id);
      else redundantRosterIds.push(row.id);
    }
  }
  if (rosterConflicts.length) {
    blockers.push(`${rosterConflicts.length} same-season roster assignment conflict(s) require a manual roster decision.`);
  }

  if (claimProfiles.length > 1) {
    blockers.push("Multiple selected records have claimed-profile settings. Resolve ownership before merging.");
  }
  for (const alias of displayNameAliases) {
    if (!selectedPlayerIdSet.has(alias.playerId)) {
      blockers.push(`The alias ${alias.aliasName} is assigned to another Player record.`);
    }
  }

  for (const duplicate of activeDuplicates) {
    if (canonical.birthDate && duplicate.birthDate && canonical.birthDate.getTime() !== duplicate.birthDate.getTime()) {
      warnings.push(`${duplicate.displayName}: birth date differs; the retained record's value remains unchanged.`);
    }
    if (canonical.currentProgramId !== duplicate.currentProgramId) {
      warnings.push(`${duplicate.displayName}: current Program differs; the retained record's Program remains unchanged.`);
    }
    if (canonical.heightCm && duplicate.heightCm && canonical.heightCm !== duplicate.heightCm) {
      warnings.push(`${duplicate.displayName}: height differs; the retained record's height remains unchanged.`);
    }
  }
  warnings.push("Historical GameStat team IDs and stat values are preserved; only Player references are consolidated.");

  const redundantSnapshotRowIds: string[] = [];
  const movableSnapshotRowIds: string[] = [];
  const snapshotRowsBySnapshot = new Map<string, typeof selectedSnapshotRows>();
  for (const row of selectedSnapshotRows) {
    const rows = snapshotRowsBySnapshot.get(row.snapshotId) ?? [];
    rows.push(row);
    snapshotRowsBySnapshot.set(row.snapshotId, rows);
  }
  for (const rows of snapshotRowsBySnapshot.values()) {
    const retained = rows.find((row) => row.playerId === canonicalPlayerId) ?? rows[0];
    for (const row of rows) {
      if (row.playerId === canonicalPlayerId) continue;
      if (row.id === retained.id) movableSnapshotRowIds.push(row.id);
      else redundantSnapshotRowIds.push(row.id);
    }
  }

  const claimProfilePlayerId = claimProfiles.find((row) => row.playerId !== canonicalPlayerId)?.playerId ?? null;
  const displayAliasNames = new Set(displayNameAliases.map((alias) => alias.aliasName));
  const displayAliasesToCreate = activeDuplicates
    .filter((duplicate) => !displayAliasNames.has(duplicate.displayName))
    .map((duplicate) => ({
      playerId: canonicalPlayerId,
      aliasName: duplicate.displayName,
      gender: duplicate.gender,
      source: "admin-player-merge",
      note: `Former duplicate Player ${duplicate.id}`,
    }));

  const impact = {
    gameStats: selectedStats.filter((row) => row.playerId !== canonicalPlayerId).length,
    performanceScores,
    rosterAssignments: selectedRosters.filter((row) => row.playerId !== canonicalPlayerId).length,
    redundantRosterAssignments: redundantRosterIds.length,
    programHistory,
    profileSubmissions,
    profileClaims,
    claimProfile: claimProfilePlayerId ? 1 : 0,
    aliases,
    externalAliases,
    ratings,
    snapshotRows: selectedSnapshotRows.filter((row) => row.playerId !== canonicalPlayerId).length,
    collidingSnapshotRows: redundantSnapshotRowIds.length,
  };

  const previewFingerprint = fingerprint({
    canonicalId: canonical.id,
    canonicalUpdatedAt: canonical.updatedAt.toISOString(),
    duplicates: activeDuplicates.map((duplicate) => ({
      id: duplicate.id,
      updatedAt: duplicate.updatedAt.toISOString(),
    })),
    impact,
    sameGameCollisions,
    rosterConflicts,
    blockers,
    redundantRosterIds,
    movableRosterIds,
    redundantSnapshotRowIds,
    movableSnapshotRowIds,
  });

  return {
    preview: {
      canonical: serializePlayer(canonical),
      duplicates: activeDuplicates.map(serializePlayer),
      impact,
      blockers,
      warnings,
      sameGameCollisions,
      rosterConflicts,
      canMerge: blockers.length === 0,
      fingerprint: previewFingerprint,
    },
    duplicatePlayerIds,
    redundantRosterIds,
    movableRosterIds,
    redundantSnapshotRowIds,
    movableSnapshotRowIds,
    displayAliasesToCreate,
    claimProfilePlayerId,
  };
}

export async function buildPlayerMergePreview(
  canonicalPlayerId: string,
  duplicatePlayerIds: string | string[],
): Promise<PlayerMergePreview> {
  return (await buildPlayerMergePlan(canonicalPlayerId, duplicatePlayerIds)).preview;
}

export async function executePlayerMerge(input: {
  canonicalPlayerId: string;
  duplicatePlayerIds: string[];
  expectedFingerprint: string;
  reason: string;
  userId: string;
}): Promise<PlayerMergeResult> {
  const plan = await buildPlayerMergePlan(input.canonicalPlayerId, input.duplicatePlayerIds);
  const { preview, duplicatePlayerIds } = plan;

  if (!preview.canMerge) throw new Error(preview.blockers.join(" "));
  if (preview.fingerprint !== input.expectedFingerprint) {
    throw new Error("Player records changed after preview. Refresh and review the merge again.");
  }

  const ratingTargets = await buildMergedRatingTargets(input.canonicalPlayerId, duplicatePlayerIds);
  const duplicateDisplayNames = preview.duplicates.map((player) => player.displayName);
  const result: PlayerMergeResult = {
    canonicalPlayerId: preview.canonical.id,
    canonicalDisplayName: preview.canonical.displayName,
    duplicatePlayerIds,
    duplicateDisplayNames,
    reassigned: {
      gameStats: preview.impact.gameStats,
      performanceScores: preview.impact.performanceScores,
      rosterAssignments: plan.movableRosterIds.length,
      programHistory: preview.impact.programHistory,
      profileSubmissions: preview.impact.profileSubmissions,
      profileClaims: preview.impact.profileClaims,
      claimProfile: preview.impact.claimProfile,
      aliases: preview.impact.aliases + plan.displayAliasesToCreate.length,
      externalAliases: preview.impact.externalAliases,
      snapshotRows: plan.movableSnapshotRowIds.length,
    },
    removedRedundant: {
      rosterAssignments: plan.redundantRosterIds.length,
      snapshotRows: plan.redundantSnapshotRowIds.length,
      ratings: preview.impact.ratings,
    },
    ratingsUpdated: ratingTargets.productionTargets.length + ratingTargets.tierTargets.length,
  };

  const operations: Prisma.PrismaPromise<unknown>[] = [
    prisma.playerAlias.updateMany({
      where: { playerId: { in: duplicatePlayerIds } },
      data: { playerId: input.canonicalPlayerId },
    }),
  ];

  if (plan.displayAliasesToCreate.length) {
    operations.push(prisma.playerAlias.createMany({ data: plan.displayAliasesToCreate }));
  }

  operations.push(
    prisma.playerExternalAlias.updateMany({
      where: { playerId: { in: duplicatePlayerIds } },
      data: { playerId: input.canonicalPlayerId },
    }),
    prisma.gameStat.updateMany({
      where: { playerId: { in: duplicatePlayerIds } },
      data: { playerId: input.canonicalPlayerId },
    }),
    prisma.gamePerformanceScore.updateMany({
      where: { playerId: { in: duplicatePlayerIds } },
      data: { playerId: input.canonicalPlayerId },
    }),
    prisma.playerProgramHistory.updateMany({
      where: { playerId: { in: duplicatePlayerIds } },
      data: { playerId: input.canonicalPlayerId },
    }),
    prisma.playerProfileSubmission.updateMany({
      where: { playerId: { in: duplicatePlayerIds } },
      data: { playerId: input.canonicalPlayerId },
    }),
    prisma.profileClaim.updateMany({
      where: { playerId: { in: duplicatePlayerIds } },
      data: { playerId: input.canonicalPlayerId },
    }),
  );

  if (plan.claimProfilePlayerId) {
    operations.push(prisma.playerClaimProfile.update({
      where: { playerId: plan.claimProfilePlayerId },
      data: { playerId: input.canonicalPlayerId },
    }));
  }
  if (plan.redundantRosterIds.length) {
    operations.push(prisma.playerTeamSeason.deleteMany({ where: { id: { in: plan.redundantRosterIds } } }));
  }
  if (plan.movableRosterIds.length) {
    operations.push(prisma.playerTeamSeason.updateMany({
      where: { id: { in: plan.movableRosterIds } },
      data: { playerId: input.canonicalPlayerId },
    }));
  }
  if (plan.redundantSnapshotRowIds.length) {
    operations.push(prisma.rankingSnapshotRow.deleteMany({
      where: { id: { in: plan.redundantSnapshotRowIds } },
    }));
  }
  if (plan.movableSnapshotRowIds.length) {
    operations.push(prisma.rankingSnapshotRow.updateMany({
      where: { id: { in: plan.movableSnapshotRowIds } },
      data: { playerId: input.canonicalPlayerId },
    }));
  }

  operations.push(prisma.playerRating.deleteMany({ where: { playerId: { in: duplicatePlayerIds } } }));

  for (const [policyVersionId, targets] of [
    [FORMULA_V1_POLICY_ID, ratingTargets.productionTargets],
    [FORMULA_TIER_NORMALIZED_V1_POLICY_ID, ratingTargets.tierTargets],
  ] as const) {
    for (const target of targets) {
      operations.push(prisma.playerRating.upsert({
        where: {
          playerId_ageGroup_formulaVersionId_policyVersionId: {
            playerId: input.canonicalPlayerId,
            ageGroup: target.ageGroup,
            formulaVersionId: ratingTargets.formulaVersionId,
            policyVersionId,
          },
        },
        update: {
          observedRating: target.observedRating,
          adjustedRating: target.adjustedRating,
          verifiedGameCount: target.verifiedGameCount,
          starRating: target.starRating,
          computedAt: new Date(),
        },
        create: {
          playerId: input.canonicalPlayerId,
          ageGroup: target.ageGroup,
          formulaVersionId: ratingTargets.formulaVersionId,
          policyVersionId,
          observedRating: target.observedRating,
          adjustedRating: target.adjustedRating,
          verifiedGameCount: target.verifiedGameCount,
          starRating: target.starRating,
        },
      }));
    }
  }

  operations.push(
    prisma.player.updateMany({
      where: { id: { in: duplicatePlayerIds }, deletedAt: null },
      data: { deletedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        userId: input.userId,
        entityType: "PLAYER",
        entityId: input.canonicalPlayerId,
        action: duplicatePlayerIds.length === 1 ? "MERGE_DUPLICATE_PLAYER" : "MERGE_DUPLICATE_PLAYERS",
        reason: input.reason,
        previousData: {
          canonicalPlayerId: input.canonicalPlayerId,
          duplicatePlayerIds,
          previewFingerprint: input.expectedFingerprint,
        },
        newData: result,
      },
    }),
  );

  // A batch transaction avoids long-lived interactive transaction IDs through Supabase's pooler.
  await prisma.$transaction(operations);
  return result;
}
