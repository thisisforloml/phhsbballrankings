import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { prisma } from "../src/lib/prisma";

const genericReportPath = join(process.cwd(), "scripts", "reports", "generic-team-retirement-plan.json");
const canonicalReportPath = join(process.cwd(), "scripts", "reports", "legacy-team-canonicalization-plan.json");
const jsonReportPath = join(process.cwd(), "scripts", "reports", "zero-reference-legacy-team-cleanup-plan.json");
const markdownReportPath = join(process.cwd(), "scripts", "reports", "zero-reference-legacy-team-cleanup-plan.md");
const execute = process.argv.includes("--execute");

type Candidate = {
  teamId: string;
  teamName: string;
  programId: string | null;
  programName: string | null;
  reasons: string[];
};

type CleanupReport = {
  generatedAt: string;
  mode: string;
  action: "ARCHIVE_ZERO_REFERENCE";
  candidateCount: number;
  candidates: Array<Candidate & { referenceCounts: ReferenceCounts }>;
};

type ReferenceCounts = {
  playerTeamSeason: number;
  gameStat: number;
  gameHome: number;
  gameAway: number;
  gameHomeAway: number;
  teamRating: number;
  submissionImportDraft: number;
  total: number;
};

function uniqueByTeamId(candidates: Candidate[]) {
  return Array.from(new Map(candidates.map((candidate) => [candidate.teamId, candidate])).values()).sort((left, right) =>
    `${left.programName ?? ""}:${left.teamName}`.localeCompare(`${right.programName ?? ""}:${right.teamName}`, undefined, { numeric: true })
  );
}

function loadPlannedCandidates() {
  const candidates: Candidate[] = [];
  const genericReport = JSON.parse(readFileSync(genericReportPath, "utf8"));
  for (const candidate of genericReport.candidates ?? []) {
    if (candidate.recommendation !== "SAFE_TO_RETIRE_FROM_ACTIVE_UI") continue;
    candidates.push({
      teamId: candidate.genericTeamId,
      teamName: candidate.genericTeamName,
      programId: candidate.programId ?? null,
      programName: candidate.programName ?? null,
      reasons: candidate.reason ?? ["generic Team retirement report safe candidate"]
    });
  }

  const canonicalReport = JSON.parse(readFileSync(canonicalReportPath, "utf8"));
  for (const candidate of canonicalReport.candidates ?? []) {
    if (candidate.recommendation !== "SAFE_TO_DELETE_ZERO_REFERENCES") continue;
    candidates.push({
      teamId: candidate.legacyTeamId,
      teamName: candidate.legacyTeamName,
      programId: candidate.programId ?? null,
      programName: candidate.programName ?? null,
      reasons: candidate.legacyReasons ?? ["legacy Team canonicalization zero-reference candidate"]
    });
  }

  return uniqueByTeamId(candidates);
}

async function referenceCounts(teamId: string): Promise<ReferenceCounts> {
  const [playerTeamSeason, gameStat, gameHome, gameAway, teamRating] = await Promise.all([
    prisma.playerTeamSeason.count({ where: { teamId } }),
    prisma.gameStat.count({ where: { teamId } }),
    prisma.game.count({ where: { homeTeamId: teamId } }),
    prisma.game.count({ where: { awayTeamId: teamId } }),
    prisma.teamRating.count({ where: { teamId } })
  ]);
  const gameHomeAway = gameHome + gameAway;
  const submissionImportDraft = 0;
  return {
    playerTeamSeason,
    gameStat,
    gameHome,
    gameAway,
    gameHomeAway,
    teamRating,
    submissionImportDraft,
    total: playerTeamSeason + gameStat + gameHomeAway + teamRating + submissionImportDraft
  };
}

async function protectedCounts() {
  const [games, gameStats, gamePerformanceScores, playerRatings, rankingSnapshots, rankingSnapshotRows, players, programs, teams, activeTeams] =
    await Promise.all([
      prisma.game.count(),
      prisma.gameStat.count(),
      prisma.gamePerformanceScore.count(),
      prisma.playerRating.count(),
      prisma.rankingSnapshot.count(),
      prisma.rankingSnapshotRow.count(),
      prisma.player.count(),
      prisma.program.count(),
      prisma.team.count(),
      prisma.team.count({ where: { deletedAt: null } })
    ]);
  return { games, gameStats, gamePerformanceScores, playerRatings, rankingSnapshots, rankingSnapshotRows, players, programs, teams, activeTeams };
}

function assertProtectedCounts(
  before: Awaited<ReturnType<typeof protectedCounts>>,
  after: Awaited<ReturnType<typeof protectedCounts>>,
  archivedCount: number
) {
  const unchangedKeys = ["games", "gameStats", "gamePerformanceScores", "playerRatings", "rankingSnapshots", "rankingSnapshotRows", "players", "programs", "teams"] as const;
  const changed = unchangedKeys.filter((key) => before[key] !== after[key]);
  if (changed.length) {
    throw new Error(`Protected counts changed unexpectedly: ${changed.map((key) => `${key} ${before[key]} -> ${after[key]}`).join(", ")}`);
  }
  if (before.activeTeams - after.activeTeams !== archivedCount) {
    throw new Error(`Active Team count delta mismatch: expected ${archivedCount}, found ${before.activeTeams - after.activeTeams}`);
  }
}

