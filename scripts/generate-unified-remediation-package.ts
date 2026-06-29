/**
 * Unified Remediation Package — read-only merge of import, DOB, duplicate queues.
 * Usage: npx tsx scripts/generate-unified-remediation-package.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/lib/prisma";

const OUT_DIR = join(process.cwd(), "docs", "planning", "audits");
const DASHBOARD_PATH = join(OUT_DIR, "rankings-operations-dashboard.json");
const IMPORT_QUEUE_PATH = join(OUT_DIR, "competition-import-execution-queue.json");

/** Ranking Impact = primary RANKED gain + secondary P7 path (P7/10). */
const P7_WEIGHT = 0.1;
const EFFORT_SCORE = { low: 1, medium: 2, high: 3 } as const;

type Effort = keyof typeof EFFORT_SCORE;

type MasterItem = {
  priority: number;
  queue: "IMPORT" | "DOB" | "DUPLICATE_PLAYER" | "DUPLICATE_PROGRAM";
  action: string;
  detail: string;
  board?: string;
  expectedRankedGain: number;
  expectedP7Reduction: number;
  expectedP12Reduction: number;
  effort: Effort;
  effortScore: number;
  rankingImpact: number;
  roiScore: number;
  entityCount?: number;
  metadata?: Record<string, unknown>;
};

function rankingImpact(ranked: number, p7: number): number {
  return Math.round((ranked + p7 * P7_WEIGHT) * 100) / 100;
}

function roi(ranked: number, p7: number, effort: Effort): number {
  const impact = rankingImpact(ranked, p7);
  return Math.round((impact / EFFORT_SCORE[effort]) * 100) / 100;
}

function shortProgram(name: string): string {
  if (name.includes("National University")) return "NU";
  if (name.includes("University of Santo Tomas")) return "UST";
  if (name.includes("Ateneo")) return "Ateneo";
  if (name.includes("De La Salle")) return "DLSZ";
  if (name.includes("San Beda")) return "San Beda";
  const parts = name.split(/\s+/);
  return parts.length > 3 ? `${parts[0]} ${parts[1]}` : name;
}

type DobRow = {
  playerId: string;
  name: string;
  program: string;
  games: number;
  rating: number;
  priorityScore: number;
  board: string;
};

const DOB_BATCH_MERGES: Array<{ board: string; programs: string[]; label: string }> = [
  {
    board: "U19 Girls",
    programs: ["National University Nazareth School", "University of Santo Tomas"],
    label: "NU/UST U19 Girls batch"
  }
];

