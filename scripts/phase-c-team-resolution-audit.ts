/**
 * Validation Phase C — read-only team resolution audit.
 * Usage: npx tsx scripts/phase-c-team-resolution-audit.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { prisma } from "../src/lib/prisma";
import { teamDisplayMatchKey } from "../src/lib/team-import-matching";
import { getUaapSchoolDisplayName } from "../src/lib/uaap-school-display";

type Severity = "critical" | "high" | "medium" | "low" | "info";

type Finding = {
  id: string;
  severity: Severity;
  category: string;
  summary: string;
  count: number;
  sample?: unknown[];
};

function stripAgeGenderSuffix(name: string) {
  return name.replace(/\s+U(?:13|16|19)\s+(?:Boys|Girls)$/i, "").trim();
}

function publicSchoolDisplayName(teamName: string) {
  const alias = stripAgeGenderSuffix(teamName);
  return getUaapSchoolDisplayName(alias || teamName);
}

function inferGenderFromText(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase().includes("girls") ? "Girls" : "Boys";
}

async function main() {
  const findings: Finding[] = [];
  const blockers: string[] = [];

  const [
    activeProgramCount,
    deletedProgramCount,
    activeTeamCount,
    deletedTeamCount,
    teamsWithoutProgram,
    externalAliasCount,
    activeGameCount
  ] = await Promise.all([
    prisma.program.count({ where: { deletedAt: null } }),
    prisma.program.count({ where: { deletedAt: { not: null } } }),
    prisma.team.count({ where: { deletedAt: null } }),
    prisma.team.count({ where: { deletedAt: { not: null } } }),
    prisma.team.count({ where: { deletedAt: null, programId: null } }),
    prisma.teamExternalAlias.count(),
    prisma.game.count({ where: { deletedAt: null } })
  ]);

  const activeTeams = await prisma.team.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      city: true,
      region: true,
      programId: true,
      program: { select: { id: true, fullName: true, abbreviation: true } },
      createdAt: true,
      _count: {
        select: {
          gameStats: { where: { deletedAt: null } },
          homeGames: { where: { deletedAt: null } },
          awayGames: { where: { deletedAt: null } }
        }
      }
    },
    orderBy: { name: "asc" }
  });

  const programsWithTeams = await prisma.program.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      fullName: true,
      abbreviation: true,
      _count: { select: { teams: { where: { deletedAt: null } } } }
    },
    orderBy: { fullName: "asc" }
  });

  const programsWithoutTeams = programsWithTeams.filter((p) => p._count.teams === 0);

  // ── 2. Duplicate teams within same program ───────────────────────────────
  const withinProgramExactName = new Map<string, typeof activeTeams>();
  const withinProgramDisplayKey = new Map<string, typeof activeTeams>();

  for (const team of activeTeams) {
    if (!team.programId) continue;
    const exactKey = `${team.programId}|${team.name}`;
    const displayKey = `${team.programId}|${teamDisplayMatchKey(team.name)}`;
    withinProgramExactName.set(exactKey, [...(withinProgramExactName.get(exactKey) ?? []), team]);
    withinProgramDisplayKey.set(displayKey, [...(withinProgramDisplayKey.get(displayKey) ?? []), team]);
  }

  const sameProgramExactDuplicates = Array.from(withinProgramExactName.entries())
    .filter(([, teams]) => teams.length > 1)
    .map(([key, teams]) => ({
      programId: teams[0].programId,
      programName: teams[0].program?.fullName ?? null,
      teamName: teams[0].name,
      teamIds: teams.map((t) => t.id),
      gameStatCounts: teams.map((t) => t._count.gameStats)
    }));

  const sameProgramDisplayKeyDuplicates = Array.from(withinProgramDisplayKey.entries())
    .filter(([, teams]) => teams.length > 1)
    .map(([key, teams]) => ({
      programId: teams[0].programId,
      programName: teams[0].program?.fullName ?? null,
      displayMatchKey: key.split("|")[1],
      teamNames: teams.map((t) => t.name),
      teamIds: teams.map((t) => t.id),
      gameStatCounts: teams.map((t) => t._count.gameStats)
    }))
    .filter(
      (group) =>
        new Set(group.teamNames).size > 1 ||
        group.gameStatCounts.filter((c) => c > 0).length > 1
    );

  const sameProgramDuplicatesWithStats = sameProgramDisplayKeyDuplicates.filter(
    (g) => g.gameStatCounts.filter((c) => c > 0).length > 1
  );

  if (sameProgramExactDuplicates.length > 0) {
    findings.push({
      id: "same-program-exact-name-duplicates",
      severity: "critical",
      category: "within_program_duplicates",
      summary: `${sameProgramExactDuplicates.length} program(s) have multiple active Team records with identical names.`,
      count: sameProgramExactDuplicates.length,
      sample: sameProgramExactDuplicates.slice(0, 15)
    });
    blockers.push(
      `${sameProgramExactDuplicates.length} same-program exact-name duplicate group(s) break import resolution uniqueness.`
    );
  }

  if (sameProgramDisplayKeyDuplicates.length > 0) {
    findings.push({
      id: "same-program-display-key-duplicates",
      severity: sameProgramDuplicatesWithStats.length > 0 ? "high" : "medium",
      category: "within_program_duplicates",
      summary: `${sameProgramDisplayKeyDuplicates.length} program(s) have multiple active Teams normalizing to the same display match key (${sameProgramDuplicatesWithStats.length} with stats on 2+ records).`,
      count: sameProgramDisplayKeyDuplicates.length,
      sample: sameProgramDisplayKeyDuplicates.slice(0, 20)
    });
    if (sameProgramDuplicatesWithStats.length > 0) {
      blockers.push(
        `${sameProgramDuplicatesWithStats.length} same-program display-key group(s) split GameStats across duplicate Team records.`
      );
    }
  }

  // ── 3. Cross-program team identity collisions ────────────────────────────
  const crossProgramDisplayKey = new Map<string, Array<(typeof activeTeams)[number]>>();
  const crossProgramExactName = new Map<string, Array<(typeof activeTeams)[number]>>();

  for (const team of activeTeams) {
    const displayKey = teamDisplayMatchKey(team.name);
    crossProgramDisplayKey.set(displayKey, [...(crossProgramDisplayKey.get(displayKey) ?? []), team]);
    crossProgramExactName.set(team.name, [...(crossProgramExactName.get(team.name) ?? []), team]);
  }

  const crossProgramDisplayCollisions = Array.from(crossProgramDisplayKey.entries())
    .filter(([, teams]) => new Set(teams.map((t) => t.programId)).size > 1)
    .map(([displayKey, teams]) => ({
      displayMatchKey: displayKey,
      programCount: new Set(teams.map((t) => t.programId)).size,
      teamCount: teams.length,
      programs: Array.from(new Set(teams.map((t) => t.program?.fullName ?? "null"))),
      teamNames: teams.map((t) => t.name),
      teamIds: teams.map((t) => t.id),
      totalGameStats: teams.reduce((sum, t) => sum + t._count.gameStats, 0)
    }))
    .sort((a, b) => b.totalGameStats - a.totalGameStats);

  const crossProgramExactCollisions = Array.from(crossProgramExactName.entries())
    .filter(([, teams]) => new Set(teams.map((t) => t.programId)).size > 1)
    .map(([name, teams]) => ({
      teamName: name,
      programCount: new Set(teams.map((t) => t.programId)).size,
      programs: teams.map((t) => t.program?.fullName ?? null),
      teamIds: teams.map((t) => t.id)
    }));

  const crossProgramWithStats = crossProgramDisplayCollisions.filter((g) => g.totalGameStats > 0);

  if (crossProgramDisplayCollisions.length > 0) {
    findings.push({
      id: "cross-program-display-key-collisions",
      severity: "low",
      category: "cross_program_collisions",
      summary: `${crossProgramDisplayCollisions.length} display match key(s) appear on Teams under multiple Programs (often expected for generic PYBC/club names).`,
      count: crossProgramDisplayCollisions.length,
      sample: crossProgramDisplayCollisions.slice(0, 15)
    });
  }

  if (crossProgramExactCollisions.length > 0) {
    findings.push({
      id: "cross-program-exact-name-collisions",
      severity: "medium",
      category: "cross_program_collisions",
      summary: `${crossProgramExactCollisions.length} exact team name(s) exist under multiple Programs.`,
      count: crossProgramExactCollisions.length,
      sample: crossProgramExactCollisions.slice(0, 15)
    });
  }

  // ── 4. Historical team fragmentation (competition context) ───────────────
  const games = await prisma.game.findMany({
    where: {
      deletedAt: null,
      season: { deletedAt: null, league: { deletedAt: null } },
      homeTeam: { deletedAt: null },
      awayTeam: { deletedAt: null }
    },
    include: {
      homeTeam: { select: { id: true, name: true, programId: true } },
      awayTeam: { select: { id: true, name: true, programId: true } },
      season: { include: { league: { select: { id: true, name: true, ageGroup: true } } } },
      stats: { where: { deletedAt: null }, select: { id: true, teamId: true } }
    }
  });

  type ContextGroup = {
    publicSchoolDisplayName: string;
    ageGroup: string;
    gender: string;
    leagueId: string;
    leagueName: string;
    seasonId: string;
    seasonName: string;
    teams: Array<{
      teamId: string;
      teamName: string;
      programId: string | null;
      programName: string | null;
      gamesPlayed: number;
      gameStatsCount: number;
    }>;
  };

  const contextGroups = new Map<string, ContextGroup>();
  const teamsUsedInGames = new Set<string>();

  for (const game of games) {
    const gender = inferGenderFromText(game.season.league.name, game.homeTeam.name, game.awayTeam.name);
    for (const side of ["home", "away"] as const) {
      const team = side === "home" ? game.homeTeam : game.awayTeam;
      const publicName = publicSchoolDisplayName(team.name);
      const key = [publicName, game.season.league.ageGroup, gender, game.season.leagueId, game.seasonId].join("|");
      teamsUsedInGames.add(team.id);

      const group =
        contextGroups.get(key) ??
        ({
          publicSchoolDisplayName: publicName,
          ageGroup: game.season.league.ageGroup,
          gender,
          leagueId: game.season.leagueId,
          leagueName: game.season.league.name,
          seasonId: game.seasonId,
          seasonName: game.season.name,
          teams: []
        } satisfies ContextGroup);

      let usage = group.teams.find((row) => row.teamId === team.id);
      if (!usage) {
        const program = activeTeams.find((t) => t.id === team.id)?.program;
        usage = {
          teamId: team.id,
          teamName: team.name,
          programId: team.programId,
          programName: program?.fullName ?? null,
          gamesPlayed: 0,
          gameStatsCount: 0
        };
        group.teams.push(usage);
      }
      usage.gamesPlayed += 1;
      usage.gameStatsCount += game.stats.filter((s) => s.teamId === team.id).length;
      contextGroups.set(key, group);
    }
  }

  const duplicateSameContextGroups = Array.from(contextGroups.values())
    .filter((group) => group.teams.length > 1)
    .map((group) => ({
      ...group,
      affectedGameStats: group.teams.reduce((sum, t) => sum + t.gameStatsCount, 0),
      affectedGames: group.teams.reduce((sum, t) => sum + t.gamesPlayed, 0)
    }))
    .sort((a, b) => b.affectedGameStats - a.affectedGameStats);

  const highImpactContextDuplicates = duplicateSameContextGroups.filter(
    (g) => g.affectedGameStats >= 50 || g.teams.some((t) => t.gameStatsCount >= 30)
  );

  if (duplicateSameContextGroups.length > 0) {
    findings.push({
      id: "competition-context-team-fragmentation",
      severity: highImpactContextDuplicates.length > 0 ? "high" : "medium",
      category: "historical_fragmentation",
      summary: `${duplicateSameContextGroups.length} league/season context(s) have multiple Team records for the same public school identity (${highImpactContextDuplicates.length} high-impact).`,
      count: duplicateSameContextGroups.length,
      sample: duplicateSameContextGroups.slice(0, 15)
    });
    if (highImpactContextDuplicates.length > 0) {
      blockers.push(
        `${highImpactContextDuplicates.length} competition-context duplicate group(s) split standings and game attribution for the same school.`
      );
    }
  }

  const activeDeletedTeamOverlap = await prisma.$queryRaw<
    Array<{
      team_name: string;
      active_count: number;
      deleted_count: number;
      active_ids: string[];
      deleted_ids: string[];
    }>
  >`
    SELECT
      active.name AS team_name,
      COUNT(DISTINCT active.id)::int AS active_count,
      COUNT(DISTINCT deleted.id)::int AS deleted_count,
      array_agg(DISTINCT active.id) AS active_ids,
      array_agg(DISTINCT deleted.id) AS deleted_ids
    FROM teams active
    JOIN teams deleted
      ON deleted.name = active.name
     AND deleted."deletedAt" IS NOT NULL
     AND deleted.id <> active.id
    WHERE active."deletedAt" IS NULL
    GROUP BY active.name
    ORDER BY deleted_count DESC, team_name ASC
  `;

  if (activeDeletedTeamOverlap.length > 0) {
    findings.push({
      id: "active-deleted-team-name-overlap",
      severity: "low",
      category: "historical_fragmentation",
      summary: `${activeDeletedTeamOverlap.length} team name(s) exist on both active and soft-deleted Team records.`,
      count: activeDeletedTeamOverlap.length,
      sample: activeDeletedTeamOverlap.slice(0, 15)
    });
  }

  // ── 5. Game attribution consistency ───────────────────────────────────────
  const gameStatTeamMismatchCount = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM game_stats gs
    JOIN games g ON g.id = gs."gameId" AND g."deletedAt" IS NULL
    WHERE gs."deletedAt" IS NULL
      AND gs."teamId" NOT IN (g."homeTeamId", g."awayTeamId")
  `;

  const gameStatTeamMismatch = await prisma.$queryRaw<
    Array<{ game_stat_id: string; game_id: string; stat_team_id: string; home_team_id: string; away_team_id: string }>
  >`
    SELECT
      gs.id AS game_stat_id,
      gs."gameId" AS game_id,
      gs."teamId" AS stat_team_id,
      g."homeTeamId" AS home_team_id,
      g."awayTeamId" AS away_team_id
    FROM game_stats gs
    JOIN games g ON g.id = gs."gameId" AND g."deletedAt" IS NULL
    WHERE gs."deletedAt" IS NULL
      AND gs."teamId" NOT IN (g."homeTeamId", g."awayTeamId")
    LIMIT 50
  `;

  const homeAwaySameTeamRaw = await prisma.$queryRaw<Array<{ id: string; game_number: string | null }>>`
    SELECT id, "gameNumber" AS game_number
    FROM games
    WHERE "deletedAt" IS NULL AND "homeTeamId" = "awayTeamId"
  `;


  if (gameStatTeamMismatch.length > 0) {
    const mismatchTotal = gameStatTeamMismatchCount[0]?.count ?? gameStatTeamMismatch.length;
    findings.push({
      id: "game-stat-team-not-on-game",
      severity: "critical",
      category: "game_attribution",
      summary: `${mismatchTotal} GameStat row(s) reference a teamId that is neither home nor away for that game.`,
      count: mismatchTotal,
      sample: gameStatTeamMismatch.slice(0, 20)
    });
    blockers.push("GameStat teamId mismatches detected — box scores attributed to teams not in the game.");
  }

  if (homeAwaySameTeamRaw.length > 0) {
    findings.push({
      id: "home-away-same-team",
      severity: "critical",
      category: "game_attribution",
      summary: `${homeAwaySameTeamRaw.length} active game(s) have identical home and away Team IDs.`,
      count: homeAwaySameTeamRaw.length,
      sample: homeAwaySameTeamRaw.slice(0, 10)
    });
    blockers.push(`${homeAwaySameTeamRaw.length} game(s) with homeTeamId = awayTeamId.`);
  }

  // ── 6. Team resolution paths used by imports ─────────────────────────────
  const externalAliasByProvider = await prisma.teamExternalAlias.groupBy({
    by: ["provider"],
    _count: { _all: true }
  });
  externalAliasByProvider.sort((a, b) => b._count._all - a._count._all);

  const externalAliasSplits = await prisma.$queryRaw<
    Array<{ provider: string; normalized_external_label: string; team_count: number; team_ids: string[] }>
  >`
    SELECT
      tea.provider,
      tea."normalizedExternalLabel" AS normalized_external_label,
      COUNT(DISTINCT tea."teamId")::int AS team_count,
      array_agg(DISTINCT tea."teamId") AS team_ids
    FROM team_external_aliases tea
    JOIN teams t ON t.id = tea."teamId" AND t."deletedAt" IS NULL
    GROUP BY tea.provider, tea."normalizedExternalLabel"
    HAVING COUNT(DISTINCT tea."teamId") > 1
    ORDER BY team_count DESC
  `;

  const gameSourceBuckets = await prisma.$queryRaw<
    Array<{ source_bucket: string; games: number; distinct_home_teams: number; distinct_away_teams: number }>
  >`
    SELECT
      CASE
        WHEN g."sourceName" ILIKE '%StatsHub URL import%' THEN 'statshub_url_import'
        WHEN g."sourceName" ILIKE '%spreadsheet%' OR g."sourceName" ILIKE '%PYBC%' THEN 'spreadsheet_upload'
        WHEN g."sourceName" ILIKE '%UAAP%' OR g."sourceName" ILIKE '%Season 88%' THEN 'uaap_batch'
        WHEN g."sourceName" ILIKE '%NCAA%' THEN 'ncaa_batch'
        ELSE 'other'
      END AS source_bucket,
      COUNT(*)::int AS games,
      COUNT(DISTINCT g."homeTeamId")::int AS distinct_home_teams,
      COUNT(DISTINCT g."awayTeamId")::int AS distinct_away_teams
    FROM games g
    WHERE g."deletedAt" IS NULL
    GROUP BY 1
    ORDER BY games DESC
  `;

  const teamsWithExternalAlias = await prisma.$queryRaw<Array<{ team_count: number }>>`
    SELECT COUNT(DISTINCT tea."teamId")::int AS team_count
    FROM team_external_aliases tea
    JOIN teams t ON t.id = tea."teamId" AND t."deletedAt" IS NULL
  `;

  const aliasToDeletedTeam = await prisma.teamExternalAlias.count({
    where: { team: { deletedAt: { not: null } } }
  });

  if (externalAliasSplits.length > 0) {
    findings.push({
      id: "external-alias-team-split",
      severity: "high",
      category: "import_resolution",
      summary: `${externalAliasSplits.length} external team label(s) map to multiple active Team IDs — import resolution fragmented.`,
      count: externalAliasSplits.length,
      sample: externalAliasSplits.slice(0, 15)
    });
    blockers.push(`${externalAliasSplits.length} TeamExternalAlias split(s) break deterministic URL import routing.`);
  }

  if (aliasToDeletedTeam > 0) {
    findings.push({
      id: "external-alias-deleted-team",
      severity: "high",
      category: "import_resolution",
      summary: `${aliasToDeletedTeam} TeamExternalAlias row(s) point to soft-deleted teams.`,
      count: aliasToDeletedTeam
    });
    blockers.push(`${aliasToDeletedTeam} external alias(es) reference deleted teams.`);
  }

  // ── 7. Unresolved canonicalization candidates ────────────────────────────
  const inactiveTeams = activeTeams
    .filter((team) => !teamsUsedInGames.has(team.id))
    .map((team) => ({
      teamId: team.id,
      teamName: team.name,
      programName: team.program?.fullName ?? null,
      publicSchoolDisplayName: publicSchoolDisplayName(team.name),
      gameStats: team._count.gameStats,
      city: team.city,
      region: team.region
    }))
    .sort((a, b) => b.gameStats - a.gameStats || a.teamName.localeCompare(b.teamName));

  const inactiveWithStats = inactiveTeams.filter((t) => t.gameStats > 0);

  const canonicalizationCandidates = [
    ...duplicateSameContextGroups.map((group) => ({
      type: "duplicate_same_context" as const,
      publicSchoolDisplayName: group.publicSchoolDisplayName,
      leagueName: group.leagueName,
      seasonName: group.seasonName,
      ageGroup: group.ageGroup,
      gender: group.gender,
      teamCount: group.teams.length,
      internalTeamNames: group.teams.map((t) => t.teamName),
      affectedGameStats: group.affectedGameStats
    })),
    ...sameProgramDisplayKeyDuplicates.map((group) => ({
      type: "same_program_display_key" as const,
      programName: group.programName,
      displayMatchKey: group.displayMatchKey,
      teamNames: group.teamNames,
      affectedGameStats: group.gameStatCounts.reduce((a, b) => a + b, 0)
    }))
  ].sort((a, b) => b.affectedGameStats - a.affectedGameStats);

  if (teamsWithoutProgram > 0) {
    findings.push({
      id: "teams-without-program",
      severity: "medium",
      category: "inventory",
      summary: `${teamsWithoutProgram} active Team record(s) have no Program assignment.`,
      count: teamsWithoutProgram,
      sample: activeTeams.filter((t) => !t.programId).slice(0, 15).map((t) => ({
        id: t.id,
        name: t.name,
        gameStats: t._count.gameStats
      }))
    });
  }

  if (inactiveTeams.length > 0) {
    findings.push({
      id: "inactive-teams-no-games",
      severity: inactiveWithStats.length > 0 ? "medium" : "low",
      category: "canonicalization_candidates",
      summary: `${inactiveTeams.length} active Team(s) never appear in any active Game (${inactiveWithStats.length} still have GameStats from orphaned attribution).`,
      count: inactiveTeams.length,
      sample: inactiveTeams.slice(0, 20)
    });
  }

  if (programsWithoutTeams.length > 0) {
    findings.push({
      id: "programs-without-teams",
      severity: "low",
      category: "inventory",
      summary: `${programsWithoutTeams.length} active Program(s) have no active Teams.`,
      count: programsWithoutTeams.length,
      sample: programsWithoutTeams.slice(0, 10).map((p) => ({ id: p.id, fullName: p.fullName }))
    });
  }

  const severityCounts = findings.reduce<Record<Severity, number>>(
    (acc, finding) => {
      acc[finding.severity] = (acc[finding.severity] ?? 0) + 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  );

  const hasCritical = (severityCounts.critical ?? 0) > 0;
  const recommendation =
    hasCritical || blockers.length > 0
      ? "STOP"
      : findings.some((f) => f.severity === "high" || f.severity === "medium")
        ? "PROCEED_WITH_CAUTION"
        : "PROCEED";

  const report = {
    generatedAt: new Date().toISOString(),
    phase: "C-team-resolution-audit",
    mode: "read-only",
    metrics: {
      programs: { active: activeProgramCount, softDeleted: deletedProgramCount, withoutTeams: programsWithoutTeams.length },
      teams: {
        active: activeTeamCount,
        softDeleted: deletedTeamCount,
        withoutProgram: teamsWithoutProgram,
        usedInActiveGames: teamsUsedInGames.size,
        inactiveNoGames: inactiveTeams.length,
        inactiveWithGameStats: inactiveWithStats.length
      },
      teamExternalAlias: {
        total: externalAliasCount,
        teamsCovered: teamsWithExternalAlias[0]?.team_count ?? 0,
        byProvider: externalAliasByProvider,
        splits: externalAliasSplits.length,
        pointingToDeletedTeam: aliasToDeletedTeam
      },
      games: { active: activeGameCount, sourceBuckets: gameSourceBuckets },
      withinProgramExactDuplicates: sameProgramExactDuplicates.length,
      withinProgramDisplayKeyDuplicates: sameProgramDisplayKeyDuplicates.length,
      withinProgramDisplayKeyDuplicatesWithStats: sameProgramDuplicatesWithStats.length,
      crossProgramDisplayKeyCollisions: crossProgramDisplayCollisions.length,
      crossProgramExactNameCollisions: crossProgramExactCollisions.length,
      competitionContextDuplicateGroups: duplicateSameContextGroups.length,
      highImpactContextDuplicates: highImpactContextDuplicates.length,
      activeDeletedTeamNameOverlap: activeDeletedTeamOverlap.length,
      gameStatTeamMismatch: gameStatTeamMismatchCount[0]?.count ?? 0,
      homeAwaySameTeam: homeAwaySameTeamRaw.length,
      canonicalizationCandidates: canonicalizationCandidates.length
    },
    inventory: {
      topProgramsByTeamCount: programsWithTeams
        .sort((a, b) => b._count.teams - a._count.teams)
        .slice(0, 15)
        .map((p) => ({ fullName: p.fullName, teamCount: p._count.teams })),
      topTeamsByGameStats: activeTeams
        .sort((a, b) => b._count.gameStats - a._count.gameStats)
        .slice(0, 15)
        .map((t) => ({
          id: t.id,
          name: t.name,
          programName: t.program?.fullName ?? null,
          gameStats: t._count.gameStats,
          games: t._count.homeGames + t._count.awayGames
        }))
    },
    canonicalizationCandidates: canonicalizationCandidates.slice(0, 30),
    findings,
    severityCounts,
    blockers: Array.from(new Set(blockers)),
    recommendation
  };

  const reportPath = join(process.cwd(), "scripts", "reports", "phase-c-team-resolution-audit-report.json");
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log(JSON.stringify(report, null, 2));
  console.error(`\nWrote ${reportPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
