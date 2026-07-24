import "server-only";

import { createHash } from "node:crypto";

import { type AgeGroup, PlayerGender } from "@prisma/client";

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
  duplicate: PlayerMergeRecord;
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
  duplicatePlayerId: string;
  duplicateDisplayName: string;
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

export async function buildPlayerMergePreview(
  canonicalPlayerId: string,
  duplicatePlayerId: string,
): Promise<PlayerMergePreview> {
  if (!canonicalPlayerId || !duplicatePlayerId || canonicalPlayerId === duplicatePlayerId) {
    throw new Error("Choose two different active Player records.");
  }

  const [canonical, duplicate] = await Promise.all([
    prisma.player.findUnique({ where: { id: canonicalPlayerId }, select: playerSelect }),
    prisma.player.findUnique({ where: { id: duplicatePlayerId }, select: playerSelect }),
  ]);

  if (!canonical || canonical.deletedAt) throw new Error("The Player record to keep is missing or archived.");
  if (!duplicate || duplicate.deletedAt) throw new Error("The duplicate Player record is missing or already archived.");

  const [
    canonicalStats,
    duplicateStats,
    performanceScores,
    canonicalRosters,
    duplicateRosters,
    programHistory,
    profileSubmissions,
    profileClaims,
    canonicalClaimProfile,
    duplicateClaimProfile,
    aliases,
    externalAliases,
    ratings,
    canonicalSnapshotRows,
    duplicateSnapshotRows,
    sourceNameAlias,
  ] = await Promise.all([
    prisma.gameStat.findMany({ where: { playerId: canonicalPlayerId }, select: { gameId: true } }),
    prisma.gameStat.findMany({ where: { playerId: duplicatePlayerId }, select: { gameId: true } }),
    prisma.gamePerformanceScore.count({ where: { playerId: duplicatePlayerId } }),
    prisma.playerTeamSeason.findMany({
      where: { playerId: canonicalPlayerId },
      select: { id: true, seasonId: true, teamId: true, team: { select: { name: true } }, season: { select: { name: true } } },
    }),
    prisma.playerTeamSeason.findMany({
      where: { playerId: duplicatePlayerId },
      select: { id: true, seasonId: true, teamId: true, team: { select: { name: true } }, season: { select: { name: true } } },
    }),
    prisma.playerProgramHistory.count({ where: { playerId: duplicatePlayerId } }),
    prisma.playerProfileSubmission.count({ where: { playerId: duplicatePlayerId } }),
    prisma.profileClaim.count({ where: { playerId: duplicatePlayerId } }),
    prisma.playerClaimProfile.findUnique({ where: { playerId: canonicalPlayerId }, select: { playerId: true } }),
    prisma.playerClaimProfile.findUnique({ where: { playerId: duplicatePlayerId }, select: { playerId: true } }),
    prisma.playerAlias.count({ where: { playerId: duplicatePlayerId } }),
    prisma.playerExternalAlias.count({ where: { playerId: duplicatePlayerId } }),
    prisma.playerRating.count({ where: { playerId: duplicatePlayerId } }),
    prisma.rankingSnapshotRow.findMany({ where: { playerId: canonicalPlayerId }, select: { snapshotId: true } }),
    prisma.rankingSnapshotRow.findMany({ where: { playerId: duplicatePlayerId }, select: { snapshotId: true } }),
    prisma.playerAlias.findUnique({
      where: { aliasName_gender: { aliasName: duplicate.displayName, gender: duplicate.gender } },
      select: { playerId: true },
    }),
  ]);

  const blockers: string[] = [];
  const warnings: string[] = [];
  if (canonical.gender !== duplicate.gender) blockers.push("Players have different genders.");

  const canonicalGameIds = new Set(canonicalStats.map((row) => row.gameId));
  const sameGameCollisions = Array.from(
    new Set(duplicateStats.filter((row) => canonicalGameIds.has(row.gameId)).map((row) => row.gameId)),
  );
  if (sameGameCollisions.length) {
    blockers.push(`${sameGameCollisions.length} same-game GameStat collision(s) require manual stat review first.`);
  }

  const canonicalRosterBySeason = new Map(canonicalRosters.map((row) => [row.seasonId, row]));
  const redundantRosterAssignments = duplicateRosters.filter((row) => {
    const existing = canonicalRosterBySeason.get(row.seasonId);
    return existing?.teamId === row.teamId;
  });
  const rosterConflicts = duplicateRosters.flatMap((row) => {
    const existing = canonicalRosterBySeason.get(row.seasonId);
    if (!existing || existing.teamId === row.teamId) return [];
    return [{
      seasonId: row.seasonId,
      seasonName: row.season.name,
      canonicalTeam: existing.team.name,
      duplicateTeam: row.team.name,
    }];
  });
  if (rosterConflicts.length) {
    blockers.push(`${rosterConflicts.length} same-season roster assignment conflict(s) require a manual roster decision.`);
  }
  if (canonicalClaimProfile && duplicateClaimProfile) {
    blockers.push("Both records have claimed-profile settings. Resolve ownership before merging.");
  }
  if (sourceNameAlias && sourceNameAlias.playerId !== canonicalPlayerId && sourceNameAlias.playerId !== duplicatePlayerId) {
    blockers.push(`The alias ${duplicate.displayName} is assigned to another Player record.`);
  }

  if (canonical.birthDate && duplicate.birthDate && canonical.birthDate.getTime() !== duplicate.birthDate.getTime()) {
    warnings.push("Birth dates differ. The retained record's birth date will remain unchanged.");
  }
  if (canonical.currentProgramId !== duplicate.currentProgramId) {
    warnings.push("Current Programs differ. The retained record's current Program will remain unchanged.");
  }
  if (canonical.heightCm && duplicate.heightCm && canonical.heightCm !== duplicate.heightCm) {
    warnings.push("Heights differ. The retained record's height will remain unchanged.");
  }
  warnings.push("Historical GameStat team IDs and stat values are preserved; only Player references are consolidated.");

  const canonicalSnapshotIds = new Set(canonicalSnapshotRows.map((row) => row.snapshotId));
  const collidingSnapshotRows = duplicateSnapshotRows.filter((row) => canonicalSnapshotIds.has(row.snapshotId)).length;
  const impact = {
    gameStats: duplicateStats.length,
    performanceScores,
    rosterAssignments: duplicateRosters.length,
    redundantRosterAssignments: redundantRosterAssignments.length,
    programHistory,
    profileSubmissions,
    profileClaims,
    claimProfile: duplicateClaimProfile ? 1 : 0,
    aliases,
    externalAliases,
    ratings,
    snapshotRows: duplicateSnapshotRows.length,
    collidingSnapshotRows,
  };

  const previewFingerprint = fingerprint({
    canonicalId: canonical.id,
    canonicalUpdatedAt: canonical.updatedAt.toISOString(),
    duplicateId: duplicate.id,
    duplicateUpdatedAt: duplicate.updatedAt.toISOString(),
    impact,
    sameGameCollisions,
    rosterConflicts,
    blockers,
  });

  return {
    canonical: serializePlayer(canonical),
    duplicate: serializePlayer(duplicate),
    impact,
    blockers,
    warnings,
    sameGameCollisions,
    rosterConflicts,
    canMerge: blockers.length === 0,
    fingerprint: previewFingerprint,
  };
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

async function buildMergedRatingTargets(canonicalPlayerId: string, duplicatePlayerId: string) {
  const playerIds = [canonicalPlayerId, duplicatePlayerId];
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

export async function executePlayerMerge(input: {
  canonicalPlayerId: string;
  duplicatePlayerId: string;
  expectedFingerprint: string;
  reason: string;
  userId: string;
}): Promise<PlayerMergeResult> {
  const preview = await buildPlayerMergePreview(input.canonicalPlayerId, input.duplicatePlayerId);
  if (!preview.canMerge) throw new Error(preview.blockers.join(" "));
  if (preview.fingerprint !== input.expectedFingerprint) {
    throw new Error("Player records changed after preview. Refresh and review the merge again.");
  }

  const ratingTargets = await buildMergedRatingTargets(input.canonicalPlayerId, input.duplicatePlayerId);
  const result = await prisma.$transaction(async (tx) => {
    const currentPlayers = await tx.player.findMany({
      where: { id: { in: [input.canonicalPlayerId, input.duplicatePlayerId] }, deletedAt: null },
      select: { id: true, displayName: true, gender: true },
    });
    if (currentPlayers.length !== 2) throw new Error("One of the Player records is no longer active.");

    const canonical = currentPlayers.find((row) => row.id === input.canonicalPlayerId)!;
    const duplicate = currentPlayers.find((row) => row.id === input.duplicatePlayerId)!;
    if (canonical.gender !== duplicate.gender) throw new Error("Players have different genders.");

    const [canonicalGameIds, duplicateGameIds] = await Promise.all([
      tx.gameStat.findMany({ where: { playerId: canonical.id }, select: { gameId: true } }),
      tx.gameStat.findMany({ where: { playerId: duplicate.id }, select: { gameId: true } }),
    ]);
    const canonicalGames = new Set(canonicalGameIds.map((row) => row.gameId));
    if (duplicateGameIds.some((row) => canonicalGames.has(row.gameId))) {
      throw new Error("A same-game GameStat collision appeared after preview. Merge cancelled.");
    }

    const [canonicalRosters, duplicateRosters] = await Promise.all([
      tx.playerTeamSeason.findMany({ where: { playerId: canonical.id }, select: { id: true, seasonId: true, teamId: true } }),
      tx.playerTeamSeason.findMany({ where: { playerId: duplicate.id }, select: { id: true, seasonId: true, teamId: true } }),
    ]);
    const canonicalRosterBySeason = new Map(canonicalRosters.map((row) => [row.seasonId, row]));
    const redundantRosterIds: string[] = [];
    const movableRosterIds: string[] = [];
    for (const roster of duplicateRosters) {
      const existing = canonicalRosterBySeason.get(roster.seasonId);
      if (!existing) movableRosterIds.push(roster.id);
      else if (existing.teamId === roster.teamId) redundantRosterIds.push(roster.id);
      else throw new Error("A same-season roster conflict appeared after preview. Merge cancelled.");
    }

    const canonicalSnapshotRows = await tx.rankingSnapshotRow.findMany({
      where: { playerId: canonical.id }, select: { snapshotId: true },
    });
    const canonicalSnapshotIds = new Set(canonicalSnapshotRows.map((row) => row.snapshotId));
    const duplicateSnapshotRows = await tx.rankingSnapshotRow.findMany({
      where: { playerId: duplicate.id }, select: { id: true, snapshotId: true },
    });
    const collidingSnapshotIds = duplicateSnapshotRows
      .filter((row) => canonicalSnapshotIds.has(row.snapshotId))
      .map((row) => row.id);
    const movableSnapshotIds = duplicateSnapshotRows
      .filter((row) => !canonicalSnapshotIds.has(row.snapshotId))
      .map((row) => row.id);

    const aliasOwner = await tx.playerAlias.findUnique({
      where: { aliasName_gender: { aliasName: duplicate.displayName, gender: duplicate.gender } },
      select: { id: true, playerId: true },
    });
    if (aliasOwner && aliasOwner.playerId !== canonical.id && aliasOwner.playerId !== duplicate.id) {
      throw new Error(`Alias ${duplicate.displayName} belongs to another Player record.`);
    }

    const aliasUpdate = await tx.playerAlias.updateMany({
      where: { playerId: duplicate.id }, data: { playerId: canonical.id },
    });
    if (!aliasOwner) {
      await tx.playerAlias.create({
        data: {
          playerId: canonical.id,
          aliasName: duplicate.displayName,
          gender: duplicate.gender,
          source: "admin-player-merge",
          note: `Former duplicate Player ${duplicate.id}`,
        },
      });
    }

    const externalAliasUpdate = await tx.playerExternalAlias.updateMany({
      where: { playerId: duplicate.id }, data: { playerId: canonical.id },
    });
    const gameStatUpdate = await tx.gameStat.updateMany({
      where: { playerId: duplicate.id }, data: { playerId: canonical.id },
    });
    const performanceUpdate = await tx.gamePerformanceScore.updateMany({
      where: { playerId: duplicate.id }, data: { playerId: canonical.id },
    });
    const historyUpdate = await tx.playerProgramHistory.updateMany({
      where: { playerId: duplicate.id }, data: { playerId: canonical.id },
    });
    const profileSubmissionUpdate = await tx.playerProfileSubmission.updateMany({
      where: { playerId: duplicate.id }, data: { playerId: canonical.id },
    });
    const claimUpdate = await tx.profileClaim.updateMany({
      where: { playerId: duplicate.id }, data: { playerId: canonical.id },
    });
    const duplicateClaimProfile = await tx.playerClaimProfile.findUnique({ where: { playerId: duplicate.id } });
    let claimProfileUpdated = 0;
    if (duplicateClaimProfile) {
      const canonicalClaimProfile = await tx.playerClaimProfile.findUnique({ where: { playerId: canonical.id } });
      if (canonicalClaimProfile) throw new Error("Both records have claimed-profile settings.");
      await tx.playerClaimProfile.update({ where: { playerId: duplicate.id }, data: { playerId: canonical.id } });
      claimProfileUpdated = 1;
    }

    const redundantRosterDelete = redundantRosterIds.length
      ? await tx.playerTeamSeason.deleteMany({ where: { id: { in: redundantRosterIds } } })
      : { count: 0 };
    const rosterUpdate = movableRosterIds.length
      ? await tx.playerTeamSeason.updateMany({ where: { id: { in: movableRosterIds } }, data: { playerId: canonical.id } })
      : { count: 0 };
    const snapshotDelete = collidingSnapshotIds.length
      ? await tx.rankingSnapshotRow.deleteMany({ where: { id: { in: collidingSnapshotIds } } })
      : { count: 0 };
    const snapshotUpdate = movableSnapshotIds.length
      ? await tx.rankingSnapshotRow.updateMany({ where: { id: { in: movableSnapshotIds } }, data: { playerId: canonical.id } })
      : { count: 0 };
    const ratingsDelete = await tx.playerRating.deleteMany({ where: { playerId: duplicate.id } });

    let ratingsUpdated = 0;
    for (const [policyVersionId, targets] of [
      [FORMULA_V1_POLICY_ID, ratingTargets.productionTargets],
      [FORMULA_TIER_NORMALIZED_V1_POLICY_ID, ratingTargets.tierTargets],
    ] as const) {
      for (const target of targets) {
        await tx.playerRating.upsert({
          where: {
            playerId_ageGroup_formulaVersionId_policyVersionId: {
              playerId: canonical.id,
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
            playerId: canonical.id,
            ageGroup: target.ageGroup,
            formulaVersionId: ratingTargets.formulaVersionId,
            policyVersionId,
            observedRating: target.observedRating,
            adjustedRating: target.adjustedRating,
            verifiedGameCount: target.verifiedGameCount,
            starRating: target.starRating,
          },
        });
        ratingsUpdated += 1;
      }
    }

    const archived = await tx.player.updateMany({
      where: { id: duplicate.id, deletedAt: null }, data: { deletedAt: new Date() },
    });
    if (archived.count !== 1) throw new Error("Duplicate Player could not be archived.");

    const result: PlayerMergeResult = {
      canonicalPlayerId: canonical.id,
      canonicalDisplayName: canonical.displayName,
      duplicatePlayerId: duplicate.id,
      duplicateDisplayName: duplicate.displayName,
      reassigned: {
        gameStats: gameStatUpdate.count,
        performanceScores: performanceUpdate.count,
        rosterAssignments: rosterUpdate.count,
        programHistory: historyUpdate.count,
        profileSubmissions: profileSubmissionUpdate.count,
        profileClaims: claimUpdate.count,
        claimProfile: claimProfileUpdated,
        aliases: aliasUpdate.count + (aliasOwner ? 0 : 1),
        externalAliases: externalAliasUpdate.count,
        snapshotRows: snapshotUpdate.count,
      },
      removedRedundant: {
        rosterAssignments: redundantRosterDelete.count,
        snapshotRows: snapshotDelete.count,
        ratings: ratingsDelete.count,
      },
      ratingsUpdated,
    };

    await tx.auditLog.create({
      data: {
        userId: input.userId,
        entityType: "PLAYER",
        entityId: canonical.id,
        action: "MERGE_DUPLICATE_PLAYER",
        reason: input.reason,
        previousData: {
          canonicalPlayerId: canonical.id,
          duplicatePlayerId: duplicate.id,
          previewFingerprint: input.expectedFingerprint,
        },
        newData: result,
      },
    });

    return result;
  }, { timeout: 60_000, maxWait: 10_000 });

  return result;
}