function aggregateDobBatches(
  rows: DobRow[],
  boardLabel: string,
  effort: Effort
): MasterItem[] {
  const byProgram = new Map<string, DobRow[]>();
  for (const row of rows) {
    const list = byProgram.get(row.program) ?? [];
    list.push(row);
    byProgram.set(row.program, list);
  }

  for (const merge of DOB_BATCH_MERGES.filter((m) => m.board === boardLabel)) {
    const merged: DobRow[] = [];
    for (const program of merge.programs) {
      const players = byProgram.get(program);
      if (players) {
        merged.push(...players);
        byProgram.delete(program);
      }
    }
    if (merged.length > 0) {
      byProgram.set(merge.label, merged);
    }
  }

  const batches = [...byProgram.entries()]
    .map(([program, players]) => {
      const thresholdReady = players.filter((p) => p.games >= 8).length;
      const rankedGain = thresholdReady;
      const p12Reduction = players.length;
      const avgGames = players.reduce((s, p) => s + p.games, 0) / players.length;
      const batchEffort: Effort =
        players.length >= 15 ? effort : players.length >= 5 ? "medium" : "low";

      return {
        program,
        players,
        rankedGain,
        p12Reduction,
        thresholdReady,
        avgGames,
        batchEffort
      };
    })
    .sort((a, b) => b.rankedGain - a.rankedGain || b.p12Reduction - a.p12Reduction);

  const items: MasterItem[] = [];
  const topN = Math.min(8, batches.length);
  for (const batch of batches.slice(0, topN)) {
    const short = shortProgram(batch.program);
    const actionLabel = batch.program.includes("batch")
      ? batch.program
      : `${short} ${boardLabel} batch`;
    items.push({
      priority: 0,
      queue: "DOB",
      action: `Enter DOB: ${actionLabel}`,
      detail: `${batch.players.length} P12 players (${batch.thresholdReady} at ≥8 games, avg ${batch.avgGames.toFixed(1)} games)`,
      board: boardLabel,
      expectedRankedGain: batch.rankedGain,
      expectedP7Reduction: 0,
      expectedP12Reduction: batch.p12Reduction,
      effort: batch.batchEffort,
      effortScore: EFFORT_SCORE[batch.batchEffort],
      rankingImpact: rankingImpact(batch.rankedGain, 0),
      roiScore: roi(batch.rankedGain, 0, batch.batchEffort),
      entityCount: batch.players.length,
      metadata: {
        program: batch.program,
        playerIds: batch.players.map((p) => p.playerId).slice(0, 20),
        topPlayers: batch.players
          .sort((a, b) => b.priorityScore - a.priorityScore)
          .slice(0, 5)
          .map((p) => ({ name: p.name, games: p.games, rating: p.rating }))
      }
    });
  }

  const remainder = batches.slice(topN);
  if (remainder.length > 0) {
    const rankedGain = remainder.reduce((s, b) => s + b.rankedGain, 0);
    const p12Reduction = remainder.reduce((s, b) => s + b.p12Reduction, 0);
    items.push({
      priority: 0,
      queue: "DOB",
      action: `Enter DOB: ${boardLabel} remaining programs (${remainder.length} programs)`,
      detail: `${p12Reduction} P12 players across ${remainder.map((b) => shortProgram(b.program)).join(", ")}`,
      board: boardLabel,
      expectedRankedGain: rankedGain,
      expectedP7Reduction: 0,
      expectedP12Reduction: p12Reduction,
      effort: "high",
      effortScore: 3,
      rankingImpact: rankingImpact(rankedGain, 0),
      roiScore: roi(rankedGain, 0, "high"),
      entityCount: p12Reduction,
      metadata: { programs: remainder.map((b) => ({ program: b.program, count: b.players.length })) }
    });
  }

  return items;
}

function buildImportItems(
  importData: {
    allItems: Array<{
      competition: string;
      season: string;
      ageGroup: string;
      gender: string;
      missingRoundsPhases: string[];
      affectedPlayers: number;
      projectedNewRanked: number;
      projectedP7Reduction: number;
      projectedP12Shift: number;
      missingGames: number;
      effort: Effort;
      tier: string;
    }>;
  }
): MasterItem[] {
  return importData.allItems.map((item) => {
    const effort = item.effort ?? "low";
    return {
      priority: 0,
      queue: "IMPORT" as const,
      action: `Import: ${item.competition} (${item.season})`,
      detail: item.missingRoundsPhases.join("; "),
      board: `${item.ageGroup} ${item.gender}`,
      expectedRankedGain: item.projectedNewRanked,
      expectedP7Reduction: item.projectedP7Reduction,
      expectedP12Reduction: item.projectedP12Shift,
      effort,
      effortScore: EFFORT_SCORE[effort],
      rankingImpact: rankingImpact(item.projectedNewRanked, item.projectedP7Reduction),
      roiScore: roi(item.projectedNewRanked, item.projectedP7Reduction, effort),
      entityCount: item.affectedPlayers,
      metadata: {
        tier: item.tier,
        missingGames: item.missingGames,
        ageGroup: item.ageGroup,
        gender: item.gender
      }
    };
  });
}

