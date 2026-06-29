/**
 * Rankings Operations Audit — generate all actionable worklists in one run.
 * Usage: npx tsx scripts/generate-rankings-operations-worklists.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup, PlayerGender } from "@prisma/client";
import { buildEligibilityInput, evaluateEligibility, resolveLaunchThreshold } from "../src/lib/eligibility";
import { prisma } from "../src/lib/prisma";

const OUT_DIR = join(process.cwd(), "docs", "planning", "audits");

type Priority = "P0" | "P1" | "P2" | "P3" | "P4";

type WorklistItem = {
  entityName: string;
  entityId: string;
  reason: string;
  impact: string;
  priority: Priority;
  context?: Record<string, string | number | null>;
};

function normalizeName(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function lastNameKey(value: string) {
  const parts = value.trim().split(/\s+/);
  return parts[parts.length - 1] ?? value;
}

async function loadPlayerContext(playerId: string) {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: {
      displayName: true,
      gender: true,
      currentProgram: { select: { fullName: true } },
      rosterSeasons: {
        where: { deletedAt: null },
        take: 1,
        orderBy: { createdAt: "desc" },
        include: { team: { select: { name: true, program: { select: { fullName: true } } } } }
      },
      currentRatings: { where: { ageGroup: AgeGroup.U19 }, select: { verifiedGameCount: true } }
    }
  });
  return {
    program:
      player?.currentProgram?.fullName ??
      player?.rosterSeasons[0]?.team.program?.fullName ??
      null,
    team: player?.rosterSeasons[0]?.team.name ?? null,
    verifiedGames: player?.currentRatings[0]?.verifiedGameCount ?? 0
  };
}

async function buildDobWorklist(gender: PlayerGender, priority: Priority, label: string): Promise<WorklistItem[]> {
  const formulaVersion = await prisma.formulaVersion.findUnique({ where: { versionNumber: 1 }, select: { id: true } });
  const threshold = resolveLaunchThreshold(gender);
  const ratings = await prisma.playerRating.findMany({
    where: { ageGroup: AgeGroup.U19, player: { gender, deletedAt: null } },
    include: {
      player: {
        select: {
          id: true,
          displayName: true,
          birthDate: true,
          classYearOverride: true,
          currentProgram: { select: { fullName: true } },
          rosterSeasons: {
            where: { deletedAt: null },
            take: 1,
            orderBy: { createdAt: "desc" },
            include: { team: { select: { name: true, program: { select: { fullName: true } } } } }
          }
        }
      }
    },
    orderBy: [{ verifiedGameCount: "desc" }, { player: { displayName: "asc" } }]
  });

  const items: WorklistItem[] = [];
  for (const rating of ratings) {
    const verdict = evaluateEligibility(
      buildEligibilityInput({
        playerId: rating.playerId,
        gender,
        birthDate: rating.player.birthDate,
        classYearOverride: rating.player.classYearOverride,
        ratingAgeGroup: "U19",
        verifiedGameCount: rating.verifiedGameCount,
        evaluatedBoard: "U19",
        formulaVersionId: formulaVersion?.id ?? null
      })
    );
    if (verdict.provisionalReason !== "UNKNOWN_DOB") continue;

    const program =
      rating.player.currentProgram?.fullName ??
      rating.player.rosterSeasons[0]?.team.program?.fullName ??
      "Unassigned";
    const team = rating.player.rosterSeasons[0]?.team.name ?? "Unassigned";

    items.push({
      entityName: rating.player.displayName,
      entityId: rating.playerId,
      reason: `P12 UNKNOWN_DOB — ${rating.verifiedGameCount} verified games (threshold ${threshold}), no birthDate`,
      impact: `Clears provisional block; likely adds RANKED ${label} board row at read time`,
      priority,
      context: { program, team, verifiedGames: rating.verifiedGameCount, threshold }
    });
  }
  return items;
}

async function buildNearThresholdWorklist(): Promise<WorklistItem[]> {
  const formulaVersion = await prisma.formulaVersion.findUnique({ where: { versionNumber: 1 }, select: { id: true } });
  const ratings = await prisma.playerRating.findMany({
    where: { ageGroup: AgeGroup.U19, player: { deletedAt: null } },
    include: {
      player: {
        select: {
          id: true,
          displayName: true,
          gender: true,
          birthDate: true,
          classYearOverride: true,
          currentProgram: { select: { fullName: true } },
          rosterSeasons: {
            where: { deletedAt: null },
            take: 1,
            orderBy: { createdAt: "desc" },
            include: { team: { select: { name: true, program: { select: { fullName: true } } } } }
          }
        }
      }
    },
    orderBy: [{ verifiedGameCount: "desc" }, { player: { displayName: "asc" } }]
  });

  const items: WorklistItem[] = [];
  for (const rating of ratings) {
    const gender = rating.player.gender;
    const threshold = resolveLaunchThreshold(gender);
    const gamesShort = Math.max(0, threshold - rating.verifiedGameCount);
    if (gamesShort === 0 || gamesShort > 4) continue;

    const verdict = evaluateEligibility(
      buildEligibilityInput({
        playerId: rating.playerId,
        gender,
        birthDate: rating.player.birthDate,
        classYearOverride: rating.player.classYearOverride,
        ratingAgeGroup: "U19",
        verifiedGameCount: rating.verifiedGameCount,
        evaluatedBoard: "U19",
        formulaVersionId: formulaVersion?.id ?? null
      })
    );
    if (verdict.provisionalReason !== "BELOW_THRESHOLD") continue;

    const genderLabel = gender === PlayerGender.GIRLS ? "Girls" : "Boys";
    const program =
      rating.player.currentProgram?.fullName ??
      rating.player.rosterSeasons[0]?.team.program?.fullName ??
      "Unassigned";

    items.push({
      entityName: rating.player.displayName,
      entityId: rating.playerId,
      reason: `P7 BELOW_THRESHOLD — ${gamesShort} game(s) short of ${threshold} (${rating.verifiedGameCount} verified)`,
      impact: `Import/verify ${gamesShort} official game(s) → potential RANKED U19 ${genderLabel} row`,
      priority: gamesShort === 1 ? "P1" : gamesShort <= 2 ? "P2" : "P3",
      context: {
        gender: genderLabel,
        program,
        verifiedGames: rating.verifiedGameCount,
        gamesShort,
        threshold,
        hasDob: rating.player.birthDate ? 1 : 0
      }
    });
  }

  return items.sort(
    (left, right) =>
      Number(left.context?.gamesShort ?? 99) - Number(right.context?.gamesShort ?? 99) ||
      Number(right.context?.verifiedGames ?? 0) - Number(left.context?.verifiedGames ?? 0)
  );
}

async function buildDuplicatePlayerQueue(): Promise<WorklistItem[]> {
  const players = await prisma.player.findMany({
    where: { deletedAt: null, gameStats: { some: { deletedAt: null } } },
    select: {
      id: true,
      displayName: true,
      gender: true,
      birthDate: true,
      _count: { select: { gameStats: true, currentRatings: true } },
      gameStats: {
        where: { deletedAt: null },
        take: 1,
        select: { team: { select: { name: true } } }
      }
    }
  });

  const exactGroups = new Map<string, typeof players>();
  const lastNameGroups = new Map<string, typeof players>();

  for (const player of players) {
    const exactKey = `${player.gender}:${normalizeName(player.displayName)}`;
    const exact = exactGroups.get(exactKey) ?? [];
    exact.push(player);
    exactGroups.set(exactKey, exact);

    const lastKey = `${player.gender}:${normalizeName(lastNameKey(player.displayName))}`;
    const last = lastNameGroups.get(lastKey) ?? [];
    last.push(player);
    lastNameGroups.set(lastKey, last);
  }

  const queue: WorklistItem[] = [];
  const seen = new Set<string>();

  function addGroup(group: typeof players, reason: string, priority: Priority, impact: string) {
    const key = group
      .map((p) => p.id)
      .sort()
      .join("|");
    if (seen.has(key) || group.length < 2) return;
    seen.add(key);

    const names = group.map((p) => p.displayName).join(" / ");
    const statsTotal = group.reduce((sum, p) => sum + p._count.gameStats, 0);
    const ratingsTotal = group.reduce((sum, p) => sum + p._count.currentRatings, 0);

    queue.push({
      entityName: names,
      entityId: group.map((p) => p.id).join(","),
      reason,
      impact,
      priority,
      context: {
        recordCount: group.length,
        gameStats: statsTotal,
        ratings: ratingsTotal,
        gender: group[0]?.gender ?? null
      }
    });
  }

  for (const group of exactGroups.values()) {
    if (group.length < 2) continue;
    addGroup(
      group,
      "Exact normalized displayName match across active players with stats",
      "P2",
      "Merge consolidates split verified games and rating basis into one public identity"
    );
  }

  for (const group of lastNameGroups.values()) {
    if (group.length < 2 || group.length > 4) continue;
    const firstTokens = new Set(group.map((p) => normalizeName(p.displayName.split(/\s+/)[0] ?? "")));
    if (firstTokens.size === group.length) continue;
    addGroup(
      group,
      "Same gender + shared surname cluster with overlapping first-name tokens",
      "P3",
      "Review before merge — may consolidate duplicate identity or reveal spelling variants"
    );
  }

  const knownCases = [
    { names: ["Audrey Biongco", "Audrey Biongcog"], priority: "P2" as Priority },
    { names: ["John Addatu", "John Addatu"], priority: "P2" as Priority },
    { names: ["John dexter Santos", "John Dexter Santos"], priority: "P2" as Priority },
    { names: ["Rhon-j Matias", "Rhon-J Matias"], priority: "P3" as Priority },
    { names: ["Sam Hall", "Sam Hall"], priority: "P2" as Priority }
  ];

  for (const known of knownCases) {
    const matches = players.filter((p) => known.names.includes(p.displayName));
    if (matches.length >= 2) {
      addGroup(
        matches,
        "Prior audit flagged medium-risk duplicate identity",
        known.priority,
        "Merge may restore full verified game count on canonical player record"
      );
    }
  }

  return queue.sort((a, b) => a.priority.localeCompare(b.priority));
}

async function buildDuplicateProgramQueue(): Promise<WorklistItem[]> {
  const programs = await prisma.program.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      fullName: true,
      abbreviation: true,
      type: true,
      _count: { select: { teams: true, currentPlayers: true } },
      teams: {
        where: { deletedAt: null },
        select: { id: true, name: true, _count: { select: { gameStats: true } } }
      }
    }
  });

  const groups = new Map<string, typeof programs>();
  for (const program of programs) {
    const key = normalizeName(program.fullName);
    const group = groups.get(key) ?? [];
    group.push(program);
    groups.set(key, group);
  }

  const items: WorklistItem[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const names = group.map((p) => p.fullName).join(" / ");
    const activeTeams = group.reduce((sum, p) => sum + p._count.teams, 0);
    const gameStats = group.reduce(
      (sum, p) => sum + p.teams.reduce((teamSum, t) => teamSum + t._count.gameStats, 0),
      0
    );
    const emptyShells = group.filter((p) => p._count.teams === 0).length;

    items.push({
      entityName: names,
      entityId: group.map((p) => p.id).join(","),
      reason: `Duplicate Program identity — ${group.length} active records share normalized name`,
      impact:
        emptyShells > 0
          ? `Reassign or retire ${emptyShells} empty program shell(s); prevents split team/roster identity`
          : "Review before merge — may split PYBC/UAAP competition evidence across programs",
      priority: gameStats > 0 && emptyShells > 0 ? "P2" : "P3",
      context: {
        programCount: group.length,
        teams: activeTeams,
        gameStats,
        emptyShells
      }
    });
  }

  return items.sort((a, b) => a.priority.localeCompare(b.priority));
}

function renderSection(title: string, items: WorklistItem[]) {
  if (!items.length) return `## ${title}\n\n_No items._\n`;
  const lines = items.map(
    (item, index) =>
      `${index + 1}. **${item.entityName}** (${item.priority})\n   - Reason: ${item.reason}\n   - Impact: ${item.impact}`
  );
  return `## ${title}\n\n${lines.join("\n\n")}\n`;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const [girlsP12, boysP12, nearThreshold, duplicatePlayers, duplicatePrograms] = await Promise.all([
    buildDobWorklist(PlayerGender.GIRLS, "P0", "U19 Girls"),
    buildDobWorklist(PlayerGender.BOYS, "P1", "U19 Boys"),
    buildNearThresholdWorklist(),
    buildDuplicatePlayerQueue(),
    buildDuplicateProgramQueue()
  ]);

  const payload = {
    generatedAt: new Date().toISOString(),
    counts: {
      u19GirlsP12Dob: girlsP12.length,
      u19BoysP12Dob: boysP12.length,
      nearThresholdImport: nearThreshold.length,
      duplicatePlayers: duplicatePlayers.length,
      duplicatePrograms: duplicatePrograms.length
    },
    worklists: {
      u19GirlsP12Dob: girlsP12,
      u19BoysP12Dob: boysP12,
      nearThresholdImport: nearThreshold,
      duplicatePlayers,
      duplicatePrograms
    }
  };

  const md = `# Rankings Operations Worklists

**Generated:** ${payload.generatedAt}

${renderSection("A. DOB Remediation — U19 Girls P12", girlsP12)}

${renderSection("A. DOB Remediation — U19 Boys P12", boysP12)}

${renderSection("B. Competition Coverage — Near-Threshold Import", nearThreshold)}

${renderSection("C. Duplicate Players — Review Queue", duplicatePlayers)}

${renderSection("D. Duplicate Programs — Review Queue", duplicatePrograms)}

## E. Recommended Execution Order

1. **P0** — Complete all U19 Girls P12 DOB entries (${girlsP12.length} players)
2. **P1** — Import games for near-threshold players within 1 game (${nearThreshold.filter((i) => i.priority === "P1").length} players)
3. **P1** — Start U19 Boys P12 DOB entries (${boysP12.length} players)
4. **P2** — Import games for near-threshold players 2–4 games short (${nearThreshold.filter((i) => i.priority === "P2" || i.priority === "P3").length} players)
5. **P2/P3** — Review duplicate player queue (${duplicatePlayers.length} groups)
6. **P2/P3** — Review duplicate program queue (${duplicatePrograms.length} groups)
7. Re-run baseline capture and verdict distribution audit after each batch
`;

  const jsonPath = join(OUT_DIR, "rankings-operations-worklists.json");
  const mdPath = join(OUT_DIR, "RANKINGS_OPERATIONS_WORKLISTS.md");

  writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
  writeFileSync(mdPath, md);

  console.log(JSON.stringify({ jsonPath, mdPath, counts: payload.counts }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
