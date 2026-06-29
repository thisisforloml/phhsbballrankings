/**
 * Rankings Operations Sweep — read-only master operational dashboard.
 * Usage: npx tsx scripts/generate-rankings-operations-dashboard.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup, PlayerGender, SubmissionStatus } from "@prisma/client";
import {
  buildEligibilityInput,
  evaluateEligibility,
  resolveLaunchThreshold,
  type EligibilityBoard,
  type EligibilityVerdict
} from "../src/lib/eligibility";
import { getEffectiveClassYear } from "../src/lib/ranking-eligibility";
import { getRecruitingClassYearOptions } from "../src/lib/recruiting-class-filter";
import { RECRUITING_CLASS_FILTER_ENABLED } from "../src/lib/public-rankings-coverage";
import { getLatestNationalRankings, type RankingAgeGroup, type RankingGender } from "../src/lib/rankings";
import { getPublicBoardRows } from "../src/lib/public-board-ranks";
import { prisma } from "../src/lib/prisma";
import { safeParseSubmissionJson } from "../src/lib/submission-json";

const OUT_DIR = join(process.cwd(), "docs", "planning", "audits");
const BOARDS: Array<{ ageGroup: RankingAgeGroup; gender: RankingGender }> = [
  { ageGroup: "U19", gender: "Boys" },
  { ageGroup: "U19", gender: "Girls" },
  { ageGroup: "U16", gender: "Boys" },
  { ageGroup: "U16", gender: "Girls" },
  { ageGroup: "U13", gender: "Boys" },
  { ageGroup: "U13", gender: "Girls" }
];

type DobRow = {
  playerId: string;
  name: string;
  program: string;
  games: number;
  rating: number;
  priorityScore: number;
  board: string;
};

type ThresholdRow = {
  playerId: string;
  player: string;
  program: string;
  games: number;
  gamesShort: number;
  board: string;
  projectedGain: string;
  roiScore: number;
};

type DuplicatePlayerCluster = {
  clusterId: string;
  names: string[];
  playerIds: string[];
  matchType: "exact" | "fuzzy";
  confidence: "high" | "medium" | "low";
  sharedTeams: string[];
  sharedCompetitions: string[];
  overlappingStats: number;
  recommendation: string;
};

type DuplicateProgramGroup = {
  normalizedName: string;
  programs: Array<{
    id: string;
    fullName: string;
    teams: number;
    players: number;
    gameStats: number;
    isEmptyShell: boolean;
    isActiveShell: boolean;
  }>;
  matchType: "exact" | "normalization";
  recommendation: string;
};

function normalizeName(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function lastNameKey(value: string) {
  const parts = value.trim().split(/\s+/);
  return parts[parts.length - 1] ?? value;
}

function blockingReason(verdict: EligibilityVerdict): string {
  if (verdict.verdict === "PROVISIONAL" && verdict.provisionalReason) {
    return `P* ${verdict.provisionalReason}`;
  }
  if (verdict.exclusionReason) {
    return `P* ${verdict.exclusionReason}`;
  }
  return verdict.verdict;
}

function programFromPlayer(player: {
  currentProgram: { fullName: string } | null;
  rosterSeasons: Array<{ team: { name: string; program: { fullName: string } | null } }>;
}) {
  return (
    player.currentProgram?.fullName ??
    player.rosterSeasons[0]?.team.program?.fullName ??
    "Unassigned"
  );
}

async function loadRatingsWithPlayers(ageGroup: AgeGroup) {
  return prisma.playerRating.findMany({
    where: { ageGroup, player: { deletedAt: null } },
    include: {
      player: {
        select: {
          id: true,
          displayName: true,
          gender: true,
          birthDate: true,
          classYearOverride: true,
          ageGroupOverride: true,
          currentProgram: { select: { fullName: true } },
          rosterSeasons: {
            where: { deletedAt: null },
            take: 1,
            orderBy: { createdAt: "desc" },
            include: { team: { select: { name: true, program: { select: { fullName: true } } } } }
          }
        }
      }
    }
  });
}

async function buildBoardHealth(formulaVersionId: string | null) {
  const rankings = await getLatestNationalRankings();
  const boards = [];

  for (const { ageGroup, gender } of BOARDS) {
    const genderKey = gender === "Girls" ? "girls" : "boys";
    const snapshot = rankings.snapshotsByAge[ageGroup][genderKey];
    const boardRows = getPublicBoardRows(snapshot);

    const verdictCounts = { RANKED: 0, PROVISIONAL: 0, HIDDEN: 0, FORMER: 0 };
    const blockers: Record<string, number> = {};

    for (const row of snapshot.rows) {
      const v = row.eligibilityVerdict.verdict;
      verdictCounts[v] += 1;
      if (v !== "RANKED") {
        const reason = blockingReason(row.eligibilityVerdict);
        blockers[reason] = (blockers[reason] ?? 0) + 1;
      }
    }

    const pool = snapshot.rows.length;
    const ranked = boardRows.length;
    const yieldPct = pool > 0 ? Math.round((ranked / pool) * 1000) / 10 : 0;

    const topBlockers = Object.entries(blockers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count }));

    boards.push({
      board: `${ageGroup} ${gender}`,
      ageGroup,
      gender,
      ratingPool: pool,
      RANKED: verdictCounts.RANKED,
      PROVISIONAL: verdictCounts.PROVISIONAL,
      HIDDEN: verdictCounts.HIDDEN,
      FORMER: verdictCounts.FORMER,
      publicBoardRanked: ranked,
      boardYieldPct: yieldPct,
      topBlockingVerdicts: topBlockers,
      formulaVersionId
    });
  }

  return boards;
}

async function buildDobRemediation(formulaVersionId: string | null) {
  async function forBoard(ageGroup: AgeGroup, label: string, genderFilter?: PlayerGender) {
    const ratings = await loadRatingsWithPlayers(ageGroup);
    const rows: DobRow[] = [];

    for (const rating of ratings) {
      if (genderFilter && rating.player.gender !== genderFilter) continue;

      const verdict = evaluateEligibility(
        buildEligibilityInput({
          playerId: rating.playerId,
          gender: rating.player.gender,
          birthDate: rating.player.birthDate,
          classYearOverride: rating.player.classYearOverride,
          ageGroupOverride: rating.player.ageGroupOverride,
          ratingAgeGroup: ageGroup as EligibilityBoard,
          verifiedGameCount: rating.verifiedGameCount,
          evaluatedBoard: ageGroup as EligibilityBoard,
          formulaVersionId
        })
      );

      if (verdict.provisionalReason !== "UNKNOWN_DOB") continue;

      const games = rating.verifiedGameCount;
      const ratingVal = Number(rating.adjustedRating);
      const threshold = resolveLaunchThreshold(rating.player.gender);
      const priorityScore = Math.round(games * (ratingVal / 100) * (games / threshold) * 100) / 100;

      rows.push({
        playerId: rating.playerId,
        name: rating.player.displayName,
        program: programFromPlayer(rating.player),
        games,
        rating: ratingVal,
        priorityScore,
        board: label
      });
    }

    return rows.sort((a, b) => b.priorityScore - a.priorityScore || b.games - a.games);
  }

  const [u19Girls, u19Boys, u16All] = await Promise.all([
    forBoard(AgeGroup.U19, "U19 Girls", PlayerGender.GIRLS),
    forBoard(AgeGroup.U19, "U19 Boys", PlayerGender.BOYS),
    forBoard(AgeGroup.U16, "U16")
  ]);

  return { u19GirlsP12: u19Girls, u19BoysP12: u19Boys, u16P12: u16All };
}

async function buildThresholdRemediation(formulaVersionId: string | null) {
  const ageGroups: AgeGroup[] = [AgeGroup.U19, AgeGroup.U16, AgeGroup.U13];
  const byShort: Record<1 | 2 | 3 | 4, ThresholdRow[]> = { 1: [], 2: [], 3: [], 4: [] };

  for (const ageGroup of ageGroups) {
    const ratings = await loadRatingsWithPlayers(ageGroup);
    for (const rating of ratings) {
      const threshold = resolveLaunchThreshold(rating.player.gender);
      const gamesShort = threshold - rating.verifiedGameCount;
      if (gamesShort < 1 || gamesShort > 4) continue;

      const verdict = evaluateEligibility(
        buildEligibilityInput({
          playerId: rating.playerId,
          gender: rating.player.gender,
          birthDate: rating.player.birthDate,
          classYearOverride: rating.player.classYearOverride,
          ageGroupOverride: rating.player.ageGroupOverride,
          ratingAgeGroup: ageGroup as EligibilityBoard,
          verifiedGameCount: rating.verifiedGameCount,
          evaluatedBoard: ageGroup as EligibilityBoard,
          formulaVersionId
        })
      );

      if (verdict.provisionalReason !== "BELOW_THRESHOLD") continue;

      const genderLabel = rating.player.gender === PlayerGender.GIRLS ? "Girls" : "Boys";
      const board = `${ageGroup} ${genderLabel}`;
      const hasDob = Boolean(rating.player.birthDate);
      const projectedGain = hasDob
        ? `+1 RANKED on ${board} after ${gamesShort} verified game(s)`
        : `Threshold met but DOB still required for ${board}`;

      const roiScore = Math.round((rating.verifiedGameCount / threshold) * 1000) / 10;

      byShort[gamesShort as 1 | 2 | 3 | 4].push({
        playerId: rating.playerId,
        player: rating.player.displayName,
        program: programFromPlayer(rating.player),
        games: rating.verifiedGameCount,
        gamesShort,
        board,
        projectedGain,
        roiScore
      });
    }
  }

  for (const key of [1, 2, 3, 4] as const) {
    byShort[key].sort((a, b) => b.roiScore - a.roiScore || b.games - a.games);
  }

  return {
    oneGameShort: byShort[1],
    twoGamesShort: byShort[2],
    threeGamesShort: byShort[3],
    fourGamesShort: byShort[4]
  };
}

async function buildDuplicatePlayers(): Promise<DuplicatePlayerCluster[]> {
  const players = await prisma.player.findMany({
    where: { deletedAt: null, gameStats: { some: { deletedAt: null } } },
    select: {
      id: true,
      displayName: true,
      gender: true,
      gameStats: {
        where: { deletedAt: null },
        select: {
          id: true,
          teamId: true,
          gameId: true,
          team: { select: { name: true } },
          game: { select: { season: { select: { league: { select: { name: true } } } } } }
        }
      }
    }
  });

  const clusters: DuplicatePlayerCluster[] = [];
  const seen = new Set<string>();

  function clusterKey(ids: string[]) {
    return ids.sort().join("|");
  }

  function buildCluster(group: typeof players, matchType: "exact" | "fuzzy", confidence: "high" | "medium" | "low") {
    const key = clusterKey(group.map((p) => p.id));
    if (seen.has(key) || group.length < 2) return;
    seen.add(key);

    const teamSets = group.map((p) => new Set(p.gameStats.map((s) => s.team?.name ?? s.teamId)));
    const sharedTeams = [...teamSets[0]].filter((t) => teamSets.every((s) => s.has(t)));

    const compSets = group.map(
      (p) => new Set(p.gameStats.map((s) => s.game.season.league.name))
    );
    const sharedCompetitions = [...compSets[0]].filter((c) => compSets.every((s) => s.has(c)));

    const gameIds = new Set<string>();
    let overlapping = 0;
    for (const player of group) {
      for (const stat of player.gameStats) {
        if (gameIds.has(stat.gameId)) overlapping += 1;
        gameIds.add(stat.gameId);
      }
    }

    clusters.push({
      clusterId: key,
      names: group.map((p) => p.displayName),
      playerIds: group.map((p) => p.id),
      matchType,
      confidence,
      sharedTeams: sharedTeams.slice(0, 10),
      sharedCompetitions: sharedCompetitions.slice(0, 10),
      overlappingStats: overlapping,
      recommendation:
        overlapping > 0
          ? "Do not merge without manual review — shared game evidence detected"
          : matchType === "exact"
            ? "Review for merge — exact name match may split verified games"
            : "Review for merge — fuzzy name cluster; confirm identity before merge"
    });
  }

  const exactGroups = new Map<string, typeof players>();
  const fuzzyGroups = new Map<string, typeof players>();

  for (const player of players) {
    const exactKey = `${player.gender}:${normalizeName(player.displayName)}`;
    exactGroups.set(exactKey, [...(exactGroups.get(exactKey) ?? []), player]);

    const fuzzyKey = `${player.gender}:${normalizeName(lastNameKey(player.displayName))}`;
    fuzzyGroups.set(fuzzyKey, [...(fuzzyGroups.get(fuzzyKey) ?? []), player]);
  }

  for (const group of exactGroups.values()) {
    if (group.length >= 2) buildCluster(group, "exact", "high");
  }

  for (const group of fuzzyGroups.values()) {
    if (group.length < 2 || group.length > 4) continue;
    const firstTokens = new Set(group.map((p) => normalizeName(p.displayName.split(/\s+/)[0] ?? "")));
    if (firstTokens.size === group.length) continue;
    const key = clusterKey(group.map((p) => p.id));
    if (seen.has(key)) continue;
    buildCluster(group, "fuzzy", group.some((p) => p.gameStats.length > 10) ? "medium" : "low");
  }

  return clusters.sort(
    (a, b) =>
      (b.confidence === "high" ? 3 : b.confidence === "medium" ? 2 : 1) -
        (a.confidence === "high" ? 3 : a.confidence === "medium" ? 2 : 1) ||
      b.overlappingStats - a.overlappingStats
  );
}

async function buildDuplicatePrograms(): Promise<DuplicateProgramGroup[]> {
  const programs = await prisma.program.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      fullName: true,
      _count: { select: { teams: { where: { deletedAt: null } }, currentPlayers: true } },
      teams: {
        where: { deletedAt: null },
        select: { _count: { select: { gameStats: { where: { deletedAt: null } } } } }
      }
    }
  });

  const groups = new Map<string, typeof programs>();
  for (const program of programs) {
    const key = normalizeName(program.fullName);
    groups.set(key, [...(groups.get(key) ?? []), program]);
  }

  const results: DuplicateProgramGroup[] = [];
  for (const [normalizedName, group] of groups) {
    if (group.length < 2) continue;

    const mapped = group.map((p) => {
      const gameStats = p.teams.reduce((sum, t) => sum + t._count.gameStats, 0);
      const isEmptyShell = p._count.teams === 0 && p._count.currentPlayers === 0;
      const isActiveShell = p._count.teams > 0 && gameStats === 0;
      return {
        id: p.id,
        fullName: p.fullName,
        teams: p._count.teams,
        players: p._count.currentPlayers,
        gameStats,
        isEmptyShell,
        isActiveShell
      };
    });

    const emptyShells = mapped.filter((p) => p.isEmptyShell);
    const casingVariants = new Set(group.map((p) => p.fullName)).size > 1;

    results.push({
      normalizedName,
      programs: mapped,
      matchType: casingVariants ? "normalization" : "exact",
      recommendation:
        emptyShells.length > 0
          ? `Retire ${emptyShells.length} empty shell(s); reassign teams to canonical program`
          : "Review merge — active programs share normalized identity"
    });
  }

  return results.sort((a, b) => {
    const aEmpty = a.programs.some((p) => p.isEmptyShell) ? 1 : 0;
    const bEmpty = b.programs.some((p) => p.isEmptyShell) ? 1 : 0;
    return bEmpty - aEmpty;
  });
}

async function buildTeamFragmentation() {
  const programs = await prisma.program.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      fullName: true,
      teams: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          _count: { select: { gameStats: { where: { deletedAt: null } } } }
        }
      }
    }
  });

  const programsWithMultipleTeams = programs
    .filter((p) => p.teams.length > 1)
    .map((p) => ({
      program: p.fullName,
      programId: p.id,
      teamCount: p.teams.length,
      teams: p.teams.map((t) => ({ name: t.name, gameStats: t._count.gameStats })),
      impact: "Splits competition identity across teams; may fragment future Team Rankings aggregation"
    }))
    .sort((a, b) => b.teamCount - a.teamCount);

  const rosterConflicts = await prisma.$queryRaw<
    Array<{ team_id: string; team_name: string; program_count: number; program_names: string[] }>
  >`
    SELECT
      t.id AS team_id,
      t.name AS team_name,
      COUNT(DISTINCT COALESCE(p."currentProgramId", tm."programId"))::int AS program_count,
      array_agg(DISTINCT pr."fullName") FILTER (WHERE pr."fullName" IS NOT NULL) AS program_names
    FROM teams t
    JOIN player_team_seasons pts ON pts."teamId" = t.id AND pts."deletedAt" IS NULL
    JOIN players p ON p.id = pts."playerId" AND p."deletedAt" IS NULL
    JOIN teams tm ON tm.id = pts."teamId"
    LEFT JOIN programs pr ON pr.id = COALESCE(p."currentProgramId", tm."programId")
    WHERE t."deletedAt" IS NULL
    GROUP BY t.id, t.name
    HAVING COUNT(DISTINCT COALESCE(p."currentProgramId", tm."programId")) > 1
    ORDER BY program_count DESC
    LIMIT 50
  `;

  const teamsWithoutProgram = await prisma.team.count({
    where: { deletedAt: null, programId: null }
  });

  const competitionConflicts = await prisma.$queryRaw<
    Array<{ program_name: string; league_count: number; team_count: number }>
  >`
    SELECT
      pr."fullName" AS program_name,
      COUNT(DISTINCT l.id)::int AS league_count,
      COUNT(DISTINCT t.id)::int AS team_count
    FROM programs pr
    JOIN teams t ON t."programId" = pr.id AND t."deletedAt" IS NULL
    JOIN game_stats gs ON gs."teamId" = t.id AND gs."deletedAt" IS NULL
    JOIN games g ON g.id = gs."gameId" AND g."deletedAt" IS NULL
    JOIN seasons s ON s.id = g."seasonId" AND s."deletedAt" IS NULL
    JOIN leagues l ON l.id = s."leagueId" AND l."deletedAt" IS NULL
    WHERE pr."deletedAt" IS NULL
    GROUP BY pr.id, pr."fullName"
    HAVING COUNT(DISTINCT l.id) > 3
    ORDER BY league_count DESC
    LIMIT 30
  `;

  return {
    programsWithMultipleTeams,
    teamsWithMultiplePrograms: rosterConflicts.map((r) => ({
      team: r.team_name,
      teamId: r.team_id,
      programCount: r.program_count,
      programs: r.program_names ?? [],
      impact: "Roster/program mismatch may misattribute players in Team Rankings"
    })),
    teamsWithoutProgram,
    competitionIdentityConflicts: competitionConflicts.map((c) => ({
      program: c.program_name,
      leagueCount: c.league_count,
      teamCount: c.team_count,
      impact: "Multi-league program footprint — verify team resolution before team boards"
    }))
  };
}

async function buildAg4Readiness(formulaVersionId: string | null) {
  const rankings = await getLatestNationalRankings();
  const boysBoard = getPublicBoardRows(rankings.snapshotsByAge.U19.boys);
  const girlsBoard = getPublicBoardRows(rankings.snapshotsByAge.U19.girls);
  const boysPool = rankings.snapshotsByAge.U19.boys.rows;
  const girlsPool = rankings.snapshotsByAge.U19.girls.rows;

  const classYearDist: Record<string, number> = {};
  let unknownClass = 0;
  for (const row of boysPool) {
    const cy = row.effectiveClassYear;
    if (cy == null) unknownClass += 1;
    else classYearDist[String(cy)] = (classYearDist[String(cy)] ?? 0) + 1;
  }
  for (const row of girlsPool) {
    const cy = row.effectiveClassYear;
    if (cy == null) unknownClass += 1;
    else classYearDist[String(cy)] = (classYearDist[String(cy)] ?? 0) + 1;
  }

  const boysChips = getRecruitingClassYearOptions(boysBoard);
  const girlsChips = getRecruitingClassYearOptions(girlsBoard);

  const girlsOffBoard = girlsPool.filter((r) => r.eligibilityVerdict.verdict !== "RANKED");
  const girlsP12Count = girlsOffBoard.filter((r) => r.eligibilityVerdict.provisionalReason === "UNKNOWN_DOB").length;
  const girlsP7Count = girlsOffBoard.filter((r) => r.eligibilityVerdict.provisionalReason === "BELOW_THRESHOLD").length;

  const launchBlockers: string[] = [];
  if (girlsBoard.length === 0) launchBlockers.push("U19 Girls public board is empty (0 RANKED)");
  if (girlsP12Count > 0) launchBlockers.push(`${girlsP12Count} U19 Girls blocked by UNKNOWN_DOB (P12)`);
  if (unknownClass > 40) launchBlockers.push(`${unknownClass} U19 players lack class year (recruiting filter gap)`);
  if (!RECRUITING_CLASS_FILTER_ENABLED) launchBlockers.push("Recruiting class filter flag off in production");

  return {
    classYearDistribution: classYearDist,
    recruitingChipCounts: {
      boys: boysChips.filter((c) => c.year !== "all"),
      girls: girlsChips.filter((c) => c.year !== "all")
    },
    girlsReadiness: {
      ranked: girlsBoard.length,
      pool: girlsPool.length,
      p12UnknownDob: girlsP12Count,
      p7BelowThreshold: girlsP7Count,
      readyPct: girlsPool.length > 0 ? Math.round((girlsBoard.length / girlsPool.length) * 1000) / 10 : 0
    },
    unknownClassCount: unknownClass,
    recruitingFilterEnabled: RECRUITING_CLASS_FILTER_ENABLED,
    launchBlockers
  };
}

function parseSubmissionPlayers(rawText: string | null, parsedPreview: unknown) {
  const parsed = safeParseSubmissionJson({ rawText, parsedPreview });
  if (!parsed.ok) return { games: 0, playerNames: [] as string[] };

  const root = parsed.data;
  const packages = Array.isArray(root) ? root : [root];
  const playerNames = new Set<string>();
  let games = 0;

  for (const pkg of packages) {
    if (!pkg || typeof pkg !== "object") continue;
    const record = pkg as Record<string, unknown>;
    const gamesArr = Array.isArray(record.games) ? record.games : [];
    for (const game of gamesArr) {
      if (!game || typeof game !== "object") continue;
      games += 1;
      const players = Array.isArray((game as Record<string, unknown>).players)
        ? ((game as Record<string, unknown>).players as unknown[])
        : [];
      for (const row of players) {
        if (!row || typeof row !== "object") continue;
        const name = String((row as Record<string, unknown>).name ?? (row as Record<string, unknown>).playerName ?? "").trim();
        if (name) playerNames.add(name);
      }
    }
  }

  return { games, playerNames: [...playerNames] };
}

async function buildImportOpportunities(formulaVersionId: string | null) {
  const pendingStatuses: SubmissionStatus[] = [
    SubmissionStatus.SUBMITTED,
    SubmissionStatus.UNDER_REVIEW,
    SubmissionStatus.APPROVED
  ];

  const [submissions, nearThresholdPlayers, allRatings] = await Promise.all([
    prisma.submission.findMany({
      where: { deletedAt: null, status: { in: pendingStatuses } },
      select: { id: true, title: true, leagueName: true, status: true, rawText: true, parsedPreview: true }
    }),
    buildThresholdRemediation(formulaVersionId),
    prisma.playerRating.findMany({
      where: { player: { deletedAt: null } },
      select: {
        playerId: true,
        ageGroup: true,
        verifiedGameCount: true,
        player: {
          select: {
            displayName: true,
            gender: true,
            birthDate: true,
            classYearOverride: true,
            ageGroupOverride: true
          }
        }
      }
    })
  ]);

  const nearThresholdIds = new Set(
    [...nearThresholdPlayers.oneGameShort, ...nearThresholdPlayers.twoGamesShort].map((r) => r.playerId)
  );

  const playerNameToId = new Map<string, string>();
  for (const rating of allRatings) {
    playerNameToId.set(normalizeName(rating.player.displayName), rating.playerId);
  }

  type ImportOpp = {
    source: string;
    submissionId?: string;
    status?: string;
    gamesInPackage: number;
    playersInPackage: number;
    nearThresholdHits: number;
    projectedRankedUnlock: number;
    projectedU16Growth: number;
    projectedGirlsGrowth: number;
    roiScore: number;
  };

  const opportunities: ImportOpp[] = [];

  for (const sub of submissions) {
    const parsed = parseSubmissionPlayers(sub.rawText, sub.parsedPreview);
    let nearHits = 0;
    let rankedUnlock = 0;
    let u16Growth = 0;
    let girlsGrowth = 0;

    for (const name of parsed.playerNames) {
      const playerId = playerNameToId.get(normalizeName(name));
      if (!playerId) continue;
      if (nearThresholdIds.has(playerId)) {
        nearHits += 1;
        rankedUnlock += 1;
      }
      const rating = allRatings.find((r) => r.playerId === playerId);
      if (!rating) continue;
      if (rating.ageGroup === AgeGroup.U16) u16Growth += 1;
      if (rating.player.gender === PlayerGender.GIRLS) girlsGrowth += 1;
    }

    opportunities.push({
      source: sub.title,
      submissionId: sub.id,
      status: sub.status,
      gamesInPackage: parsed.games,
      playersInPackage: parsed.playerNames.length,
      nearThresholdHits: nearHits,
      projectedRankedUnlock: rankedUnlock,
      projectedU16Growth: u16Growth,
      projectedGirlsGrowth: girlsGrowth,
      roiScore: rankedUnlock * 10 + parsed.games + girlsGrowth * 2
    });
  }

  const leagues = await prisma.league.findMany({
    where: { deletedAt: null },
    select: {
      name: true,
      ageGroup: true,
      seasons: {
        where: { deletedAt: null },
        select: {
          name: true,
          games: { where: { deletedAt: null }, select: { id: true } }
        }
      }
    }
  });

  for (const league of leagues) {
    const totalGames = league.seasons.reduce((sum, s) => sum + s.games.length, 0);
    if (totalGames > 0) continue;
    opportunities.push({
      source: `${league.name} (no games imported)`,
      gamesInPackage: 0,
      playersInPackage: 0,
      nearThresholdHits: 0,
      projectedRankedUnlock: league.ageGroup === AgeGroup.U19 ? 15 : league.ageGroup === AgeGroup.U16 ? 20 : 10,
      projectedU16Growth: league.ageGroup === AgeGroup.U16 ? 20 : 5,
      projectedGirlsGrowth: 8,
      roiScore: league.ageGroup === AgeGroup.U16 ? 180 : 120
    });
  }

  const nearThresholdAll = [
    ...nearThresholdPlayers.oneGameShort,
    ...nearThresholdPlayers.twoGamesShort,
    ...nearThresholdPlayers.threeGamesShort,
    ...nearThresholdPlayers.fourGamesShort
  ];
  const nearIdSet = new Set(nearThresholdAll.map((r) => r.playerId));

  if (nearIdSet.size > 0) {
    const stats = await prisma.gameStat.findMany({
      where: { deletedAt: null, playerId: { in: [...nearIdSet] } },
      select: {
        playerId: true,
        game: {
          select: {
            season: { select: { league: { select: { name: true, ageGroup: true } } } }
          }
        }
      }
    });

    const leagueRollup = new Map<
      string,
      {
        ageGroup: AgeGroup;
        players: Set<string>;
        oneShortPlayers: Set<string>;
        girlsPlayers: Set<string>;
        u16Players: Set<string>;
      }
    >();

    const gamesShortByPlayer = new Map(nearThresholdAll.map((r) => [r.playerId, r.gamesShort]));
    const boardByPlayer = new Map(nearThresholdAll.map((r) => [r.playerId, r.board]));

    for (const stat of stats) {
      const league = stat.game.season.league;
      const key = league.name;
      const rollup = leagueRollup.get(key) ?? {
        ageGroup: league.ageGroup,
        players: new Set<string>(),
        oneShortPlayers: new Set<string>(),
        girlsPlayers: new Set<string>(),
        u16Players: new Set<string>()
      };
      rollup.players.add(stat.playerId);
      if (gamesShortByPlayer.get(stat.playerId) === 1) rollup.oneShortPlayers.add(stat.playerId);
      if (boardByPlayer.get(stat.playerId)?.includes("Girls")) rollup.girlsPlayers.add(stat.playerId);
      if (league.ageGroup === AgeGroup.U16) rollup.u16Players.add(stat.playerId);
      leagueRollup.set(key, rollup);
    }

    for (const [leagueName, rollup] of leagueRollup) {
      const oneShortCount = rollup.oneShortPlayers.size;
      opportunities.push({
        source: `${leagueName} — extend coverage for ${rollup.players.size} near-threshold players`,
        gamesInPackage: 0,
        playersInPackage: rollup.players.size,
        nearThresholdHits: rollup.players.size,
        projectedRankedUnlock: oneShortCount > 0 ? oneShortCount : Math.ceil(rollup.players.size * 0.4),
        projectedU16Growth: rollup.u16Players.size,
        projectedGirlsGrowth: rollup.girlsPlayers.size,
        roiScore: oneShortCount * 12 + rollup.players.size * 3 + rollup.girlsPlayers.size * 4
      });
    }
  }

  const byRanked = [...opportunities].sort((a, b) => b.projectedRankedUnlock - a.projectedRankedUnlock).slice(0, 15);
  const byU16 = [...opportunities].sort((a, b) => b.projectedU16Growth - a.projectedU16Growth).slice(0, 15);
  const byGirls = [...opportunities].sort((a, b) => b.projectedGirlsGrowth - a.projectedGirlsGrowth).slice(0, 15);

  return { all: opportunities, byRanked, byU16, byGirls };
}

type ExecutiveAction = {
  rank: number;
  action: string;
  expectedGain: string;
  effort: "low" | "medium" | "high";
  roi: number;
  category: string;
};

function buildExecutivePriorityList(input: {
  dob: Awaited<ReturnType<typeof buildDobRemediation>>;
  threshold: Awaited<ReturnType<typeof buildThresholdRemediation>>;
  duplicatePrograms: DuplicateProgramGroup[];
  importOpps: Awaited<ReturnType<typeof buildImportOpportunities>>;
  boardHealth: Awaited<ReturnType<typeof buildBoardHealth>>;
}): ExecutiveAction[] {
  const actions: ExecutiveAction[] = [];

  const girlsDob = input.dob.u19GirlsP12.length;
  if (girlsDob > 0) {
    actions.push({
      rank: 0,
      action: `Enter official DOB for ${girlsDob} U19 Girls P12 players (NU/UST clusters first)`,
      expectedGain: `+${girlsDob} potential RANKED U19 Girls`,
      effort: "medium",
      roi: girlsDob * 8,
      category: "DOB"
    });
  }

  const oneShort = input.threshold.oneGameShort.length;
  if (oneShort > 0) {
    actions.push({
      rank: 0,
      action: `Import/verify 1 game for ${oneShort} near-threshold players`,
      expectedGain: `+${oneShort} potential RANKED (mostly U19 Boys)`,
      effort: "low",
      roi: oneShort * 10,
      category: "IMPORT"
    });
  }

  const topImport = input.importOpps.byRanked[0];
  if (topImport && topImport.projectedRankedUnlock > 0) {
    actions.push({
      rank: 0,
      action: topImport.submissionId
        ? `Import pending submission: ${topImport.source}`
        : topImport.source,
      expectedGain: `+${topImport.projectedRankedUnlock} projected RANKED unlock`,
      effort: "low",
      roi: topImport.roiScore,
      category: "IMPORT"
    });
  }

  const boysDob = input.dob.u19BoysP12.length;
  const topBoysProgram = input.dob.u19BoysP12.reduce(
    (acc, row) => {
      acc[row.program] = (acc[row.program] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const [topProgram, topCount] = Object.entries(topBoysProgram).sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  if (topCount > 5) {
    actions.push({
      rank: 0,
      action: `Enter DOB for ${topProgram} U19 Boys batch (${topCount} P12 players)`,
      expectedGain: `+${topCount} potential RANKED U19 Boys`,
      effort: "medium",
      roi: topCount * 5,
      category: "DOB"
    });
  } else if (boysDob > 0) {
    actions.push({
      rank: 0,
      action: `Start U19 Boys P12 DOB remediation (${boysDob} players)`,
      expectedGain: `+${boysDob} potential RANKED U19 Boys`,
      effort: "high",
      roi: boysDob * 3,
      category: "DOB"
    });
  }

  const emptyProgram = input.duplicatePrograms.find((g) => g.programs.some((p) => p.isEmptyShell));
  if (emptyProgram) {
    actions.push({
      rank: 0,
      action: `Consolidate duplicate program: ${emptyProgram.programs.map((p) => p.fullName).join(" / ")}`,
      expectedGain: "Prevents split roster/team identity",
      effort: "low",
      roi: 40,
      category: "PROGRAM"
    });
  }

  const twoShort = input.threshold.twoGamesShort.length;
  if (twoShort > 0) {
    actions.push({
      rank: 0,
      action: `Import games for ${twoShort} players 2 games below threshold`,
      expectedGain: `+${twoShort} potential RANKED after import`,
      effort: "medium",
      roi: twoShort * 6,
      category: "IMPORT"
    });
  }

  const u16Dob = input.dob.u16P12.length;
  if (u16Dob > 0) {
    actions.push({
      rank: 0,
      action: `U16 P12 DOB remediation (${u16Dob} players)`,
      expectedGain: `+${u16Dob} potential RANKED U16`,
      effort: "high",
      roi: u16Dob * 2,
      category: "DOB"
    });
  }

  const u16Board = input.boardHealth.find((b) => b.board === "U16 Boys");
  if (u16Board && u16Board.ratingPool > 0 && u16Board.boardYieldPct < 5) {
    actions.push({
      rank: 0,
      action: "Expand U16 competition imports (board yield under 5%)",
      expectedGain: `Grow U16 pool from ${u16Board.ratingPool} rated players`,
      effort: "high",
      roi: 50,
      category: "IMPORT"
    });
  }

  const girlsBoard = input.boardHealth.find((b) => b.board === "U19 Girls");
  if (girlsBoard && girlsBoard.publicBoardRanked === 0) {
    actions.push({
      rank: 0,
      action: "Launch U19 Girls board — complete DOB + 1-game imports first",
      expectedGain: "Activate empty Girls national board",
      effort: "medium",
      roi: 200,
      category: "LAUNCH"
    });
  }

  return actions
    .sort((a, b) => b.roi - a.roi)
    .map((action, index) => ({ ...action, rank: index + 1 }))
    .slice(0, 10);
}

function renderMarkdown(payload: Record<string, unknown>) {
  const boardHealth = payload.boardHealth as Awaited<ReturnType<typeof buildBoardHealth>>;
  const dob = payload.dobRemediation as Awaited<ReturnType<typeof buildDobRemediation>>;
  const threshold = payload.thresholdRemediation as Awaited<ReturnType<typeof buildThresholdRemediation>>;
  const dupPlayers = payload.duplicatePlayers as DuplicatePlayerCluster[];
  const dupPrograms = payload.duplicatePrograms as DuplicateProgramGroup[];
  const fragmentation = payload.teamFragmentation as Awaited<ReturnType<typeof buildTeamFragmentation>>;
  const ag4 = payload.ag4Readiness as Awaited<ReturnType<typeof buildAg4Readiness>>;
  const imports = payload.importOpportunities as Awaited<ReturnType<typeof buildImportOpportunities>>;
  const executive = payload.executivePriorityList as ExecutiveAction[];
  const next5 = payload.NEXT_5_ACTIONS as ExecutiveAction[];

  const lines: string[] = [
    "# Rankings Operations Dashboard",
    "",
    `**Generated:** ${payload.generatedAt}`,
    "**Mode:** Read-only sweep — no data mutations",
    "",
    "---",
    "",
    "## 1. Board Health",
    "",
    "| Board | Pool | RANKED | PROVISIONAL | HIDDEN | FORMER | Yield % |",
    "|---|---:|---:|---:|---:|---:|---:|"
  ];

  for (const b of boardHealth) {
    lines.push(
      `| ${b.board} | ${b.ratingPool} | ${b.publicBoardRanked} | ${b.PROVISIONAL} | ${b.HIDDEN} | ${b.FORMER} | ${b.boardYieldPct}% |`
    );
  }

  lines.push("", "### Top Blocking Verdicts", "");
  for (const b of boardHealth) {
    if (!b.topBlockingVerdicts.length) continue;
    lines.push(`**${b.board}:** ${b.topBlockingVerdicts.map((x) => `${x.reason} (${x.count})`).join(" · ")}`);
  }

  lines.push("", "---", "", "## 2. DOB Remediation", "");
  for (const [title, rows] of [
    ["U19 Girls P12", dob.u19GirlsP12],
    ["U19 Boys P12", dob.u19BoysP12],
    ["U16 P12", dob.u16P12]
  ] as const) {
    lines.push(`### ${title} (${rows.length})`, "");
    lines.push("| Name | Program | Games | Rating | Priority |");
    lines.push("|---|---|---:|---:|---:|");
    for (const r of rows.slice(0, 50)) {
      lines.push(`| ${r.name} | ${r.program} | ${r.games} | ${r.rating} | ${r.priorityScore} |`);
    }
    if (rows.length > 50) lines.push(`| _…${rows.length - 50} more in JSON_ | | | | |`);
    lines.push("");
  }

  lines.push("---", "", "## 3. Threshold Remediation", "");
  for (const [label, rows] of [
    ["1 game short", threshold.oneGameShort],
    ["2 games short", threshold.twoGamesShort],
    ["3 games short", threshold.threeGamesShort],
    ["4 games short", threshold.fourGamesShort]
  ] as const) {
    lines.push(`### ${label} (${rows.length})`, "");
    lines.push("| Player | Program | Games | Board | Projected Gain | ROI |");
    lines.push("|---|---|---:|---|---|---:|");
    for (const r of rows.slice(0, 30)) {
      lines.push(`| ${r.player} | ${r.program} | ${r.games} | ${r.board} | ${r.projectedGain} | ${r.roiScore} |`);
    }
    if (rows.length > 30) lines.push(`| _…${rows.length - 30} more in JSON_ | | | | | |`);
    lines.push("");
  }

  lines.push("---", "", "## 4. Duplicate Players", "", `**Clusters:** ${dupPlayers.length}`, "");
  for (const c of dupPlayers) {
    lines.push(
      `### ${c.names.join(" / ")}`,
      `- Match: ${c.matchType} · Confidence: ${c.confidence}`,
      `- Shared teams: ${c.sharedTeams.join(", ") || "none"}`,
      `- Shared competitions: ${c.sharedCompetitions.join(", ") || "none"}`,
      `- Overlapping stats: ${c.overlappingStats}`,
      `- ${c.recommendation}`,
      ""
    );
  }

  lines.push("---", "", "## 5. Duplicate Programs", "", `**Groups:** ${dupPrograms.length}`, "");
  for (const g of dupPrograms) {
    lines.push(`### ${g.programs.map((p) => p.fullName).join(" / ")}`);
    lines.push(`- Match: ${g.matchType}`);
    lines.push(`- ${g.recommendation}`);
    for (const p of g.programs) {
      lines.push(`  - ${p.fullName}: teams ${p.teams}, stats ${p.gameStats}${p.isEmptyShell ? " (empty shell)" : ""}`);
    }
    lines.push("");
  }

  lines.push("---", "", "## 6. Team Fragmentation", "");
  lines.push(`- Teams without program: ${fragmentation.teamsWithoutProgram}`);
  lines.push(`- Programs with multiple teams: ${fragmentation.programsWithMultipleTeams.length}`);
  lines.push(`- Teams with roster/program conflicts: ${fragmentation.teamsWithMultiplePrograms.length}`);
  lines.push("");
  lines.push("### Programs with Multiple Teams (top 15)", "");
  for (const p of fragmentation.programsWithMultipleTeams.slice(0, 15)) {
    lines.push(`- **${p.program}** — ${p.teamCount} teams`);
  }

  lines.push("", "---", "", "## 7. AG-4 Readiness", "");
  lines.push(`- Recruiting filter enabled: ${ag4.recruitingFilterEnabled}`);
  lines.push(`- Unknown class count (U19 pool): ${ag4.unknownClassCount}`);
  lines.push(`- Girls ranked: ${ag4.girlsReadiness.ranked} / ${ag4.girlsReadiness.pool} (${ag4.girlsReadiness.readyPct}%)`);
  lines.push(`- Girls P12: ${ag4.girlsReadiness.p12UnknownDob} · Girls P7: ${ag4.girlsReadiness.p7BelowThreshold}`);
  lines.push("- Launch blockers:");
  for (const b of ag4.launchBlockers) lines.push(`  - ${b}`);

  lines.push("", "---", "", "## 8. Import Opportunities", "");
  lines.push("### Highest projected RANKED unlock", "");
  for (const o of imports.byRanked.slice(0, 10)) {
    lines.push(`- **${o.source}** — +${o.projectedRankedUnlock} RANKED · ${o.gamesInPackage} games · ROI ${o.roiScore}`);
  }
  lines.push("", "### Highest U16 growth", "");
  for (const o of imports.byU16.slice(0, 5)) {
    lines.push(`- **${o.source}** — U16 +${o.projectedU16Growth}`);
  }
  lines.push("", "### Highest Girls growth", "");
  for (const o of imports.byGirls.slice(0, 5)) {
    lines.push(`- **${o.source}** — Girls +${o.projectedGirlsGrowth}`);
  }

  lines.push("", "---", "", "## 9. Executive Priority List", "");
  for (const a of executive) {
    lines.push(`### #${a.rank} ${a.action}`);
    lines.push(`- Expected: ${a.expectedGain}`);
    lines.push(`- Effort: ${a.effort} · ROI: ${a.roi} · Category: ${a.category}`);
    lines.push("");
  }

  lines.push("---", "", "## NEXT_5_ACTIONS", "");
  for (const a of next5) {
    lines.push(`${a.rank}. **${a.action}** — ${a.expectedGain} (effort: ${a.effort}, ROI: ${a.roi})`);
  }

  return lines.join("\n");
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: 1 },
    select: { id: true }
  });
  const formulaVersionId = formulaVersion?.id ?? null;

  const [
    boardHealth,
    dobRemediation,
    thresholdRemediation,
    duplicatePlayers,
    duplicatePrograms,
    teamFragmentation,
    ag4Readiness,
    importOpportunities
  ] = await Promise.all([
    buildBoardHealth(formulaVersionId),
    buildDobRemediation(formulaVersionId),
    buildThresholdRemediation(formulaVersionId),
    buildDuplicatePlayers(),
    buildDuplicatePrograms(),
    buildTeamFragmentation(),
    buildAg4Readiness(formulaVersionId),
    buildImportOpportunities(formulaVersionId)
  ]);

  const executivePriorityList = buildExecutivePriorityList({
    dob: dobRemediation,
    threshold: thresholdRemediation,
    duplicatePrograms,
    importOpps: importOpportunities,
    boardHealth
  });

  const NEXT_5_ACTIONS = executivePriorityList.slice(0, 5);

  const payload = {
    generatedAt: new Date().toISOString(),
    mode: "read-only",
    boardHealth,
    dobRemediation,
    thresholdRemediation,
    duplicatePlayers,
    duplicatePrograms,
    teamFragmentation,
    ag4Readiness,
    importOpportunities,
    executivePriorityList,
    NEXT_5_ACTIONS,
    summary: {
      totalDobP12: dobRemediation.u19GirlsP12.length + dobRemediation.u19BoysP12.length + dobRemediation.u16P12.length,
      nearThresholdTotal:
        thresholdRemediation.oneGameShort.length +
        thresholdRemediation.twoGamesShort.length +
        thresholdRemediation.threeGamesShort.length +
        thresholdRemediation.fourGamesShort.length,
      duplicatePlayerClusters: duplicatePlayers.length,
      duplicateProgramGroups: duplicatePrograms.length
    }
  };

  const jsonPath = join(OUT_DIR, "rankings-operations-dashboard.json");
  const mdPath = join(OUT_DIR, "RANKINGS_OPERATIONS_DASHBOARD.md");

  writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
  writeFileSync(mdPath, renderMarkdown(payload));

  console.log(JSON.stringify({ jsonPath, mdPath, summary: payload.summary, NEXT_5_ACTIONS }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
