import { stat } from "node:fs/promises";
import path from "node:path";

import { ProgramRole } from "@prisma/client";

import { buildProgramsById, type ProgramHierarchyRecord } from "@/lib/admin/program-hierarchy";
import { prisma } from "@/lib/prisma";
import { getActivePolicyVersionId } from "@/lib/ratings/active-formula";
import { activeSubmissionWhere } from "@/lib/submission-lifecycle";

const DATA_HEALTH_CACHE_MS = 5 * 60 * 1000;

export type DataHealthSeverity = "critical" | "warning" | "info";

export type DataHealthIssue = {
  id: string;
  label: string;
  count: number;
  severity: DataHealthSeverity;
  href: string;
};

export type DataHealthSection = {
  id: string;
  title: string;
  issues: DataHealthIssue[];
};

export type DataHealthDiagnostic = {
  id: string;
  name: string;
  description: string;
  href: string;
  lastRunAt: string | null;
};

export type DataHealthCenterData = {
  auditedAt: string;
  overview: {
    healthScore: number;
    critical: number;
    warnings: number;
    information: number;
  };
  sections: DataHealthSection[];
  diagnostics: DataHealthDiagnostic[];
};

let dataHealthCenterCache: { value: DataHealthCenterData; loadedAt: number } | null = null;

export function clearDataHealthCenterCache() {
  dataHealthCenterCache = null;
}

function issue(
  id: string,
  label: string,
  count: number,
  severity: DataHealthSeverity,
  href: string,
): DataHealthIssue {
  return { id, label, count, severity, href };
}

function scoreHealth(issues: DataHealthIssue[]) {
  let healthScore = 100;
  let critical = 0;
  let warnings = 0;
  let information = 0;

  for (const row of issues) {
    if (row.count <= 0) continue;
    if (row.severity === "critical") {
      healthScore -= 12;
      critical += row.count;
    } else if (row.severity === "warning") {
      healthScore -= 5;
      warnings += row.count;
    } else {
      healthScore -= 1;
      information += row.count;
    }
  }

  return {
    healthScore: Math.max(0, Math.min(100, healthScore)),
    critical,
    warnings,
    information,
  };
}

async function countPlayerDuplicateGroups() {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM (
      SELECT LOWER(p."displayName") AS key_a, p.gender::text AS key_b
      FROM players p
      WHERE p."deletedAt" IS NULL
      GROUP BY LOWER(p."displayName"), p.gender
      HAVING COUNT(*) > 1
    ) groups
  `;
  return Number(rows[0]?.count ?? 0);
}

async function countTeamDuplicateNameGroups() {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM (
      SELECT LOWER(t.name) AS key_a
      FROM teams t
      WHERE t."deletedAt" IS NULL
      GROUP BY LOWER(t.name)
      HAVING COUNT(*) > 1
    ) groups
  `;
  return Number(rows[0]?.count ?? 0);
}