function buildDuplicatePlayerItems(
  clusters: Array<{
    clusterId: string;
    names: string[];
    playerIds: string[];
    matchType: string;
    confidence: string;
    overlappingStats: number;
    recommendation: string;
  }>
): MasterItem[] {
  return clusters.map((c) => {
    const hasOverlap = c.overlappingStats > 0;
    const rankedGain = hasOverlap ? 0 : c.playerIds.length - 1;
    const effort: Effort = hasOverlap ? "high" : c.confidence === "high" ? "low" : "medium";
    return {
      priority: 0,
      queue: "DUPLICATE_PLAYER",
      action: `Review player merge: ${c.names.join(" / ")}`,
      detail: c.recommendation,
      expectedRankedGain: rankedGain,
      expectedP7Reduction: rankedGain,
      expectedP12Reduction: 0,
      effort,
      effortScore: EFFORT_SCORE[effort],
      rankingImpact: rankingImpact(rankedGain, rankedGain),
      roiScore: roi(rankedGain, rankedGain, effort),
      entityCount: c.playerIds.length,
      metadata: {
        clusterId: c.clusterId,
        matchType: c.matchType,
        confidence: c.confidence,
        overlappingStats: c.overlappingStats,
        playerIds: c.playerIds
      }
    };
  });
}

function buildDuplicateProgramItems(
  groups: Array<{
    normalizedName: string;
    programs: Array<{
      id: string;
      fullName: string;
      teams: number;
      players: number;
      gameStats: number;
      isEmptyShell: boolean;
    }>;
    matchType: string;
    recommendation: string;
  }>
): MasterItem[] {
  return groups.map((g) => {
    const active = g.programs.filter((p) => !p.isEmptyShell);
    const shells = g.programs.filter((p) => p.isEmptyShell);
    const effort: Effort = shells.length > 0 && active.length === 1 ? "low" : "medium";
    return {
      priority: 0,
      queue: "DUPLICATE_PROGRAM",
      action: `Consolidate program: ${g.programs.map((p) => p.fullName).join(" / ")}`,
      detail: g.recommendation,
      expectedRankedGain: 0,
      expectedP7Reduction: 0,
      expectedP12Reduction: 0,
      effort,
      effortScore: EFFORT_SCORE[effort],
      rankingImpact: shells.length > 0 ? 2 : 1,
      roiScore: Math.round(((shells.length > 0 ? 2 : 1) / EFFORT_SCORE[effort]) * 100) / 100,
      entityCount: g.programs.length,
      metadata: {
        normalizedName: g.normalizedName,
        matchType: g.matchType,
        programs: g.programs,
        emptyShellCount: shells.length
      }
    };
  });
}

