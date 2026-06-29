/**
 * Validation Phase D — read-only competition coverage audit.
 * Usage: npx tsx scripts/phase-d-competition-coverage-audit.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { SubmissionStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { safeParseSubmissionJson } from "../src/lib/submission-json";

type JsonRecord = Record<string, unknown>;
type CoverageStatus = "complete" | "partial" | "uncertain";
type CompetitionFamily =
  | "ncaa_jrs"
  | "uaap_s88_hs_boys"
  | "uaap_s88_hs_girls"
  | "uaap_s88_16u"
  | "pybc_13u"
  | "pybc_15u"
  | "pybc_other"
  | "stallion_cup"
  | "other";

type StageKind = "eliminations" | "playoffs" | "finals" | "batch" | "regular" | "unknown";

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function inferStageFromTitle(title: string): StageKind {
  const lower = title.toLowerCase();
  if (lower.includes("elimination")) return "eliminations";
  if (lower.includes("playoff")) return "playoffs";
  if (lower.includes("final")) return "finals";
  if (/\d+\s*-\s*\d+/.test(title) || lower.includes("batch")) return "batch";
  return "unknown";
}

function classifyLeagueFamily(leagueName: string): CompetitionFamily {
  const n = leagueName.toLowerCase();
  if (n.includes("ncaa") && n.includes("junior")) return "ncaa_jrs";
  if (n.includes("uaap") && n.includes("hs boys")) return "uaap_s88_hs_boys";
  if (n.includes("uaap") && n.includes("hs girls")) return "uaap_s88_hs_girls";
  if (n.includes("uaap") && n.includes("16u")) return "uaap_s88_16u";
  if (n.includes("13u") || (n.includes("pybc") && n.includes("13"))) return "pybc_13u";
  if (n.includes("pybc") && (n.includes("15") || n === "pybc 15u")) return "pybc_15u";
  if (n.includes("pybc") || n.includes("philippine youth basketball")) return "pybc_other";
  if (n.includes("stallion")) return "stallion_cup";
  return "other";
}

function classifySubmissionFamily(title: string, leagueName: string | null): CompetitionFamily {
  const combined = `${title} ${leagueName ?? ""}`;
  if (/ncaa\s*101\s*jrs/i.test(combined) || /ncaa.*jrs/i.test(combined)) return "ncaa_jrs";
  if (/uaap.*16u/i.test(combined)) return "uaap_s88_16u";
  if (/uaap.*hs.*boys/i.test(combined) || /uaap88.*boys/i.test(combined)) return "uaap_s88_hs_boys";
  if (/uaap.*girls/i.test(combined)) return "uaap_s88_hs_girls";
  if (/pybc.*13u/i.test(combined) || /13u.*playoff|13u.*elimination/i.test(combined)) return "pybc_13u";
  if (/pybc.*15u/i.test(combined)) return "pybc_15u";
  if (/stallion/i.test(combined)) return "stallion_cup";
  return classifyLeagueFamily(leagueName ?? title);
}

function parseSubmissionPayload(input: { rawText: string | null; parsedPreview: unknown }) {
  const parsed = safeParseSubmissionJson(input);
  if (!parsed.ok) return { ok: false as const, error: parsed.errorMessage };

  const root = parsed.data;
  const packages = Array.isArray(root) ? root : [root];
  let games = 0;
  let playerRows = 0;
  const gameNumbers: string[] = [];
  let leagueName = "";
  let seasonName = "";

  for (const pkg of packages) {
    const record = asRecord(pkg);
    if (!record) continue;
    const league = asRecord(record.league);
    const season = asRecord(record.season);
    leagueName = leagueName || stringValue(league?.name);
    seasonName = seasonName || stringValue(season?.name);
    for (const game of asArray(record.games)) {
      const gameRecord = asRecord(game);
      if (!gameRecord) continue;
      games += 1;
      const gameNumber = stringValue(gameRecord.gameNumber);
      if (gameNumber) gameNumbers.push(gameNumber);
      playerRows += asArray(gameRecord.players).length;
    }
  }

  return {
    ok: true as const,
    games,
    playerRows,
    gameNumbers,
    leagueName,
    seasonName
  };
}

function numericGameNumbers(gameNumbers: string[]) {
  return gameNumbers
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
}

function findNumericGaps(values: number[]) {
  if (values.length < 2) return [] as number[];
  const gaps: number[] = [];
  for (let index = 1; index < values.length; index += 1) {
    const prev = values[index - 1];
    const current = values[index];
    for (let missing = prev + 1; missing < current; missing += 1) gaps.push(missing);
  }
  return gaps;
}

function coverageStatus(input: {
  confidence: number;
  submissionGames: number;
  dbGames: number;
  hasSubmissionLineage: boolean;
  missingStages: string[];
  submissionDbDelta: number;
}): CoverageStatus {
  if (!input.hasSubmissionLineage) return "uncertain";
  if (input.missingStages.length > 0 || input.submissionDbDelta > 2 || input.confidence < 60) return "partial";
  if (input.confidence >= 85 && input.submissionGames > 0 && Math.abs(input.submissionGames - input.dbGames) <= 2) {
    return "complete";
  }
  if (input.confidence >= 70) return "partial";
  return "uncertain";
}

function confidenceScore(input: {
  submissionDbDelta: number;
  missingStages: string[];
  gameNumberGaps: number[];
  hasSubmissionLineage: boolean;
  teamFragmentation: boolean;
  lowTeamParticipation: boolean;
  orphanLeague: boolean;
}) {
  let score = 100;
  if (!input.hasSubmissionLineage) score -= 25;
  score -= Math.min(30, input.submissionDbDelta * 3);
  score -= input.missingStages.length * 12;
  score -= Math.min(15, input.gameNumberGaps.length * 2);
  if (input.teamFragmentation) score -= 15;
  if (input.lowTeamParticipation) score -= 10;
  if (input.orphanLeague) score -= 20;
  return Math.max(0, Math.min(100, score));
}

async function main() {
  const blockers: string[] = [];
  const findings: Array<{ id: string; severity: string; summary: string; competition: string }> = [];

  const leagues = await prisma.league.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      ageGroup: true,
      seasons: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          seasonYear: true,
          status: true,
          games: {
            where: { deletedAt: null },
            select: {
              id: true,
              gameNumber: true,
              gameDate: true,
              sourceName: true,
              homeTeamId: true,
              awayTeamId: true,
              _count: { select: { stats: { where: { deletedAt: null } } } }
            }
          }
        }
      }
    },
    orderBy: { name: "asc" }
  });

  const seasonRows: Array<{
    leagueId: string;
    leagueName: string;
    ageGroup: string;
    family: CompetitionFamily;
    seasonId: string;
    seasonName: string;
    seasonYear: number;
    seasonStatus: string;
    games: number;
    gameStats: number;
    distinctTeams: number;
    distinctPlayers: number;
    gameNumbers: string[];
    numericGaps: number[];
    teams: Array<{ teamId: string; teamName: string; gamesPlayed: number; gameStats: number }>;
    sourceBuckets: Record<string, number>;
  }> = [];

  const allTeams = await prisma.team.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true }
  });
  const teamNameById = new Map(allTeams.map((team) => [team.id, team.name]));

  for (const league of leagues) {
    for (const season of league.seasons) {
      if (season.games.length === 0) continue;

      const gameIds = season.games.map((g) => g.id);
      const teamIds = new Set<string>();
      const teamUsage = new Map<string, { teamName: string; gamesPlayed: number; gameStats: number }>();
      const sourceBuckets: Record<string, number> = {};

      for (const game of season.games) {
        let bucket = "other";
        if (game.sourceName.toLowerCase().includes("statshub")) bucket = "statshub_url_import";
        else if (game.sourceName.toLowerCase().includes("spreadsheet") || game.sourceName.toLowerCase().includes("pybc")) {
          bucket = "spreadsheet_upload";
        } else if (game.sourceName.toLowerCase().includes("uaap")) bucket = "uaap_batch";
        else if (game.sourceName.toLowerCase().includes("ncaa")) bucket = "ncaa_batch";
        sourceBuckets[bucket] = (sourceBuckets[bucket] ?? 0) + 1;
      }

      const stats = await prisma.gameStat.findMany({
        where: { deletedAt: null, gameId: { in: gameIds } },
        select: {
          id: true,
          playerId: true,
          teamId: true,
          team: { select: { id: true, name: true } }
        }
      });

      for (const game of season.games) {
        for (const teamId of [game.homeTeamId, game.awayTeamId]) {
          teamIds.add(teamId);
          const teamName = teamNameById.get(teamId) ?? teamId;
          const usage = teamUsage.get(teamId) ?? { teamName, gamesPlayed: 0, gameStats: 0 };
          usage.gamesPlayed += 1;
          teamUsage.set(teamId, usage);
        }
      }

      for (const stat of stats) {
        const usage = teamUsage.get(stat.teamId);
        if (usage) usage.gameStats += 1;
      }

      const gameNumbers = season.games.map((g) => g.gameNumber).filter((n): n is string => Boolean(n));
      const numeric = numericGameNumbers(gameNumbers);
      const numericGaps = findNumericGaps(numeric);

      seasonRows.push({
        leagueId: league.id,
        leagueName: league.name,
        ageGroup: league.ageGroup,
        family: classifyLeagueFamily(league.name),
        seasonId: season.id,
        seasonName: season.name,
        seasonYear: season.seasonYear,
        seasonStatus: season.status,
        games: season.games.length,
        gameStats: stats.length,
        distinctTeams: teamIds.size,
        distinctPlayers: new Set(stats.map((s) => s.playerId)).size,
        gameNumbers,
        numericGaps,
        teams: Array.from(teamUsage.entries())
          .map(([teamId, usage]) => ({ teamId, ...usage }))
          .sort((a, b) => b.gamesPlayed - a.gamesPlayed),
        sourceBuckets
      });
    }
  }

  const importedSubmissions = await prisma.submission.findMany({
    where: { deletedAt: null, status: SubmissionStatus.IMPORTED },
    select: {
      id: true,
      title: true,
      leagueName: true,
      rawText: true,
      parsedPreview: true,
      createdAt: true
    },
    orderBy: { createdAt: "asc" }
  });

  type SubmissionRollup = {
    family: CompetitionFamily;
    stage: StageKind;
    title: string;
    submissionId: string;
    leagueName: string;
    seasonName: string;
    submissionGames: number;
    submissionPlayerRows: number;
    gameNumbers: string[];
  };

  const submissionRollups: SubmissionRollup[] = [];
  for (const submission of importedSubmissions) {
    const payload = parseSubmissionPayload({
      rawText: submission.rawText,
      parsedPreview: submission.parsedPreview
    });
    submissionRollups.push({
      family: classifySubmissionFamily(submission.title, submission.leagueName),
      stage: inferStageFromTitle(submission.title),
      title: submission.title,
      submissionId: submission.id,
      leagueName: payload.ok ? payload.leagueName : submission.leagueName ?? "",
      seasonName: payload.ok ? payload.seasonName : "",
      submissionGames: payload.ok ? payload.games : 0,
      submissionPlayerRows: payload.ok ? payload.playerRows : 0,
      gameNumbers: payload.ok ? payload.gameNumbers : []
    });
  }

  function seasonMatchKey(leagueName: string, seasonName: string) {
    return `${leagueName.trim().toLowerCase()}|${seasonName.trim().toLowerCase()}`;
  }

  const seasonSubmissionTotals = new Map<
    string,
    {
      submissions: number;
      submissionGames: number;
      submissionPlayerRows: number;
      stages: Set<StageKind>;
      titles: string[];
      gameNumbers: string[];
    }
  >();

  for (const row of submissionRollups) {
    const key = row.leagueName && row.seasonName ? seasonMatchKey(row.leagueName, row.seasonName) : "";
    if (!key) continue;
    const bucket = seasonSubmissionTotals.get(key) ?? {
      submissions: 0,
      submissionGames: 0,
      submissionPlayerRows: 0,
      stages: new Set<StageKind>(),
      titles: [],
      gameNumbers: []
    };
    bucket.submissions += 1;
    bucket.submissionGames += row.submissionGames;
    bucket.submissionPlayerRows += row.submissionPlayerRows;
    bucket.stages.add(row.stage);
    bucket.titles.push(row.title);
    bucket.gameNumbers.push(...row.gameNumbers);
    seasonSubmissionTotals.set(key, bucket);
  }

  const familySubmissionTotals = new Map<
    CompetitionFamily,
    {
      submissions: number;
      submissionGames: number;
      submissionPlayerRows: number;
      stages: Set<StageKind>;
      titles: string[];
    }
  >();

  for (const row of submissionRollups) {
    const bucket = familySubmissionTotals.get(row.family) ?? {
      submissions: 0,
      submissionGames: 0,
      submissionPlayerRows: 0,
      stages: new Set<StageKind>(),
      titles: []
    };
    bucket.submissions += 1;
    bucket.submissionGames += row.submissionGames;
    bucket.submissionPlayerRows += row.submissionPlayerRows;
    bucket.stages.add(row.stage);
    bucket.titles.push(row.title);
    familySubmissionTotals.set(row.family, bucket);
  }

  const familyDbTotals = new Map<
    CompetitionFamily,
    { leagues: number; seasons: number; games: number; gameStats: number; teams: number; players: number }
  >();

  for (const row of seasonRows) {
    const bucket = familyDbTotals.get(row.family) ?? {
      leagues: 0,
      seasons: 0,
      games: 0,
      gameStats: 0,
      teams: 0,
      players: 0
    };
    bucket.leagues += 1;
    bucket.seasons += 1;
    bucket.games += row.games;
    bucket.gameStats += row.gameStats;
    bucket.teams += row.distinctTeams;
    bucket.players += row.distinctPlayers;
    familyDbTotals.set(row.family, bucket);
  }

  const expectedStallionStages = ["eliminations", "playoffs"] as const;
  const expectedPybc13Stages = ["eliminations", "playoffs"] as const;

  function missingStagesForFamily(family: CompetitionFamily, stages: Set<StageKind>) {
    const present = Array.from(stages);
    if (family === "stallion_cup") {
      return expectedStallionStages.filter((stage) => !present.includes(stage));
    }
    if (family === "pybc_13u") {
      return expectedPybc13Stages.filter((stage) => !present.includes(stage));
    }
    return [] as string[];
  }

  const coverageMatrix = seasonRows.map((row) => {
    const seasonKey = seasonMatchKey(row.leagueName, row.seasonName);
    const seasonSub = seasonSubmissionTotals.get(seasonKey);
    const familySub = familySubmissionTotals.get(row.family);
    const submissionGames = seasonSub?.submissionGames ?? familySub?.submissionGames ?? 0;
    const submissionSubmissions = seasonSub?.submissions ?? 0;
    const submissionPlayerRows = seasonSub?.submissionPlayerRows ?? 0;
    const stagesInSubmissions = seasonSub
      ? Array.from(seasonSub.stages).sort()
      : familySub
        ? Array.from(familySub.stages).sort()
        : [];
    const hasSubmissionLineage = submissionSubmissions > 0 || (familySub?.submissions ?? 0) > 0;
    const missingStages = seasonSub
      ? missingStagesForFamily(row.family, seasonSub.stages)
      : familySub
        ? missingStagesForFamily(row.family, familySub.stages)
        : [];
    const submissionDbDelta = submissionSubmissions > 0 ? Math.abs(submissionGames - row.games) : 0;
    const teamFragmentation =
      row.family === "ncaa_jrs" ||
      (row.family === "pybc_13u" &&
        row.teams.filter((t) => /smile\s*360/i.test(t.teamName)).length > 1);
    const minGamesPerTeam = row.teams.length ? Math.min(...row.teams.map((t) => t.gamesPlayed)) : 0;
    const lowTeamParticipation = row.distinctTeams >= 6 && minGamesPerTeam <= 2;
    const confidence = confidenceScore({
      submissionDbDelta,
      missingStages,
      gameNumberGaps: row.numericGaps,
      hasSubmissionLineage: submissionSubmissions > 0,
      teamFragmentation,
      lowTeamParticipation,
      orphanLeague: row.games > 0 && submissionSubmissions === 0 && !(familySub?.submissions ?? 0)
    });
    const status = coverageStatus({
      confidence,
      submissionGames: submissionSubmissions > 0 ? submissionGames : 0,
      dbGames: row.games,
      hasSubmissionLineage: submissionSubmissions > 0,
      missingStages: submissionSubmissions > 0 ? missingStages : [],
      submissionDbDelta
    });

    return {
      competitionKey: `${row.leagueName} :: ${row.seasonName}`,
      family: row.family,
      leagueName: row.leagueName,
      seasonName: row.seasonName,
      ageGroup: row.ageGroup,
      seasonStatus: row.seasonStatus,
      dbGames: row.games,
      dbGameStats: row.gameStats,
      dbTeams: row.distinctTeams,
      dbPlayers: row.distinctPlayers,
      submissionSubmissions,
      submissionGames: submissionSubmissions > 0 ? submissionGames : 0,
      submissionPlayerRows,
      submissionDbGameDelta: submissionSubmissions > 0 ? submissionGames - row.games : null,
      stagesInSubmissions,
      missingStages: submissionSubmissions > 0 ? missingStages : [],
      gameNumberGaps: row.numericGaps.slice(0, 20),
      gameNumberRange:
        row.numericGaps.length || numericGameNumbers(row.gameNumbers).length
          ? {
              min: numericGameNumbers(row.gameNumbers)[0] ?? null,
              max: numericGameNumbers(row.gameNumbers).at(-1) ?? null,
              gapCount: row.numericGaps.length
            }
          : null,
      sourceBuckets: row.sourceBuckets,
      minGamesPerTeam,
      maxGamesPerTeam: row.teams.length ? Math.max(...row.teams.map((t) => t.gamesPlayed)) : 0,
      teamFragmentationFlag: teamFragmentation,
      coverageStatus: status,
      confidenceScore: confidence
    };
  });

  const familyAggregates = Array.from(
    new Set([...familyDbTotals.keys(), ...familySubmissionTotals.keys()])
  )
    .sort()
    .map((family) => {
      const db = familyDbTotals.get(family) ?? {
        leagues: 0,
        seasons: 0,
        games: 0,
        gameStats: 0,
        teams: 0,
        players: 0
      };
      const sub = familySubmissionTotals.get(family);
      const missingStages = sub ? missingStagesForFamily(family, sub.stages) : [];
      const hasSubmissionLineage = (sub?.submissions ?? 0) > 0;
      const submissionDbDelta = Math.abs((sub?.submissionGames ?? 0) - db.games);
      const familySeasons = coverageMatrix.filter((row) => row.family === family);
      const avgConfidence =
        familySeasons.length > 0
          ? Math.round(familySeasons.reduce((sum, row) => sum + row.confidenceScore, 0) / familySeasons.length)
          : 0;
      const teamFragmentation = family === "ncaa_jrs" || familySeasons.some((s) => s.teamFragmentationFlag);
      const confidence = confidenceScore({
        submissionDbDelta: hasSubmissionLineage ? submissionDbDelta : 0,
        missingStages,
        gameNumberGaps: familySeasons.flatMap((s) => s.gameNumberGaps),
        hasSubmissionLineage,
        teamFragmentation,
        lowTeamParticipation: familySeasons.some((s) => s.minGamesPerTeam <= 2 && s.dbTeams >= 6),
        orphanLeague: db.games > 0 && !hasSubmissionLineage
      });
      const status = coverageStatus({
        confidence,
        submissionGames: sub?.submissionGames ?? 0,
        dbGames: db.games,
        hasSubmissionLineage,
        missingStages,
        submissionDbDelta
      });

      return {
        family,
        db,
        submissions: sub?.submissions ?? 0,
        submissionGames: sub?.submissionGames ?? 0,
        submissionPlayerRows: sub?.submissionPlayerRows ?? 0,
        submissionDbGameDelta: (sub?.submissionGames ?? 0) - db.games,
        stagesInSubmissions: sub ? Array.from(sub.stages).sort() : [],
        missingStages,
        coverageStatus: status,
        confidenceScore: confidence,
        seasonCount: familySeasons.length
      };
    });

  for (const row of coverageMatrix) {
    if (row.submissionSubmissions > 0 && row.missingStages.length > 0) {
      findings.push({
        id: "missing-submission-stage",
        severity: "high",
        summary: `Missing submission stage(s): ${row.missingStages.join(", ")}`,
        competition: row.competitionKey
      });
    }
    if (row.gameNumberGaps.length > 0) {
      findings.push({
        id: "game-number-gaps",
        severity: row.gameNumberGaps.length > 5 ? "medium" : "low",
        summary: `${row.gameNumberGaps.length} numeric game-number gap(s) in season schedule`,
        competition: row.competitionKey
      });
    }
    if (!row.submissionSubmissions && row.dbGames > 0) {
      findings.push({
        id: "no-submission-lineage",
        severity: "medium",
        summary: `${row.dbGames} DB game(s) with no IMPORTED submission lineage`,
        competition: row.competitionKey
      });
    }
    if (row.teamFragmentationFlag) {
      findings.push({
        id: "team-fragmentation-blocker",
        severity: "high",
        summary: "Phase C team fragmentation affects this competition",
        competition: row.competitionKey
      });
      blockers.push(`Team identity fragmentation in ${row.competitionKey} (Phase C).`);
    }
    if (row.submissionSubmissions > 0 && row.coverageStatus === "partial" && row.submissionDbGameDelta !== null && Math.abs(row.submissionDbGameDelta) > 2) {
      findings.push({
        id: "submission-db-game-mismatch",
        severity: "medium",
        summary: `Submission JSON games (${row.submissionGames}) vs DB games (${row.dbGames}) delta ${row.submissionDbGameDelta}`,
        competition: row.competitionKey
      });
    }
  }

  const ncaaRow = familyAggregates.find((f) => f.family === "ncaa_jrs");
  if (ncaaRow) {
    blockers.push("NCAA JRS: Phase C duplicate team pairs split GameStats — standings coverage not canonical.");
  }

  const uaapHs = familyAggregates.filter(
    (f) => f.family === "uaap_s88_hs_boys" || f.family === "uaap_s88_hs_girls"
  );
  for (const row of uaapHs) {
    if (row.db.games > 0 && row.submissions === 0) {
      blockers.push(
        `${row.family}: ${row.db.games} games imported without submission inventory — coverage lineage uncertain.`
      );
    }
  }

  const pybc13 = coverageMatrix.find((r) => r.family === "pybc_13u");
  if (pybc13?.teamFragmentationFlag) {
    blockers.push("PYBC 13U: Smile 360 team fragmentation (Phase C) affects participation counts.");
  }

  const globalConfidence =
    coverageMatrix.length > 0
      ? Math.round(coverageMatrix.reduce((sum, row) => sum + row.confidenceScore, 0) / coverageMatrix.length)
      : 0;

  const hasCriticalBlockers = blockers.length > 0;
  const hasPartialFamilies = familyAggregates.some((f) => f.coverageStatus !== "complete");
  const recommendation =
    hasCriticalBlockers || globalConfidence < 55
      ? "STOP"
      : hasPartialFamilies || globalConfidence < 75
        ? "PROCEED_WITH_CAUTION"
        : "PROCEED";

  const report = {
    generatedAt: new Date().toISOString(),
    phase: "D-competition-coverage-audit",
    mode: "read-only",
    metrics: {
      leaguesWithGames: new Set(seasonRows.map((r) => r.leagueId)).size,
      seasonsWithGames: seasonRows.length,
      totalDbGames: seasonRows.reduce((sum, r) => sum + r.games, 0),
      totalDbGameStats: seasonRows.reduce((sum, r) => sum + r.gameStats, 0),
      importedSubmissions: importedSubmissions.length,
      submissionGamesTotal: submissionRollups.reduce((sum, r) => sum + r.submissionGames, 0),
      submissionPlayerRowsTotal: submissionRollups.reduce((sum, r) => sum + r.submissionPlayerRows, 0),
      globalConfidenceScore: globalConfidence,
      familyCount: familyAggregates.length
    },
    familyAggregates,
    coverageMatrix,
    submissionRollupsByFamily: Object.fromEntries(
      Array.from(familySubmissionTotals.entries()).map(([family, data]) => [
        family,
        {
          ...data,
          stages: Array.from(data.stages).sort(),
          titles: data.titles
        }
      ])
    ),
    findings,
    blockers: Array.from(new Set(blockers)),
    recommendation
  };

  const reportPath = join(process.cwd(), "scripts", "reports", "phase-d-competition-coverage-audit-report.json");
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