async function countDuplicateSubmissions() {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM submissions s
    WHERE s."deletedAt" IS NULL
      AND jsonb_typeof(s."validationSummary"->'duplicatePlayerNamesWithinGames') = 'array'
      AND jsonb_array_length(s."validationSummary"->'duplicatePlayerNamesWithinGames') > 0
  `;
  return Number(rows[0]?.count ?? 0);
}

function detectCircularHierarchy(programs: ProgramHierarchyRecord[]) {
  const programsById = buildProgramsById(programs);
  let circular = 0;

  for (const program of programs.filter((row) => !row.deletedAt)) {
    if (!program.parentProgramId) continue;
    const visited = new Set<string>();
    let cursor: string | null = program.parentProgramId;
    let isCircular = false;

    while (cursor) {
      if (cursor === program.id || visited.has(cursor)) {
        isCircular = true;
        break;
      }
      visited.add(cursor);
      cursor = programsById.get(cursor)?.parentProgramId ?? null;
    }

    if (isCircular) circular += 1;
  }

  return circular;
}

async function readReportMtime(filename: string) {
  try {
    const fileStat = await stat(path.join(process.cwd(), "scripts", "reports", filename));
    return fileStat.mtime.toISOString();
  } catch {
    return null;
  }
}

async function loadDataHealthCenterUncached(): Promise<DataHealthCenterData> {
  const activePolicyVersionId = getActivePolicyVersionId();
  const auditedAt = new Date().toISOString();

  const [
    playersWithoutPrograms,
    playersWithoutRatings,
    playersDuplicateGroups,
    playersOnGroupPrograms,
    playersOnArchivedPrograms,
    playersMissingDob,
    playersMissingRecruitingClass,
    playersSchoolOverrideMismatch,
    teamsWithoutPrograms,
    teamsOnArchivedPrograms,
    teamsOnGroupPrograms,
    teamsWithoutCompetitions,
    teamsDuplicateNames,
    teamsMixedContexts,
    teamsMissingCities,
    programsWithoutTeams,
    groupProgramsWithoutChildren,
    archivedProgramsWithActiveChildren,
    programsDuplicateAbbreviations,
    programsDuplicateNames,
    programs,
    competitionsWithoutSeasons,
    playersVerifiedNoRating,
    multipleActiveRatings,
    snapshotInconsistencies,
    ratingPolicyMismatches,
    pendingImports,
    failedImports,
    duplicateSubmissions,
  ] = await Promise.all([
    prisma.player.count({ where: { deletedAt: null, currentProgramId: null } }),
    prisma.player.count({
      where: { deletedAt: null, currentRatings: { none: { policyVersionId: activePolicyVersionId } } },
    }),
    countPlayerDuplicateGroups(),
    prisma.player.count({
      where: {
        deletedAt: null,
        currentProgram: { programRole: ProgramRole.GROUP, deletedAt: null },
      },
    }),
    prisma.player.count({
      where: { deletedAt: null, currentProgram: { deletedAt: { not: null } } },
    }),
    prisma.player.count({ where: { deletedAt: null, birthDate: null } }),
    prisma.player.count({
      where: { deletedAt: null, birthDate: null, classYearOverride: null },
    }),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM players p
      INNER JOIN programs pr ON pr.id = p."currentProgramId"
      WHERE p."deletedAt" IS NULL
        AND p."schoolOverride" IS NOT NULL
        AND TRIM(p."schoolOverride") <> ''
        AND LOWER(TRIM(p."schoolOverride")) <> LOWER(TRIM(pr."fullName"))
    `.then((rows) => Number(rows[0]?.count ?? 0)),
    prisma.team.count({ where: { deletedAt: null, programId: null } }),
    prisma.team.count({
      where: { deletedAt: null, program: { deletedAt: { not: null } } },
    }),
    prisma.team.count({
      where: {
        deletedAt: null,
        program: { programRole: ProgramRole.GROUP, deletedAt: null },
      },
    }),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM teams t
      WHERE t."deletedAt" IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM game_stats gs
          INNER JOIN games g ON g.id = gs."gameId"
          WHERE gs."teamId" = t.id
            AND gs."deletedAt" IS NULL
            AND g."deletedAt" IS NULL
            AND g."verificationStatus" IN ('VERIFIED', 'SUBMITTED')
        )
    `.then((rows) => Number(rows[0]?.count ?? 0)),
    countTeamDuplicateNameGroups(),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM (
        SELECT t.id
        FROM teams t
        INNER JOIN games g ON (g."homeTeamId" = t.id OR g."awayTeamId" = t.id)
        INNER JOIN seasons s ON s.id = g."seasonId"
        INNER JOIN leagues l ON l.id = s."leagueId"
        WHERE t."deletedAt" IS NULL
          AND g."deletedAt" IS NULL
          AND g."verificationStatus" IN ('VERIFIED', 'SUBMITTED')
        GROUP BY t.id
        HAVING COUNT(DISTINCT (
          COALESCE(
            SUBSTRING(UPPER(l.name) FROM 'U\s*(1[3-9])'),
            SUBSTRING(UPPER(l.name) FROM '(1[3-9])\s*U'),
            l."ageGroup"::text
          ) || '|' || CASE WHEN UPPER(l.name) ~ '(GIRLS?|LADY|TIGRESS)' THEN 'GIRLS' ELSE 'BOYS' END
        )) > 1
      ) mixed
    `.then((rows) => Number(rows[0]?.count ?? 0)),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM teams t
      WHERE t."deletedAt" IS NULL
        AND (t.city IS NULL OR TRIM(t.city) = '')
    `.then((rows) => Number(rows[0]?.count ?? 0)),
    prisma.program.count({
      where: {
        deletedAt: null,
        programRole: ProgramRole.OPERATIONAL,
        teams: { none: { deletedAt: null } },
      },
    }),
    prisma.program.count({
      where: {
        deletedAt: null,
        programRole: ProgramRole.GROUP,
        childPrograms: { none: { deletedAt: null } },
      },
    }),
    prisma.program.count({
      where: {
        deletedAt: { not: null },
        childPrograms: { some: { deletedAt: null } },
      },
    }),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM (
        SELECT LOWER(p.abbreviation) AS key_a
        FROM programs p
        WHERE p."deletedAt" IS NULL AND p.abbreviation IS NOT NULL AND TRIM(p.abbreviation) <> ''
        GROUP BY LOWER(p.abbreviation)
        HAVING COUNT(*) > 1
      ) groups
    `.then((rows) => Number(rows[0]?.count ?? 0)),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM (
        SELECT LOWER(p."fullName") AS key_a
        FROM programs p
        WHERE p."deletedAt" IS NULL
        GROUP BY LOWER(p."fullName")
        HAVING COUNT(*) > 1
      ) groups
    `.then((rows) => Number(rows[0]?.count ?? 0)),
    prisma.program.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        fullName: true,
        abbreviation: true,
        parentProgramId: true,
        programRole: true,
        deletedAt: true,
      },
    }),
    prisma.league.count({
      where: { deletedAt: null, seasons: { none: { deletedAt: null } } },
    }),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT gs."playerId")::bigint AS count
      FROM game_stats gs
      INNER JOIN games g ON g.id = gs."gameId"
      LEFT JOIN player_ratings pr ON pr."playerId" = gs."playerId" AND pr."policyVersionId" = ${activePolicyVersionId}
      WHERE gs."deletedAt" IS NULL
        AND g."deletedAt" IS NULL
        AND g."verificationStatus" IN ('VERIFIED', 'SUBMITTED')
        AND pr.id IS NULL
    `.then((rows) => Number(rows[0]?.count ?? 0)),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM (
        SELECT "playerId", "ageGroup"
        FROM player_ratings
        WHERE "policyVersionId" = ${activePolicyVersionId}
        GROUP BY "playerId", "ageGroup"
        HAVING COUNT(*) > 1
      ) groups
    `.then((rows) => Number(rows[0]?.count ?? 0)),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM player_ratings pr
      WHERE pr."policyVersionId" = ${activePolicyVersionId}
        AND EXISTS (
          SELECT 1
          FROM ranking_snapshot_rows rr
          INNER JOIN ranking_snapshots rs ON rs.id = rr."snapshotId"
          WHERE rr."playerId" = pr."playerId"
            AND rs.scope = 'NATIONAL'
            AND ABS(rr.rating::numeric - pr."adjustedRating"::numeric) > 0.05
            AND rs."weekOf" = (
              SELECT MAX(rs2."weekOf")
              FROM ranking_snapshot_rows rr2
              INNER JOIN ranking_snapshots rs2 ON rs2.id = rr2."snapshotId"
              WHERE rr2."playerId" = pr."playerId" AND rs2.scope = 'NATIONAL'
            )
        )
    `.then((rows) => Number(rows[0]?.count ?? 0)),
    prisma.playerRating.count({
      where: { NOT: { policyVersionId: activePolicyVersionId } },
    }),
    prisma.submission.count({
      where: {
        ...activeSubmissionWhere,
        status: { in: ["SUBMITTED", "UNDER_REVIEW", "DRAFT", "APPROVED"] },
      },
    }),
    prisma.submission.count({
      where: { ...activeSubmissionWhere, status: "REJECTED" },
    }),
    countDuplicateSubmissions(),
  ]);

  const circularHierarchy = detectCircularHierarchy(programs);

  const sections: DataHealthSection[] = [
    {
      id: "players",
      title: "Players",
      issues: [
        issue("players-without-programs", "Players without programs", playersWithoutPrograms, "warning", "/admin/players?program=Program%20pending"),
        issue("players-without-ratings", "Players without ratings", playersWithoutRatings, "info", "/admin/players"),
        issue("players-duplicate-candidates", "Players with duplicate candidates", playersDuplicateGroups, "warning", "/admin/data-health/player-duplicates"),
        issue("players-group-programs", "Players assigned directly to Organizations", playersOnGroupPrograms, "critical", "/admin/players"),
        issue("players-archived-programs", "Players with archived programs", playersOnArchivedPrograms, "critical", "/admin/players"),
        issue("players-missing-dob", "Players missing DOB", playersMissingDob, "info", "/admin/players"),
        issue("players-missing-class", "Players missing recruiting class", playersMissingRecruitingClass, "info", "/admin/players"),
        issue("players-school-override-mismatch", "Players with school override mismatch", playersSchoolOverrideMismatch, "info", "/admin/players"),
      ],
    },
    {
      id: "teams",
      title: "Teams",
      issues: [
        issue("teams-without-programs", "Teams without programs", teamsWithoutPrograms, "warning", "/admin/teams"),
        issue("teams-archived-programs", "Teams assigned to archived programs", teamsOnArchivedPrograms, "critical", "/admin/teams"),
        issue("teams-group-programs", "Teams assigned directly to Organizations", teamsOnGroupPrograms, "critical", "/admin/teams"),
        issue("teams-without-competitions", "Teams without competitions", teamsWithoutCompetitions, "warning", "/admin/teams"),
        issue("teams-duplicate-names", "Teams with duplicate names", teamsDuplicateNames, "warning", "/admin/teams"),
        issue("teams-mixed-contexts", "Teams spanning multiple brackets", teamsMixedContexts, "critical", "/admin/teams"),
        issue("teams-missing-cities", "Teams with missing cities", teamsMissingCities, "info", "/admin/teams"),
      ],
    },
    {
      id: "programs",
      title: "Programs",
      issues: [
        issue("programs-without-teams", "Programs without teams", programsWithoutTeams, "warning", "/admin/programs"),
        issue("group-without-children", "Organizations without Programs", groupProgramsWithoutChildren, "warning", "/admin/programs"),
        issue("archived-with-active-children", "Archived organizations with active Programs", archivedProgramsWithActiveChildren, "critical", "/admin/programs"),
        issue("circular-hierarchy", "Circular hierarchy attempts", circularHierarchy, "critical", "/admin/programs"),
        issue("programs-duplicate-abbreviations", "Duplicate abbreviations", programsDuplicateAbbreviations, "warning", "/admin/programs"),
        issue("programs-duplicate-names", "Duplicate names", programsDuplicateNames, "warning", "/admin/programs"),
      ],
    },
    {
      id: "competitions",
      title: "Leagues & Competitions",
      issues: [
        issue("competitions-without-seasons", "Leagues without seasons", competitionsWithoutSeasons, "warning", "/admin/leagues"),
      ],
    },
    {
      id: "ratings",
      title: "Ratings",
      issues: [
        issue("verified-no-rating", "Players with verified games but no ratings", playersVerifiedNoRating, "warning", "/admin/players"),
        issue("multiple-active-ratings", "Multiple active ratings", multipleActiveRatings, "critical", "/admin/team-ratings"),
        issue("snapshot-inconsistencies", "Snapshot inconsistencies", snapshotInconsistencies, "info", "/admin/team-ratings"),
        issue("rating-policy-mismatches", "Rating policy mismatches", ratingPolicyMismatches, "warning", "/admin/team-ratings"),
      ],
    },
    {
      id: "imports",
      title: "Imports",
      issues: [
        issue("pending-imports", "Pending imports", pendingImports, "warning", "/admin/submissions"),
        issue("failed-imports", "Failed imports", failedImports, "critical", "/admin/submissions"),
        issue("duplicate-submissions", "Duplicate submissions", duplicateSubmissions, "warning", "/admin/submissions"),
      ],
    },
  ];

  const allIssues = sections.flatMap((section) => section.issues);
  const overview = scoreHealth(allIssues);

  const [
    duplicatePlanMtime,
    phaseIntegrityMtime,
    postCleanupMtime,
    teamDuplicateMtime,
  ] = await Promise.all([
    readReportMtime("duplicate-cleanup-plan.json"),
    readReportMtime("phase-f-final-system-integrity-audit-report.json"),
    readReportMtime("post-cleanup-data-health-audit.json"),
    readReportMtime("team-duplicate-cleanup-audit.json"),
  ]);

  const diagnostics: DataHealthDiagnostic[] = [
    {
      id: "player-integrity-engine",
      name: "Player integrity engine",
      description: "Per-player diagnostics across program, competition, ratings, and profile integrity.",
      href: "/admin/players",
      lastRunAt: auditedAt,
    },
    {
      id: "duplicate-detection-engine",
      name: "Duplicate detection engine",
      description: "Weighted duplicate candidate scoring for players.",
      href: "/admin/data-health/player-duplicates",
      lastRunAt: duplicatePlanMtime,
    },
    {
      id: "hierarchy-validator",
      name: "Program hierarchy validator",
      description: "Organization and Program grouping rules.",
      href: "/admin/programs",
      lastRunAt: auditedAt,
    },
    {
      id: "audit-scripts",
      name: "Existing audit scripts",
      description: "Read-only reports under scripts/reports for deeper investigations.",
      href: "/admin/ops",
      lastRunAt: postCleanupMtime ?? phaseIntegrityMtime,
    },
    {
      id: "team-duplicate-audit",
      name: "Team duplicate audit",
      description: "Historical team duplicate cleanup audit output.",
      href: "/admin/teams",
      lastRunAt: teamDuplicateMtime,
    },
  ];

  return {
    auditedAt,
    overview,
    sections,
    diagnostics,
  };
}

export async function loadDataHealthCenter(options?: { bypassCache?: boolean }) {
  const now = Date.now();
  if (
    !options?.bypassCache &&
    dataHealthCenterCache &&
    now - dataHealthCenterCache.loadedAt < DATA_HEALTH_CACHE_MS
  ) {
    return dataHealthCenterCache.value;
  }

  const value = await loadDataHealthCenterUncached();
  dataHealthCenterCache = { value, loadedAt: now };
  return value;
}

export async function loadDataHealthSection(sectionId: string, options?: { bypassCache?: boolean }) {
  const data = await loadDataHealthCenter(options);
  return data.sections.find((section) => section.id === sectionId) ?? null;
}