function renderMarkdown(payload: {
  generatedAt: string;
  liveCounts: Record<string, number>;
  formula: { rankingImpact: string; roi: string; effortScores: typeof EFFORT_SCORE };
  executiveSummary: Record<string, unknown>;
  masterQueue: MasterItem[];
  top10Actions: MasterItem[];
}): string {
  const es = payload.executiveSummary;
  const lines: string[] = [
    "# Unified Remediation Package",
    "",
    `**Generated:** ${payload.generatedAt}`,
    "**Mode:** Read-only analysis — no data mutations",
    "",
    "---",
    "",
    "## Executive Summary",
    "",
    `| Metric | Value |`,
    `|---|---:|`,
    `| Master queue items | ${payload.masterQueue.length} |`,
    `| Import items | ${es.importItemCount} |`,
    `| DOB batch items | ${es.dobBatchItemCount} |`,
    `| Duplicate player clusters | ${es.duplicatePlayerClusters} |`,
    `| Duplicate program groups | ${es.duplicateProgramGroups} |`,
    `| **Projected RANKED gain (all items)** | **+${es.totalProjectedRanked}** |`,
    `| Projected P7 reduction | −${es.totalProjectedP7} |`,
    `| Projected P12 reduction | −${es.totalProjectedP12} |`,
    `| P12 DOB blockers (live) | ${es.liveDobP12} |`,
    `| Near-threshold players (live) | ${es.liveNearThreshold} |`,
    "",
    "### Ranking Impact Formula",
    "",
    `\`Ranking Impact = Expected RANKED gain + (Expected P7 reduction × ${P7_WEIGHT})\``,
    "",
    `\`ROI Score = Ranking Impact ÷ Effort Score\` (low=1, medium=2, high=3)`,
    "",
    "### Key DOB Constraint",
    "",
    String(es.dobConstraint),
    "",
    "### Live Database Counts",
    "",
    "| Entity | Count |",
    "|---|---:|"
  ];

  for (const [k, v] of Object.entries(payload.liveCounts)) {
    lines.push(`| ${k} | ${v} |`);
  }

  lines.push("", "---", "", "## Master Remediation Queue", "");
  lines.push(
    "| Priority | Queue | Action | Board | RANKED | P7↓ | P12↓ | Effort | Impact | ROI |",
    "|---:|---|---|---|---:|---:|---:|---|---:|---:|"
  );

  for (const item of payload.masterQueue) {
    lines.push(
      `| ${item.priority} | ${item.queue} | ${item.action} | ${item.board ?? "—"} | +${item.expectedRankedGain} | −${item.expectedP7Reduction} | −${item.expectedP12Reduction} | ${item.effort} (${item.effortScore}) | ${item.rankingImpact} | ${item.roiScore} |`
    );
  }

  lines.push("", "---", "", "## Top 10 Actions", "");
  for (const item of payload.top10Actions) {
    lines.push(
      `### #${item.priority} ${item.action}`,
      `- Queue: ${item.queue} · Board: ${item.board ?? "—"}`,
      `- Expected: +${item.expectedRankedGain} RANKED, −${item.expectedP7Reduction} P7, −${item.expectedP12Reduction} P12`,
      `- Effort: ${item.effort} · Ranking Impact: ${item.rankingImpact} · ROI: ${item.roiScore}`,
      `- ${item.detail}`,
      ""
    );
  }

  return lines.join("\n");
}

