/**
 * Post-DOB-Policy Board Validation Sweep — read-only.
 * Usage: npx tsx scripts/post-dob-policy-board-validation.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup, PlayerGender, RankingScope } from "@prisma/client";
import {
  buildEligibilityInput,
  evaluateEligibility,
  isPublicBoardRanked,
  isPublicBoardVisible,
  isPendingEligibilityExpired,
  PENDING_ELIGIBILITY_EXPIRY_DAYS,
  PENDING_POLICY_EFFECTIVE_DATE,
  resolveLaunchThreshold,
  shouldShowAgeUnverifiedBadge,
  type EligibilityBoard,
  type EligibilityVerdict
} from "../src/lib/eligibility";
import { getEffectiveClassYear } from "../src/lib/ranking-eligibility";
import { applyClassYearFilter, getRecruitingClassYearOptions } from "../src/lib/recruiting-class-filter";
import { RECRUITING_CLASS_FILTER_ENABLED } from "../src/lib/public-rankings-coverage";
import { getLatestNationalRankings, type RankingAgeGroup, type RankingGender } from "../src/lib/rankings";
import { getPublicBoardRows } from "../src/lib/public-board-ranks";
import { prisma } from "../src/lib/prisma";

const OUT_DIR = join(process.cwd(), "scripts", "reports");

const BOARDS: Array<{ ageGroup: RankingAgeGroup; gender: RankingGender }> = [
  { ageGroup: "U19", gender: "Boys" },
  { ageGroup: "U19", gender: "Girls" },
  { ageGroup: "U16", gender: "Boys" },
  { ageGroup: "U16", gender: "Girls" },
  { ageGroup: "U13", gender: "Boys" },
  { ageGroup: "U13", gender: "Girls" }
];

const PROJECTED: Record<string, { pool: number; verifiedRanked: number; pendingVisible: number; totalPublic: number; snapshotEligible: number }> = {
  "U19 Boys": { pool: 493, verifiedRanked: 59, pendingVisible: 175, totalPublic: 234, snapshotEligible: 59 },
  "U19 Girls": { pool: 56, verifiedRanked: 0, pendingVisible: 45, totalPublic: 45, snapshotEligible: 0 },
  "U16 Boys": { pool: 253, verifiedRanked: 7, pendingVisible: 108, totalPublic: 115, snapshotEligible: 7 },
  "U13 Boys": { pool: 136, verifiedRanked: 0, pendingVisible: 21, totalPublic: 21, snapshotEligible: 0 }
};

type PendingRow = {
  playerId: string;
  displayName: string;
  program: string;
  competitions: string[];
  games: number;
  rating: number;
  firstRankingEligibilityAt: string | null;
  daysUntilExpiry: number | null;
  expired: boolean;
};

function boardLabel(ageGroup: RankingAgeGroup, gender: RankingGender) {
  return `${ageGroup} ${gender}`;
}

function programFromPlayer(player: {
  currentProgram: { fullName: string } | null;
  rosterSeasons: Array<{ team: { program: { fullName: string } | null } }>;
}) {
  return player.currentProgram?.fullName ?? player.rosterSeasons[0]?.team.program?.fullName ?? "Unassigned";
}

function verdictKey(verdict: EligibilityVerdict) {
  if (verdict.verdict === "PROVISIONAL" && verdict.provisionalReason) return `P* ${verdict.provisionalReason}`;
  if (verdict.exclusionReason) return `P* ${verdict.exclusionReason}`;
  return verdict.verdict;
}

function delta(actual: number, expected: number) {
  return { actual, expected, delta: actual - expected, match: actual === expected };
}

async function loadRatings(ageGroup: AgeGroup, gender: PlayerGender) {
  return prisma.playerRating.findMany({
    where: { ageGroup, player: { gender, deletedAt: null } },
    include: {
      player: {
        select: {
          id: true,
          displayName: true,
          gender: true,
          birthDate: true,
          firstRankingEligibilityAt: true,
          classYearOverride: true,
          ageGroupOverride: true,
          currentProgram: { select: { fullName: true } },
          rosterSeasons: {
            where: { deletedAt: null },
            take: 1,
            orderBy: { createdAt: "desc" },
            include: { team: { select: { program: { select: { fullName: true } } } } }
          },
          gameStats: {
            where: { deletedAt: null },
            include: {
              game: {
                select: {
                  season: {
                    select: {
                      league: { select: { name: true } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });
}

function competitionsFromPlayer(gameStats: Array<{ game: { season: { league: { name: string } } | null } | null }>) {
  const names = new Set<string>();
  for (const stat of gameStats) {
    const name = stat.game?.season?.league?.name;
    if (name) names.add(name);
  }
  return [...names].sort();
}

async function main() {
  const generatedAt = new Date().toISOString();
  const evaluationDate = new Date();

  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: 1 },
    select: { id: true }
  });
  const formulaVersionId = formulaVersion?.id ?? null;

  const rankings = await getLatestNationalRankings();
  const boardCounts: Array<Record<string, unknown>> = [];
  const pendingByBoard: Array<Record<string, unknown>> = [];
  const badgeViolations: Array<Record<string, unknown>> = [];
  const verdictDistribution: Array<Record<string, unknown>> = [];
  const allPendingRows: PendingRow[] = [];

  for (const { ageGroup, gender } of BOARDS) {
    const label = boardLabel(ageGroup, gender);
    const genderEnum = gender === "Girls" ? PlayerGender.GIRLS : PlayerGender.BOYS;
    const genderKey = gender === "Girls" ? "girls" : "boys";
    const snapshot = rankings.snapshotsByAge[ageGroup][genderKey];
    const publicRows = getPublicBoardRows(snapshot);

    let verifiedRanked = 0;
    let pendingVisible = 0;
    let snapshotEligible = 0;
    let snapshotEligibleViolations = 0;
    const blockers: Record<string, number> = {};

    for (const row of snapshot.rows) {
      const v = row.eligibilityVerdict;
      const reason = verdictKey(v);
      if (v.verdict !== "RANKED") blockers[reason] = (blockers[reason] ?? 0) + 1;

      if (isPublicBoardRanked(v)) verifiedRanked += 1;
      if (v.ageVerificationStatus === "PENDING" && isPublicBoardVisible(v)) pendingVisible += 1;
      if (v.snapshotEligible) snapshotEligible += 1;
      if (v.ageVerificationStatus === "PENDING" && v.snapshotEligible) snapshotEligibleViolations += 1;

      const badgeExpected = shouldShowAgeUnverifiedBadge(v);
      const badgeActual = v.ageVerificationStatus === "PENDING" && v.publicRankAllowed;
      if (badgeExpected !== badgeActual) {
        badgeViolations.push({
          board: label,
          playerId: row.playerId,
          displayName: row.displayName,
          ageVerificationStatus: v.ageVerificationStatus,
          publicRankAllowed: v.publicRankAllowed,
          badgeExpected,
          badgeActual
        });
      }
      if (v.ageVerificationStatus === "VERIFIED" && badgeExpected) {
        badgeViolations.push({
          board: label,
          playerId: row.playerId,
          displayName: row.displayName,
          issue: "VERIFIED player would show Age Unverified badge",
          ageVerificationStatus: v.ageVerificationStatus,
          publicRankAllowed: v.publicRankAllowed
        });
      }
      if (v.ageVerificationStatus === "PENDING" && isPublicBoardVisible(v) && !badgeExpected) {
        badgeViolations.push({
          board: label,
          playerId: row.playerId,
          displayName: row.displayName,
          issue: "PENDING public player missing Age Unverified badge",
          ageVerificationStatus: v.ageVerificationStatus,
          publicRankAllowed: v.publicRankAllowed
        });
      }
    }

    const actual = {
      pool: snapshot.rows.length,
      verifiedRanked,
      pendingVisible,
      totalPublic: publicRows.length,
      snapshotEligible
    };

    const projected = PROJECTED[label];
    boardCounts.push({
      board: label,
      actual,
      projected: projected ?? null,
      variance: projected
        ? {
            pool: delta(actual.pool, projected.pool),
            verifiedRanked: delta(actual.verifiedRanked, projected.verifiedRanked),
            pendingVisible: delta(actual.pendingVisible, projected.pendingVisible),
            totalPublic: delta(actual.totalPublic, projected.totalPublic),
            snapshotEligible: delta(actual.snapshotEligible, projected.snapshotEligible)
          }
        : null,
      snapshotEligibleViolations,
      topBlockers: Object.entries(blockers)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([reason, count]) => ({ reason, count }))
    });

    verdictDistribution.push({
      board: label,
      publicBoardRows: publicRows.length,
      verifiedRanked,
      pendingVisible,
      blockers
    });

    const ratings = await loadRatings(ageGroup as AgeGroup, genderEnum);
    const pendingRows: PendingRow[] = [];
    const byProgram: Record<string, number> = {};
    const byCompetition: Record<string, number> = {};

    for (const rating of ratings) {
      const verdict = evaluateEligibility(
        buildEligibilityInput({
          playerId: rating.playerId,
          gender: rating.player.gender,
          birthDate: rating.player.birthDate,
          firstRankingEligibilityAt: rating.player.firstRankingEligibilityAt,
          classYearOverride: rating.player.classYearOverride,
          ageGroupOverride: rating.player.ageGroupOverride,
          ratingAgeGroup: rating.ageGroup as EligibilityBoard,
          verifiedGameCount: rating.verifiedGameCount,
          evaluatedBoard: ageGroup,
          formulaVersionId
        })
      );

      if (verdict.ageVerificationStatus !== "PENDING" || !isPublicBoardVisible(verdict)) continue;

      const program = programFromPlayer(rating.player);
      const competitions = competitionsFromPlayer(rating.player.gameStats);
      byProgram[program] = (byProgram[program] ?? 0) + 1;
      for (const comp of competitions.length ? competitions : ["Unknown competition"]) {
        byCompetition[comp] = (byCompetition[comp] ?? 0) + 1;
      }

      const clockStart = rating.player.firstRankingEligibilityAt ?? PENDING_POLICY_EFFECTIVE_DATE;
      const expiresAt = new Date(clockStart);
      expiresAt.setUTCDate(expiresAt.getUTCDate() + PENDING_ELIGIBILITY_EXPIRY_DAYS);
      const daysUntilExpiry = Math.ceil((expiresAt.getTime() - evaluationDate.getTime()) / (1000 * 60 * 60 * 24));
      const expired = isPendingEligibilityExpired(rating.player.firstRankingEligibilityAt, evaluationDate);

      pendingRows.push({
        playerId: rating.playerId,
        displayName: rating.player.displayName,
        program,
        competitions,
        games: rating.verifiedGameCount,
        rating: Number(rating.adjustedRating),
        firstRankingEligibilityAt: rating.player.firstRankingEligibilityAt?.toISOString() ?? null,
        daysUntilExpiry: expired ? 0 : daysUntilExpiry,
        expired
      });
      allPendingRows.push({ ...pendingRows[pendingRows.length - 1], competitions });
    }

    pendingByBoard.push({
      board: label,
      pendingVisible: pendingRows.length,
      expiredOnBoard: pendingRows.filter((r) => r.expired).length,
      byProgram: Object.entries(byProgram)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([program, count]) => ({ program, count })),
      byCompetition: Object.entries(byCompetition)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([competition, count]) => ({ competition, count }))
    });
  }

  const snapshots = await prisma.rankingSnapshot.findMany({
    where: { formulaVersionId: formulaVersionId ?? undefined, scope: RankingScope.NATIONAL, city: null, region: null },
    include: {
      rows: {
        include: {
          player: {
            select: {
              id: true,
              displayName: true,
              birthDate: true,
              firstRankingEligibilityAt: true,
              classYearOverride: true,
              deletedAt: true
            }
          }
        }
      }
    },
    orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }]
  });

  const latestSnapshotByBoard = new Map<string, (typeof snapshots)[number]>();
  for (const snap of snapshots) {
    if (!snap.ageGroup) continue;
    const key = `${snap.ageGroup}|${snap.gender}`;
    if (!latestSnapshotByBoard.has(key)) latestSnapshotByBoard.set(key, snap);
  }

  const snapshotProtection: Array<Record<string, unknown>> = [];
  let pendingInSnapshotRows = 0;
  let snapshotMutationEvidence = 0;

  for (const [key, snap] of latestSnapshotByBoard) {
    const [ageGroup, gender] = key.split("|") as [AgeGroup, PlayerGender];
    const pendingPlayersInSnapshot: string[] = [];
    const notSnapshotEligibleInSnapshot: string[] = [];

    for (const row of snap.rows) {
      if (!row.player || row.player.deletedAt) continue;
      const rating = await prisma.playerRating.findUnique({
        where: { playerId_ageGroup: { playerId: row.playerId, ageGroup } },
        select: { ageGroup: true, verifiedGameCount: true }
      });
      if (!rating) continue;

      const verdict = evaluateEligibility(
        buildEligibilityInput({
          playerId: row.playerId,
          gender,
          birthDate: row.player.birthDate,
          firstRankingEligibilityAt: row.player.firstRankingEligibilityAt,
          classYearOverride: row.player.classYearOverride,
          ageGroupOverride: null,
          ratingAgeGroup: ageGroup as EligibilityBoard,
          verifiedGameCount: rating.verifiedGameCount,
          evaluatedBoard: ageGroup as EligibilityBoard,
          formulaVersionId,
          evaluationDate: snap.weekOf
        })
      );

      if (!row.player.birthDate) pendingPlayersInSnapshot.push(row.playerId);
      if (!verdict.snapshotEligible) notSnapshotEligibleInSnapshot.push(row.playerId);
    }

    pendingInSnapshotRows += pendingPlayersInSnapshot.length;
    snapshotProtection.push({
      board: `${ageGroup} ${gender === PlayerGender.GIRLS ? "Girls" : "Boys"}`,
      snapshotId: snap.id,
      weekOf: snap.weekOf.toISOString(),
      rowCount: snap.rows.length,
      pendingNoDobInSnapshot: pendingPlayersInSnapshot.length,
      notSnapshotEligibleInSnapshot: notSnapshotEligibleInSnapshot.length,
      createdAt: snap.createdAt.toISOString()
    });
  }

  const recentSnapshots = await prisma.rankingSnapshot.findMany({
    where: {
      formulaVersionId: formulaVersionId ?? undefined,
      scope: RankingScope.NATIONAL,
      createdAt: { gte: PENDING_POLICY_EFFECTIVE_DATE }
    },
    select: { id: true, ageGroup: true, gender: true, weekOf: true, createdAt: true, _count: { select: { rows: true } } },
    orderBy: { createdAt: "desc" }
  });
  snapshotMutationEvidence = recentSnapshots.length;

  const u19BoysSnapshot = rankings.snapshotsByAge.U19.boys;
  const u19PublicRows = getPublicBoardRows(u19BoysSnapshot);
  const u19PendingUnknownClass = u19PublicRows.filter((r) => r.effectiveClassYear === null && r.eligibilityVerdict.ageVerificationStatus === "PENDING");
  const u19VerifiedUnknownClass = u19PublicRows.filter((r) => r.effectiveClassYear === null && r.eligibilityVerdict.ageVerificationStatus === "VERIFIED");

  const classFilter2027 = applyClassYearFilter(u19PublicRows, { classYear: 2027, includeUnknownClass: false });
  const classFilter2027WithUnknown = applyClassYearFilter(u19PublicRows, { classYear: 2027, includeUnknownClass: true });
  const recruitingOptions = getRecruitingClassYearOptions(u19PublicRows);

  const ag4Compatibility = {
    recruitingClassFilterEnabled: RECRUITING_CLASS_FILTER_ENABLED,
    u19BoysPublicTotal: u19PublicRows.length,
    pendingWithUnknownClass: u19PendingUnknownClass.length,
    verifiedWithUnknownClass: u19VerifiedUnknownClass.length,
    classFilter2027ExcludesUnknown: u19PublicRows.length - classFilter2027.length,
    classFilter2027WithUnknownRetainsPending:
      classFilter2027WithUnknown.filter((r) => r.eligibilityVerdict.ageVerificationStatus === "PENDING").length,
    recruitingClassYearChipCount: recruitingOptions.length,
    unknownClassExcludedByDefault: u19PublicRows.filter((r) => r.effectiveClassYear === null).length,
    vAg410PendingVisibleWithIncludeUnknown: classFilter2027WithUnknown.some(
      (r) => r.eligibilityVerdict.ageVerificationStatus === "PENDING" && r.effectiveClassYear === null
    )
  };

  const u16Boys = boardCounts.find((b) => b.board === "U16 Boys") as { actual: { totalPublic: number; verifiedRanked: number; pendingVisible: number; pool: number } };
  const u16Girls = boardCounts.find((b) => b.board === "U16 Girls") as { actual: { totalPublic: number; verifiedRanked: number; pool: number } };
  const u13Boys = boardCounts.find((b) => b.board === "U13 Boys") as { actual: { totalPublic: number; verifiedRanked: number; pool: number } };
  const u13Girls = boardCounts.find((b) => b.board === "U13 Girls") as { actual: { totalPublic: number; pool: number } };

  const u16Readiness = {
    boys: {
      ratingPool: u16Boys?.actual.pool ?? 0,
      publicTotal: u16Boys?.actual.totalPublic ?? 0,
      verifiedRanked: u16Boys?.actual.verifiedRanked ?? 0,
      pendingVisible: u16Boys?.actual.pendingVisible ?? 0,
      prePolicyPublicRanked: 7,
      postPolicyPublicTotal: u16Boys?.actual.totalPublic ?? 0,
      ag3MinimumVerifiedRanked: 25,
      ag3SoftGateVerifiedRanked: 50,
      ag3MinimumPublicTotalWithPending: 25,
      meetsVerifiedRankedGate: (u16Boys?.actual.verifiedRanked ?? 0) >= 25,
      meetsPublicTotalGate: (u16Boys?.actual.totalPublic ?? 0) >= 25,
      meetsPublicSoftGate: (u16Boys?.actual.totalPublic ?? 0) >= 50,
      recommendation: "" as string,
      comingSoonAppropriate: true
    },
    girls: {
      ratingPool: u16Girls?.actual.pool ?? 0,
      publicTotal: u16Girls?.actual.totalPublic ?? 0,
      verifiedRanked: u16Girls?.actual.verifiedRanked ?? 0,
      recommendation: "" as string,
      comingSoonAppropriate: true
    }
  };

  if (u16Readiness.boys.meetsPublicTotalGate && !u16Readiness.boys.meetsVerifiedRankedGate) {
    u16Readiness.boys.recommendation =
      "CONDITIONAL — public depth OK post-DOB policy (115 target) but only 7 VERIFIED RANKED; Coming Soon removable only with Age Unverified disclosure and PO sign-off";
    u16Readiness.boys.comingSoonAppropriate = false;
  } else if (!u16Readiness.boys.meetsPublicTotalGate) {
    u16Readiness.boys.recommendation = "BLOCK — insufficient public board depth even with PENDING path";
    u16Readiness.boys.comingSoonAppropriate = true;
  } else {
    u16Readiness.boys.recommendation = "READY (verified depth) — meets verified RANKED gate";
    u16Readiness.boys.comingSoonAppropriate = false;
  }

  if ((u16Girls?.actual.pool ?? 0) === 0) {
    u16Readiness.girls.recommendation = "HARD BLOCK — zero rating pool; Coming Soon required";
    u16Readiness.girls.comingSoonAppropriate = true;
  } else if ((u16Girls?.actual.totalPublic ?? 0) < 15) {
    u16Readiness.girls.recommendation = "BLOCK — insufficient public depth";
    u16Readiness.girls.comingSoonAppropriate = true;
  } else {
    u16Readiness.girls.recommendation = "REVIEW — pool exists; validate verified vs pending mix";
    u16Readiness.girls.comingSoonAppropriate = false;
  }

  const u13Readiness = {
    boys: {
      ratingPool: u13Boys?.actual.pool ?? 0,
      publicTotal: u13Boys?.actual.totalPublic ?? 0,
      verifiedRanked: u13Boys?.actual.verifiedRanked ?? 0,
      agPlanMinimumPublic: 30,
      meetsAgPlanMinimum: (u13Boys?.actual.totalPublic ?? 0) >= 30,
      meetsVerifiedMinimum: (u13Boys?.actual.verifiedRanked ?? 0) >= 30,
      recommendation: "" as string,
      comingSoonAppropriate: true
    },
    girls: {
      ratingPool: u13Girls?.actual.pool ?? 0,
      publicTotal: u13Girls?.actual.totalPublic ?? 0,
      recommendation: "BLOCK — no material Girls U13 evidence",
      comingSoonAppropriate: true
    }
  };

  if (u13Readiness.boys.meetsAgPlanMinimum) {
    u13Readiness.boys.recommendation = "REVIEW — meets AG plan public minimum with PENDING; verify DOB coverage before launch";
    u13Readiness.boys.comingSoonAppropriate = false;
  } else {
    u13Readiness.boys.recommendation = `BLOCK — ${u13Boys?.actual.totalPublic ?? 0} public rows vs AG plan ≥30 minimum`;
    u13Readiness.boys.comingSoonAppropriate = true;
  }

  const nearExpiry = allPendingRows
    .filter((r) => !r.expired && r.daysUntilExpiry !== null && r.daysUntilExpiry <= 90)
    .sort((a, b) => (a.daysUntilExpiry ?? 999) - (b.daysUntilExpiry ?? 365))
    .slice(0, 20);

  const expiredButVisible = allPendingRows.filter((r) => r.expired);
  const thresholdGaps = await buildThresholdGaps(formulaVersionId);
  const trustEdgeCases = await buildTrustEdgeCases(formulaVersionId);

  const blockers: string[] = [];
  for (const bc of boardCounts) {
    const v = bc.variance as Record<string, { match: boolean; delta: number }> | null;
    if (v && !v.totalPublic?.match) {
      blockers.push(`${bc.board}: totalPublic delta ${v.totalPublic.delta} (actual vs projected)`);
    }
  }
  if (badgeViolations.length > 0) blockers.push(`Badge integrity: ${badgeViolations.length} violations`);
  if (pendingInSnapshotRows > 0) blockers.push(`Snapshot protection: ${pendingInSnapshotRows} no-DOB players in persisted snapshots`);
  if (expiredButVisible.length > 0) blockers.push(`Expiration: ${expiredButVisible.length} expired PENDING still visible`);
  if ((u16Girls?.actual.pool ?? 0) === 0) blockers.push("U16 Girls: zero rating pool");

  const report = {
    generatedAt,
    mode: "read-only",
    policyEffectiveDate: PENDING_POLICY_EFFECTIVE_DATE.toISOString(),
    formulaVersionId,
    summary: {
      boardsValidated: boardCounts.length,
      projectedBoardsMatched: boardCounts.filter((b) => {
        const v = b.variance as { totalPublic?: { match: boolean } } | null;
        return v?.totalPublic?.match ?? false;
      }).length,
      totalPendingVisible: allPendingRows.length,
      badgeViolationCount: badgeViolations.length,
      pendingInSnapshotRows,
      snapshotMutationsSincePolicy: snapshotMutationEvidence,
      blockers
    },
    boardCounts,
    pendingByBoard,
    badgeIntegrity: {
      violationCount: badgeViolations.length,
      violations: badgeViolations.slice(0, 50),
      rule: "PENDING + publicRankAllowed → badge; VERIFIED → no badge"
    },
    snapshotProtection: {
      pendingInSnapshotRows,
      snapshotMutationsSincePolicy: recentSnapshots,
      perBoard: snapshotProtection,
      codePathExcludesPending: "g3-ranking-snapshot-regeneration.ts filters verdict.snapshotEligible"
    },
    ag4Compatibility,
    u16Readiness,
    u13Readiness,
    topAnomalies: {
      countVariance: boardCounts
        .filter((b) => {
          const v = b.variance as { totalPublic?: { delta: number } } | null;
          return v && v.totalPublic && Math.abs(v.totalPublic.delta) > 0;
        })
        .map((b) => ({ board: b.board, variance: b.variance })),
      nearExpiry,
      expiredButVisible: expiredButVisible.slice(0, 20),
      thresholdGaps: thresholdGaps.slice(0, 25),
      trustEdgeCases: trustEdgeCases.slice(0, 25),
      rankGaps: buildRankGaps(rankings)
    },
    verdictDistribution
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, `post-dob-policy-board-validation-${generatedAt.replace(/[:.]/g, "-")}.json`);
  const latestPath = join(OUT_DIR, "post-dob-policy-board-validation-latest.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  writeFileSync(latestPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify({ outPath, latestPath, summary: report.summary }, null, 2));
}

async function buildThresholdGaps(formulaVersionId: string | null) {
  const gaps: Array<{ board: string; playerId: string; name: string; games: number; gamesShort: number }> = [];
  for (const ageGroup of [AgeGroup.U19, AgeGroup.U16, AgeGroup.U13]) {
    const ratings = await prisma.playerRating.findMany({
      where: { ageGroup, player: { deletedAt: null } },
      include: { player: { select: { id: true, displayName: true, gender: true, birthDate: true, firstRankingEligibilityAt: true, classYearOverride: true, ageGroupOverride: true } } }
    });
    for (const rating of ratings) {
      const threshold = resolveLaunchThreshold(rating.player.gender);
      const short = threshold - rating.verifiedGameCount;
      if (short < 1 || short > 2) continue;
      gaps.push({
        board: `${ageGroup} ${rating.player.gender === PlayerGender.GIRLS ? "Girls" : "Boys"}`,
        playerId: rating.playerId,
        name: rating.player.displayName,
        games: rating.verifiedGameCount,
        gamesShort: short
      });
    }
  }
  return gaps.sort((a, b) => a.gamesShort - b.gamesShort || b.games - a.games);
}

async function buildTrustEdgeCases(formulaVersionId: string | null) {
  const cases: Array<{ playerId: string; name: string; board: string; issue: string }> = [];
  const ratings = await prisma.playerRating.findMany({
    where: { player: { deletedAt: null, birthDate: null } },
    include: { player: { select: { id: true, displayName: true, gender: true, birthDate: true, firstRankingEligibilityAt: true, classYearOverride: true, ageGroupOverride: true } } },
    take: 2000
  });

  for (const rating of ratings) {
    const board = rating.ageGroup as EligibilityBoard;
    const base = buildEligibilityInput({
      playerId: rating.playerId,
      gender: rating.player.gender,
      birthDate: null,
      firstRankingEligibilityAt: rating.player.firstRankingEligibilityAt,
      classYearOverride: rating.player.classYearOverride,
      ageGroupOverride: rating.player.ageGroupOverride,
      ratingAgeGroup: board,
      verifiedGameCount: rating.verifiedGameCount,
      evaluatedBoard: board,
      formulaVersionId
    });

    const standard = evaluateEligibility({ ...base, competitionTrustLevel: "STANDARD" });
    const untrusted = evaluateEligibility({ ...base, competitionTrustLevel: "UNTRUSTED" });
    const escalated = evaluateEligibility({ ...base, dobEscalationTier: 2 });

    if (isPublicBoardVisible(standard) && !isPublicBoardVisible(untrusted)) {
      cases.push({
        playerId: rating.playerId,
        name: rating.player.displayName,
        board: `${board} ${rating.player.gender}`,
        issue: "Would hide if UNTRUSTED (P11)"
      });
    }
    if (isPublicBoardVisible(standard) && !isPublicBoardVisible(escalated)) {
      cases.push({
        playerId: rating.playerId,
        name: rating.player.displayName,
        board: `${board} ${rating.player.gender}`,
        issue: "Would hide if dobEscalationTier≥2 (P13)"
      });
    }
  }
  return cases;
}

function buildRankGaps(rankings: Awaited<ReturnType<typeof getLatestNationalRankings>>) {
  const gaps: Array<{ board: string; publicCount: number; rankGaps: number[] }> = [];
  for (const { ageGroup, gender } of BOARDS) {
    if (!PROJECTED[boardLabel(ageGroup, gender)]) continue;
    const genderKey = gender === "Girls" ? "girls" : "boys";
    const rows = getPublicBoardRows(rankings.snapshotsByAge[ageGroup][genderKey]);
    const ranks = rows.map((r) => r.rank);
    const missing: number[] = [];
    if (ranks.length > 1) {
      for (let i = 1; i < ranks.length; i++) {
        const prev = ranks[i - 1];
        const curr = ranks[i];
        for (let g = prev + 1; g < curr; g++) missing.push(g);
      }
    }
    if (missing.length > 0) {
      gaps.push({ board: boardLabel(ageGroup, gender), publicCount: rows.length, rankGaps: missing.slice(0, 15) });
    }
  }
  return gaps;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