function buildMarkdown(report: CleanupReport) {
  const lines = [
    "# Zero-reference Legacy Team Cleanup Plan",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Mode: ${report.mode}`,
    "",
    `Action: ${report.action}`,
    "",
    `Candidate count: ${report.candidateCount}`,
    "",
    "| Program | Team | Team ID | Reasons | References |",
    "| --- | --- | --- | --- | --- |"
  ];
  for (const candidate of report.candidates) {
    lines.push(
      `| ${candidate.programName ?? "—"} | ${candidate.teamName} | ${candidate.teamId} | ${candidate.reasons.join("; ")} | total ${candidate.referenceCounts.total} |`
    );
  }
  return `${lines.join("\n")}\n`;
}

async function buildCurrentReport(mode: string): Promise<CleanupReport> {
  const planned = loadPlannedCandidates();
  const existingTeams = await prisma.team.findMany({
    where: { id: { in: planned.map((candidate) => candidate.teamId) }, deletedAt: null },
    include: { program: true }
  });
  const existingById = new Map(existingTeams.map((team) => [team.id, team]));
  const candidates = [];
  for (const candidate of planned) {
    const team = existingById.get(candidate.teamId);
    if (!team) continue;
    const counts = await referenceCounts(candidate.teamId);
    if (counts.total !== 0) continue;
    candidates.push({
      ...candidate,
      teamName: team.name,
      programId: team.programId,
      programName: team.program?.fullName ?? candidate.programName,
      referenceCounts: counts
    });
  }
  return {
    generatedAt: new Date().toISOString(),
    mode,
    action: "ARCHIVE_ZERO_REFERENCE",
    candidateCount: candidates.length,
    candidates
  };
}

function assertSameCandidateSet(previous: CleanupReport, current: CleanupReport) {
  const previousIds = previous.candidates.map((candidate) => candidate.teamId).sort();
  const currentIds = current.candidates.map((candidate) => candidate.teamId).sort();
  if (previousIds.length !== currentIds.length || previousIds.some((id, index) => id !== currentIds[index])) {
    throw new Error(`Candidate set changed since dry-run. Previous=${previousIds.join(", ")} Current=${currentIds.join(", ")}`);
  }
}

async function main() {
  if (!execute) {
    const report = await buildCurrentReport("dry-run-read-only");
    mkdirSync(dirname(jsonReportPath), { recursive: true });
    writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(markdownReportPath, buildMarkdown(report));
    console.log(JSON.stringify({
      jsonReportPath,
      markdownReportPath,
      action: report.action,
      candidateCount: report.candidateCount,
      candidates: report.candidates.map((candidate) => ({
        teamId: candidate.teamId,
        teamName: candidate.teamName,
        programName: candidate.programName,
        reasons: candidate.reasons,
        referenceCounts: candidate.referenceCounts
      })),
      writesPerformed: false
    }, null, 2));
    return;
  }

  const previous = JSON.parse(readFileSync(jsonReportPath, "utf8")) as CleanupReport;
  const current = await buildCurrentReport("execute-validation");
  assertSameCandidateSet(previous, current);
  if (!current.candidateCount) throw new Error("No zero-reference Teams are available for cleanup.");
  for (const candidate of current.candidates) {
    if (candidate.referenceCounts.total !== 0) {
      throw new Error(`Refusing to archive referenced Team ${candidate.teamName} (${candidate.teamId})`);
    }
  }

  const before = await protectedCounts();
  const archivedAt = new Date();
  await prisma.$transaction(async (tx) => {
    for (const candidate of current.candidates) {
      const result = await tx.team.updateMany({
        where: {
          id: candidate.teamId,
          deletedAt: null,
          rosterSeasons: { none: {} },
          gameStats: { none: {} },
          homeGames: { none: {} },
          awayGames: { none: {} },
          teamRatings: { none: {} }
        },
        data: { deletedAt: archivedAt }
      });
      if (result.count !== 1) {
        throw new Error(`Expected to archive exactly one Team ${candidate.teamName} (${candidate.teamId}), archived ${result.count}`);
      }
    }
  });
  const after = await protectedCounts();
  assertProtectedCounts(before, after, current.candidateCount);

  const executedReport: CleanupReport & {
    executedAt: string;
    archivedCount: number;
    protectedCountsBefore: Awaited<ReturnType<typeof protectedCounts>>;
    protectedCountsAfter: Awaited<ReturnType<typeof protectedCounts>>;
  } = {
    ...current,
    mode: "executed",
    executedAt: archivedAt.toISOString(),
    archivedCount: current.candidateCount,
    protectedCountsBefore: before,
    protectedCountsAfter: after
  };
  writeFileSync(jsonReportPath, `${JSON.stringify(executedReport, null, 2)}\n`);
  writeFileSync(markdownReportPath, buildMarkdown(executedReport));
  console.log(JSON.stringify({
    action: executedReport.action,
    archivedCount: executedReport.archivedCount,
    archivedTeams: executedReport.candidates.map((candidate) => ({
      teamId: candidate.teamId,
      teamName: candidate.teamName,
      programName: candidate.programName
    })),
    protectedCountsBefore: before,
    protectedCountsAfter: after,
    writesPerformed: true
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