async function getLiveCounts() {
  const [players, activeGames, gameStats, playerRatings, programs, teams] = await Promise.all([
    prisma.player.count({ where: { deletedAt: null } }),
    prisma.game.count({ where: { deletedAt: null } }),
    prisma.gameStat.count({ where: { deletedAt: null } }),
    prisma.playerRating.count({ where: { player: { deletedAt: null } } }),
    prisma.program.count({ where: { deletedAt: null } }),
    prisma.team.count({ where: { deletedAt: null } })
  ]);

  return {
    players,
    activeGames,
    gameStats,
    playerRatings,
    programs,
    teams
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const dashboard = JSON.parse(readFileSync(DASHBOARD_PATH, "utf8"));
  const importQueue = JSON.parse(readFileSync(IMPORT_QUEUE_PATH, "utf8"));
  const liveCounts = await getLiveCounts();

  const dob = dashboard.dobRemediation as {
    u19GirlsP12: DobRow[];
    u19BoysP12: DobRow[];
    u16P12: DobRow[];
  };

  const importItems = buildImportItems(importQueue);
  const dobItems = [
    ...aggregateDobBatches(dob.u19GirlsP12, "U19 Girls", "medium"),
    ...aggregateDobBatches(dob.u19BoysP12, "U19 Boys", "high"),
    ...aggregateDobBatches(dob.u16P12, "U16", "high")
  ];
  const dupPlayerItems = buildDuplicatePlayerItems(dashboard.duplicatePlayers);
  const dupProgramItems = buildDuplicateProgramItems(dashboard.duplicatePrograms);

  const allItems = [...importItems, ...dobItems, ...dupPlayerItems, ...dupProgramItems].sort(
    (a, b) => b.roiScore - a.roiScore || b.rankingImpact - a.rankingImpact
  );

  const masterQueue = allItems.map((item, i) => ({ ...item, priority: i + 1 }));
  const top10Actions = masterQueue.slice(0, 10);

  const importRanked = importItems.reduce((s, i) => s + i.expectedRankedGain, 0);
  const importP7 = importItems.reduce((s, i) => s + i.expectedP7Reduction, 0);
  const importP12 = importItems.reduce((s, i) => s + i.expectedP12Reduction, 0);
  const dupPlayerRanked = dupPlayerItems.reduce((s, i) => s + i.expectedRankedGain, 0);
  const dobP12Total = dashboard.summary.totalDobP12 as number;

  const u19GirlsRankedReady = dob.u19GirlsP12.filter((p) => p.games >= 8).length;
  const u19BoysRankedReady = dob.u19BoysP12.filter((p) => p.games >= 8).length;
  const u16RankedReady = dob.u16P12.filter((p) => p.games >= 8).length;

  const executiveSummary = {
    importItemCount: importItems.length,
    dobBatchItemCount: dobItems.length,
    duplicatePlayerClusters: dupPlayerItems.length,
    duplicateProgramGroups: dupProgramItems.length,
    totalQueueItems: masterQueue.length,
    totalProjectedRanked: u19GirlsRankedReady + u19BoysRankedReady + u16RankedReady + importRanked + dupPlayerRanked,
    totalProjectedP7: importP7 + dupPlayerRanked,
    totalProjectedP12: dobP12Total + importP12,
    projectedBreakdown: {
      dobUnlockAtThreshold: u19GirlsRankedReady + u19BoysRankedReady + u16RankedReady,
      importDirectRanked: importRanked,
      duplicatePlayerRanked: dupPlayerRanked,
      importP7Reduction: importP7
    },
    liveDobP12: dashboard.summary.totalDobP12,
    liveNearThreshold: dashboard.summary.nearThresholdTotal,
    dobReadyAtThreshold: {
      u19Girls: u19GirlsRankedReady,
      u19Boys: u19BoysRankedReady,
      u16: u16RankedReady,
      total: u19GirlsRankedReady + u19BoysRankedReady + u16RankedReady
    },
    importQueueProjected: importQueue.expectedBoardGrowth,
    boardHealthSnapshot: dashboard.boardHealth.map(
      (b: { board: string; publicBoardRanked: number; ratingPool: number; boardYieldPct: number }) => ({
        board: b.board,
        ranked: b.publicBoardRanked,
        pool: b.ratingPool,
        yieldPct: b.boardYieldPct
      })
    ),
    dobConstraint: `328 players are P12 (UNKNOWN_DOB). DOB alone unlocks RANKED only when verified games ≥ threshold (8 boys / 6 girls). ${u19GirlsRankedReady} U19 Girls and ${u19BoysRankedReady} U19 Boys already meet game threshold but remain blocked; U19 Girls board is empty (0 RANKED). Imports without DOB shift players P7→P12 rather than clearing blockers — coordinate DOB batches (NU/UST Girls first) with high-ROI imports (PYBC 15U).`
  };

  const generatedAt = new Date().toISOString();
  const payload = {
    generatedAt,
    mode: "read-only",
    sources: {
      dashboard: DASHBOARD_PATH,
      importQueue: IMPORT_QUEUE_PATH,
      dashboardGeneratedAt: dashboard.generatedAt,
      importQueueGeneratedAt: importQueue.generatedAt
    },
    formula: {
      rankingImpact: `Expected RANKED gain + (Expected P7 reduction × ${P7_WEIGHT})`,
      roi: "Ranking Impact ÷ Effort Score",
      effortScores: EFFORT_SCORE,
      p7Weight: P7_WEIGHT
    },
    liveCounts,
    executiveSummary,
    masterQueue,
    top10Actions,
    queues: {
      import: importItems,
      dob: dobItems,
      duplicatePlayer: dupPlayerItems,
      duplicateProgram: dupProgramItems
    }
  };

  const jsonPath = join(OUT_DIR, "unified-remediation-package.json");
  const mdPath = join(OUT_DIR, "UNIFIED_REMEDIATION_PACKAGE.md");

  writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
  writeFileSync(mdPath, renderMarkdown(payload));

  console.log(
    JSON.stringify(
      {
        jsonPath,
        mdPath,
        executiveSummary,
        top10: top10Actions.map((a) => ({
          priority: a.priority,
          action: a.action,
          roi: a.roiScore,
          ranked: a.expectedRankedGain
        }))
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
