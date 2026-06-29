import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { prisma } from "../src/lib/prisma";
import { getClassYear } from "../src/lib/ranking-eligibility";

type TeamAction = "MERGE_SAFE" | "HIDE_INACTIVE_ONLY" | "NEEDS_REVIEW" | "KEEP_SEPARATE";
type PlayerAction = "MERGE_SAFE" | "NEEDS_REVIEW" | "KEEP_SEPARATE";
type InactiveAction = "HIDE_INACTIVE_ONLY" | "DELETE_IF_TEST_ONLY" | "NEEDS_REVIEW";

type TeamRow = {
  teamId: string;
  teamName: string;
  active: boolean;
  city: string;
  region: string;
  ageGroups: string[];
  genders: string[];
  leagues: string[];
  seasons: string[];
  contexts: string[];
  officialGameIds: string[];
  officialGameNumbers: string[];
  officialGameCount: number;
  gameStatCount: number;
  historicalGameCount: number;
  historicalGameStatCount: number;
};

const reportPath = join(process.cwd(), "scripts", "reports", "duplicate-cleanup-plan.json");

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(jr|jrs|junior|juniors|u13|u16|u19|boys|girls|hs|high|school|team|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function baseTeamName(value: string) {
  return normalizeName(value).replace(/\b(blue|lady|eaglets|bullpups|baby|tamaraws|tigresses|squires|red|green|goldies|braves)\b/g, " ").replace(/\s+/g, " ").trim();
}

function compactName(value: string) {
  return normalizeName(value).replace(/\s+/g, "");
}

function similarity(left: string, right: string) {
  const a = compactName(left);
  const b = compactName(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.92;
  const aSet = new Set(a.split(""));
  const bSet = new Set(b.split(""));
  const intersection = Array.from(aSet).filter((char) => bSet.has(char)).length;
  const union = new Set([...aSet, ...bSet]).size;
  return union ? intersection / union : 0;
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((left, right) => left.localeCompare(right));
}

function inferGender(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase().includes("girls") ? "Girls" : "Boys";
}

function formatDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

function makeContext(ageGroup: string, gender: string, leagueName: string, seasonName: string) {
  return `${ageGroup} ${gender} / ${leagueName} / ${seasonName}`;
}

function chooseCanonicalTeam(teams: TeamRow[]) {
  return teams.slice().sort((left, right) => {
    if (right.officialGameCount !== left.officialGameCount) return right.officialGameCount - left.officialGameCount;
    if (right.gameStatCount !== left.gameStatCount) return right.gameStatCount - left.gameStatCount;
    const leftContextAware = /\bU(13|16|19)\b/i.test(left.teamName) ? 1 : 0;
    const rightContextAware = /\bU(13|16|19)\b/i.test(right.teamName) ? 1 : 0;
    if (rightContextAware !== leftContextAware) return rightContextAware - leftContextAware;
    return left.teamName.localeCompare(right.teamName);
  })[0] ?? null;
}

function classifyTeamGroup(teams: TeamRow[], sameContext: boolean, sameMeaning: boolean): TeamAction {
  const activeTeams = teams.filter((team) => team.active);
  const inactiveTeams = teams.filter((team) => !team.active);
  if (sameContext && sameMeaning && activeTeams.length > 1) return "MERGE_SAFE";
  if (activeTeams.length === 1 && inactiveTeams.length > 0) return "HIDE_INACTIVE_ONLY";
  if (!sameContext && activeTeams.length > 1) return "KEEP_SEPARATE";
  if (activeTeams.length === 0) return "HIDE_INACTIVE_ONLY";
  return "NEEDS_REVIEW";
}

function canonicalPlayer(players: Array<{ playerId: string; displayName: string; gameStatCount: number; playerRatingCount: number; rankingSnapshotRowCount: number }>) {
  return players.slice().sort((left, right) => {
    if (right.gameStatCount !== left.gameStatCount) return right.gameStatCount - left.gameStatCount;
    if (right.playerRatingCount !== left.playerRatingCount) return right.playerRatingCount - left.playerRatingCount;
    if (right.rankingSnapshotRowCount !== left.rankingSnapshotRowCount) return right.rankingSnapshotRowCount - left.rankingSnapshotRowCount;
    return left.displayName.localeCompare(right.displayName);
  })[0] ?? null;
}

async function main() {
  const [programs, players, counts] = await Promise.all([
    prisma.program.findMany({
      where: { deletedAt: null },
      include: {
        teams: {
          where: { deletedAt: null },
          include: {
            _count: { select: { homeGames: true, awayGames: true, gameStats: true } },
            homeGames: {
              where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } },
              include: { season: { include: { league: true } }, awayTeam: true }
            },
            awayGames: {
              where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } },
              include: { season: { include: { league: true } }, homeTeam: true }
            },
            gameStats: {
              where: { deletedAt: null, game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } },
              select: { id: true, gameId: true }
            }
          },
          orderBy: { name: "asc" }
        }
      },
      orderBy: { fullName: "asc" }
    }),
    prisma.player.findMany({
      where: { deletedAt: null },
      include: {
        currentProgram: true,
        gameStats: { where: { deletedAt: null }, select: { id: true } },
        currentRatings: { select: { id: true, ageGroup: true } },
        rankingRows: { select: { id: true } }
      },
      orderBy: { displayName: "asc" }
    }),
    Promise.all([
      prisma.game.count({ where: { deletedAt: null } }),
      prisma.gameStat.count({ where: { deletedAt: null } }),
      prisma.gamePerformanceScore.count(),
      prisma.playerRating.count(),
      prisma.rankingSnapshot.count(),
      prisma.rankingSnapshotRow.count()
    ])
  ]);

  const [gameCount, gameStatCount, gamePerformanceScoreCount, playerRatingCount, rankingSnapshotCount, rankingSnapshotRowCount] = counts;
  const teamRowsById = new Map<string, TeamRow>();
  const inactiveRecords: any[] = [];
  const teamDuplicateGroups: any[] = [];
  const seenTeamGroupKeys = new Set<string>();

  for (const program of programs) {
    for (const team of program.teams) {
      const gameMap = new Map([...team.homeGames, ...team.awayGames].map((game) => [game.id, game]));
      const games = Array.from(gameMap.values());
      const contexts = uniqueSorted(games.map((game) => makeContext(String(game.season.league.ageGroup), inferGender(game.season.league.name, team.name), game.season.league.name, game.season.name)));
      const row: TeamRow = {
        teamId: team.id,
        teamName: team.name,
        active: games.length > 0 || team.gameStats.length > 0,
        city: team.city,
        region: team.region,
        ageGroups: uniqueSorted(games.map((game) => String(game.season.league.ageGroup))),
        genders: uniqueSorted(games.map((game) => inferGender(game.season.league.name, team.name))),
        leagues: uniqueSorted(games.map((game) => game.season.league.name)),
        seasons: uniqueSorted(games.map((game) => game.season.name)),
        contexts,
        officialGameIds: uniqueSorted(games.map((game) => game.id)),
        officialGameNumbers: uniqueSorted(games.map((game) => game.gameNumber ?? "Unnumbered")),
        officialGameCount: games.length,
        gameStatCount: team.gameStats.length,
        historicalGameCount: team._count.homeGames + team._count.awayGames,
        historicalGameStatCount: team._count.gameStats
      };
      teamRowsById.set(team.id, row);

      if (!row.active) {
        const hasHistoricalUsage = row.historicalGameCount > 0 || row.historicalGameStatCount > 0;
        const recommendedAction: InactiveAction = hasHistoricalUsage ? "HIDE_INACTIVE_ONLY" : "DELETE_IF_TEST_ONLY";
        inactiveRecords.push({
          teamId: team.id,
          name: team.name,
          program: { programId: program.id, fullName: program.fullName, abbreviation: program.abbreviation, type: program.type },
          anyHistoricalUsage: hasHistoricalUsage,
          historicalGameCount: row.historicalGameCount,
          historicalGameStatCount: row.historicalGameStatCount,
          recommendedAction
        });
      }
    }

    const contextGroups = new Map<string, TeamRow[]>();
    for (const team of program.teams) {
      const row = teamRowsById.get(team.id)!;
      for (const context of row.contexts) {
        const list = contextGroups.get(context) ?? [];
        list.push(row);
        contextGroups.set(context, list);
      }
    }

    for (const [context, rows] of contextGroups.entries()) {
      if (rows.length < 2) continue;
      const canonical = chooseCanonicalTeam(rows);
      const key = `same-context:${program.id}:${context}:${rows.map((row) => row.teamId).sort().join(",")}`;
      seenTeamGroupKeys.add(key);
      teamDuplicateGroups.push({
        groupId: key,
        detectionType: "SAME_PROGRAM_SAME_CONTEXT",
        classification: classifyTeamGroup(rows, true, true),
        program: { programId: program.id, fullName: program.fullName, abbreviation: program.abbreviation, type: program.type },
        teamIds: rows.map((row) => row.teamId),
        teamNames: rows.map((row) => row.teamName),
        activeUnusedStatus: rows.map((row) => ({ teamId: row.teamId, teamName: row.teamName, status: row.active ? "ACTIVE_OFFICIAL_USAGE" : "UNUSED_OR_INACTIVE" })),
        ageGroup: uniqueSorted(rows.flatMap((row) => row.ageGroups)).join(", ") || null,
        gender: uniqueSorted(rows.flatMap((row) => row.genders)).join(", ") || null,
        league: uniqueSorted(rows.flatMap((row) => row.leagues)).join(", ") || null,
        season: uniqueSorted(rows.flatMap((row) => row.seasons)).join(", ") || null,
        context,
        officialGameCount: new Set(rows.flatMap((row) => row.officialGameIds)).size,
        gameStatCount: rows.reduce((sum, row) => sum + row.gameStatCount, 0),
        recommendedCanonicalTeam: canonical ? { teamId: canonical.teamId, teamName: canonical.teamName } : null,
        sourceTeamsToReassignOrHide: rows.filter((row) => row.teamId !== canonical?.teamId).map((row) => ({
          teamId: row.teamId,
          teamName: row.teamName,
          action: row.active ? "REASSIGN_TO_CANONICAL_IF_APPROVED" : "HIDE_INACTIVE_ONLY"
        })),
        exactAffectedGameIds: uniqueSorted(rows.flatMap((row) => row.officialGameIds)),
        exactAffectedGameNumbers: uniqueSorted(rows.flatMap((row) => row.officialGameNumbers)),
        exactAffectedGameCount: new Set(rows.flatMap((row) => row.officialGameIds)).size,
        exactAffectedGameStatCount: rows.reduce((sum, row) => sum + row.gameStatCount, 0),
        ratingsSnapshotsUnchanged: true,
        ratingsSnapshotsReason: "Team identity changes only Game.homeTeamId/awayTeamId and GameStat.teamId; score/stat/player values stay unchanged, so GamePerformanceScore, PlayerRating, and RankingSnapshot rows do not need recomputation."
      });
    }

    for (let i = 0; i < program.teams.length; i += 1) {
      for (let j = i + 1; j < program.teams.length; j += 1) {
        const left = teamRowsById.get(program.teams[i].id)!;
        const right = teamRowsById.get(program.teams[j].id)!;
        const score = similarity(left.teamName, right.teamName);
        const sameContext = left.contexts.some((context) => right.contexts.includes(context));
        const sameMeaning = baseTeamName(left.teamName) === baseTeamName(right.teamName) || score >= 0.9;
        if (score < 0.88 && !sameContext) continue;
        const rows = [left, right];
        const key = `similar:${program.id}:${[left.teamId, right.teamId].sort().join(",")}`;
        if (seenTeamGroupKeys.has(key)) continue;
        const canonical = chooseCanonicalTeam(rows);
        teamDuplicateGroups.push({
          groupId: key,
          detectionType: sameContext ? "SAME_PROGRAM_SIMILAR_NAME_SAME_CONTEXT" : "SAME_PROGRAM_SIMILAR_NAME_DIFFERENT_CONTEXT",
          similarityScore: Number(score.toFixed(2)),
          classification: classifyTeamGroup(rows, sameContext, sameMeaning),
          program: { programId: program.id, fullName: program.fullName, abbreviation: program.abbreviation, type: program.type },
          teamIds: rows.map((row) => row.teamId),
          teamNames: rows.map((row) => row.teamName),
          activeUnusedStatus: rows.map((row) => ({ teamId: row.teamId, teamName: row.teamName, status: row.active ? "ACTIVE_OFFICIAL_USAGE" : "UNUSED_OR_INACTIVE" })),
          ageGroup: uniqueSorted(rows.flatMap((row) => row.ageGroups)).join(", ") || null,
          gender: uniqueSorted(rows.flatMap((row) => row.genders)).join(", ") || null,
          league: uniqueSorted(rows.flatMap((row) => row.leagues)).join(", ") || null,
          season: uniqueSorted(rows.flatMap((row) => row.seasons)).join(", ") || null,
          context: sameContext ? left.contexts.find((context) => right.contexts.includes(context)) : "Different competition contexts",
          officialGameCount: new Set(rows.flatMap((row) => row.officialGameIds)).size,
          gameStatCount: rows.reduce((sum, row) => sum + row.gameStatCount, 0),
          recommendedCanonicalTeam: canonical ? { teamId: canonical.teamId, teamName: canonical.teamName } : null,
          sourceTeamsToReassignOrHide: rows.filter((row) => row.teamId !== canonical?.teamId).map((row) => ({
            teamId: row.teamId,
            teamName: row.teamName,
            action: row.active ? (sameContext ? "REASSIGN_TO_CANONICAL_IF_APPROVED" : "KEEP_SEPARATE") : "HIDE_INACTIVE_ONLY"
          })),
          exactAffectedGameIds: sameContext ? uniqueSorted(rows.flatMap((row) => row.officialGameIds)) : [],
          exactAffectedGameNumbers: sameContext ? uniqueSorted(rows.flatMap((row) => row.officialGameNumbers)) : [],
          exactAffectedGameCount: sameContext ? new Set(rows.flatMap((row) => row.officialGameIds)).size : 0,
          exactAffectedGameStatCount: sameContext ? rows.reduce((sum, row) => sum + row.gameStatCount, 0) : 0,
          ratingsSnapshotsUnchanged: true,
          ratingsSnapshotsReason: sameContext ? "If approved as a same-context team reassignment, ratings/snapshots remain unchanged because player/stat values are not changed." : "Different contexts should remain separate; no rating/snapshot change proposed."
        });
      }
    }
  }

  const playerGroups: any[] = [];
  const normalizedPlayerMap = new Map<string, typeof players>();
  for (const player of players) {
    const key = normalizeName(player.displayName);
    if (!key) continue;
    const list = normalizedPlayerMap.get(key) ?? [];
    list.push(player);
    normalizedPlayerMap.set(key, list);
  }

  for (const [normalizedName, group] of normalizedPlayerMap.entries()) {
    if (group.length < 2) continue;
    const currentPrograms = new Set(group.map((player) => player.currentProgramId ?? "none"));
    const genders = new Set(group.map((player) => player.gender));
    const birthDates = new Set(group.map((player) => formatDate(player.birthDate) ?? "missing").filter((value) => value !== "missing"));
    const playerRows = group.map((player) => ({
      playerId: player.id,
      displayName: player.displayName,
      currentProgram: player.currentProgram ? { programId: player.currentProgram.id, fullName: player.currentProgram.fullName, abbreviation: player.currentProgram.abbreviation } : null,
      gender: player.gender,
      birthDate: formatDate(player.birthDate),
      classYear: player.classYearOverride ?? getClassYear(player.birthDate),
      height: player.heightCm,
      position: player.position,
      gameStatCount: player.gameStats.length,
      playerRatingCount: player.currentRatings.length,
      rankingSnapshotRowCount: player.rankingRows.length
    }));
    const classification: PlayerAction = currentPrograms.size === 1 && genders.size === 1 && birthDates.size <= 1 ? "MERGE_SAFE" : "NEEDS_REVIEW";
    const canonical = canonicalPlayer(playerRows);
    playerGroups.push({
      groupId: `exact:${normalizedName}:${group.map((player) => player.id).sort().join(",")}`,
      detectionType: currentPrograms.size === 1 ? "EXACT_NORMALIZED_NAME_SAME_CURRENT_PROGRAM" : "EXACT_NORMALIZED_NAME_DIFFERENT_PROGRAM",
      normalizedName,
      classification,
      playerIds: playerRows.map((player) => player.playerId),
      displayNames: playerRows.map((player) => player.displayName),
      players: playerRows,
      recommendedCanonicalPlayer: canonical ? { playerId: canonical.playerId, displayName: canonical.displayName } : null,
      sourcePlayerToMergeIfSafe: classification === "MERGE_SAFE" ? playerRows.filter((player) => player.playerId !== canonical?.playerId).map((player) => ({ playerId: player.playerId, displayName: player.displayName })) : [],
      exactAffectedRecordsIfMerged: {
        gameStats: playerRows.filter((player) => player.playerId !== canonical?.playerId).reduce((sum, player) => sum + player.gameStatCount, 0),
        playerRatings: playerRows.filter((player) => player.playerId !== canonical?.playerId).reduce((sum, player) => sum + player.playerRatingCount, 0),
        rankingSnapshotRows: playerRows.filter((player) => player.playerId !== canonical?.playerId).reduce((sum, player) => sum + player.rankingSnapshotRowCount, 0)
      }
    });
  }

  for (let i = 0; i < players.length; i += 1) {
    for (let j = i + 1; j < players.length; j += 1) {
      const left = players[i];
      const right = players[j];
      if (!left.currentProgramId || left.currentProgramId !== right.currentProgramId) continue;
      if (normalizeName(left.displayName) === normalizeName(right.displayName)) continue;
      const score = similarity(left.displayName, right.displayName);
      if (score < 0.92) continue;
      const playerRows = [left, right].map((player) => ({
        playerId: player.id,
        displayName: player.displayName,
        currentProgram: player.currentProgram ? { programId: player.currentProgram.id, fullName: player.currentProgram.fullName, abbreviation: player.currentProgram.abbreviation } : null,
        gender: player.gender,
        birthDate: formatDate(player.birthDate),
        classYear: player.classYearOverride ?? getClassYear(player.birthDate),
        height: player.heightCm,
        position: player.position,
        gameStatCount: player.gameStats.length,
        playerRatingCount: player.currentRatings.length,
        rankingSnapshotRowCount: player.rankingRows.length
      }));
      const canonical = canonicalPlayer(playerRows);
      playerGroups.push({
        groupId: `similar:${[left.id, right.id].sort().join(",")}`,
        detectionType: "VERY_SIMILAR_NAME_SAME_CURRENT_PROGRAM",
        similarityScore: Number(score.toFixed(2)),
        classification: "NEEDS_REVIEW" as PlayerAction,
        playerIds: playerRows.map((player) => player.playerId),
        displayNames: playerRows.map((player) => player.displayName),
        players: playerRows,
        recommendedCanonicalPlayer: canonical ? { playerId: canonical.playerId, displayName: canonical.displayName } : null,
        sourcePlayerToMergeIfSafe: [],
        exactAffectedRecordsIfMerged: {
          gameStats: playerRows.filter((player) => player.playerId !== canonical?.playerId).reduce((sum, player) => sum + player.gameStatCount, 0),
          playerRatings: playerRows.filter((player) => player.playerId !== canonical?.playerId).reduce((sum, player) => sum + player.playerRatingCount, 0),
          rankingSnapshotRows: playerRows.filter((player) => player.playerId !== canonical?.playerId).reduce((sum, player) => sum + player.rankingSnapshotRowCount, 0)
        }
      });
    }
  }

  const teamSummary = {
    totalTeamDuplicateGroups: teamDuplicateGroups.length,
    mergeSafeTeamGroups: teamDuplicateGroups.filter((group) => group.classification === "MERGE_SAFE").length,
    needsReviewTeamGroups: teamDuplicateGroups.filter((group) => group.classification === "NEEDS_REVIEW").length,
    keepSeparateTeamGroups: teamDuplicateGroups.filter((group) => group.classification === "KEEP_SEPARATE").length,
    hideInactiveOnlyTeamGroups: teamDuplicateGroups.filter((group) => group.classification === "HIDE_INACTIVE_ONLY").length,
    hideInactiveOnlyTeamRecords: inactiveRecords.filter((record) => record.recommendedAction === "HIDE_INACTIVE_ONLY").length
  };

  const playerSummary = {
    totalPlayerDuplicateGroups: playerGroups.length,
    mergeSafePlayerGroups: playerGroups.filter((group) => group.classification === "MERGE_SAFE").length,
    needsReviewPlayerGroups: playerGroups.filter((group) => group.classification === "NEEDS_REVIEW").length,
    keepSeparatePlayerGroups: playerGroups.filter((group) => group.classification === "KEEP_SEPARATE").length
  };

  const safestTeamRepairs = teamDuplicateGroups
    .filter((group) => group.classification === "HIDE_INACTIVE_ONLY" || group.classification === "MERGE_SAFE")
    .sort((left, right) => {
      const actionScore = (value: string) => value === "HIDE_INACTIVE_ONLY" ? 0 : 1;
      return actionScore(left.classification) - actionScore(right.classification) || left.exactAffectedGameStatCount - right.exactAffectedGameStatCount;
    })
    .slice(0, 5);
  const safestPlayerRepairs = playerGroups
    .filter((group) => group.classification === "MERGE_SAFE")
    .sort((left, right) => left.exactAffectedRecordsIfMerged.gameStats - right.exactAffectedRecordsIfMerged.gameStats)
    .slice(0, 5);

  const riskiestGroups = [
    ...teamDuplicateGroups
      .filter((group) => group.classification === "NEEDS_REVIEW" || group.classification === "KEEP_SEPARATE")
      .map((group) => ({ type: "TEAM", groupId: group.groupId, classification: group.classification, names: group.teamNames, affectedGameStats: group.exactAffectedGameStatCount, reason: group.classification === "KEEP_SEPARATE" ? "Different active competition contexts." : "Needs human confirmation before any reassignment." })),
    ...playerGroups
      .filter((group) => group.classification === "NEEDS_REVIEW")
      .map((group) => ({ type: "PLAYER", groupId: group.groupId, classification: group.classification, names: group.displayNames, affectedGameStats: group.exactAffectedRecordsIfMerged.gameStats, reason: group.detectionType.includes("DIFFERENT_PROGRAM") ? "Same/similar name across different programs." : "Similar names or conflicting bio context require human review." }))
  ].sort((left, right) => right.affectedGameStats - left.affectedGameStats).slice(0, 5);

  const report = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    guardrails: {
      databaseModified: false,
      mergesPerformed: false,
      deletesPerformed: false,
      migrationsRun: false,
      importsOrPublishRun: false,
      ratingsOrSnapshotsRecomputed: false,
      formulaV1Changed: false
    },
    baselineCounts: {
      activeGames: gameCount,
      activeGameStats: gameStatCount,
      gamePerformanceScores: gamePerformanceScoreCount,
      playerRatings: playerRatingCount,
      rankingSnapshots: rankingSnapshotCount,
      rankingSnapshotRows: rankingSnapshotRowCount
    },
    classificationRules: {
      team: {
        MERGE_SAFE: "Same Program, same age group, same gender, same league/season, same team meaning, and multiple active records. Requires approved repair script before execution.",
        HIDE_INACTIVE_ONLY: "One active team and one or more unused/inactive similar records, or inactive records with no active official usage. Hide from primary UI; do not delete yet.",
        NEEDS_REVIEW: "Ambiguous names/context or active records where the same-team meaning cannot be proven automatically.",
        KEEP_SEPARATE: "Similar names across different age/gender/league/season contexts. Do not merge."
      },
      player: {
        MERGE_SAFE: "Same normalized name, same current Program, same gender, and no conflicting birthDate. Requires approved merge script before execution.",
        NEEDS_REVIEW: "Same/similar names with different programs or incomplete/conflicting bio context.",
        KEEP_SEPARATE: "Known separate athletes; no automatic groups are classified this way without an allowlist."
      }
    },
    teamDuplicatePlan: teamDuplicateGroups,
    playerDuplicatePlan: playerGroups,
    inactiveTeamRecordsPlan: inactiveRecords,
    summary: {
      ...teamSummary,
      totalPlayerDuplicateGroups: playerSummary.totalPlayerDuplicateGroups,
      mergeSafePlayerGroups: playerSummary.mergeSafePlayerGroups,
      needsReviewPlayerGroups: playerSummary.needsReviewPlayerGroups,
      top5SafestRepairsToDoNext: [
        ...safestTeamRepairs.map((group) => ({ type: "TEAM", classification: group.classification, program: group.program.fullName, names: group.teamNames, affectedGames: group.exactAffectedGameCount, affectedGameStats: group.exactAffectedGameStatCount, nextAction: group.classification === "HIDE_INACTIVE_ONLY" ? "Hide inactive source records from primary Program UI." : "Prepare approved same-context team reassignment script." })),
        ...safestPlayerRepairs.map((group) => ({ type: "PLAYER", classification: group.classification, names: group.displayNames, affectedRecords: group.exactAffectedRecordsIfMerged, nextAction: "Prepare approved player merge script after admin confirms identity." }))
      ].slice(0, 5),
      top5RiskiestGroupsToAvoidForNow: riskiestGroups
    }
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ reportPath, ...report.summary }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
