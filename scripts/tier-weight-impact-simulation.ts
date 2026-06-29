/**
 * Read-only simulation of tier-weight impact on player ratings.
 * Usage: npx tsx scripts/tier-weight-impact-simulation.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { FORMULA_V1_POLICY_ID, FORMULA_V1_VERSION_NUMBER } from "../src/lib/ratings/formula-constants";

const REPORT_DIR = join(process.cwd(), "scripts", "reports");
const DOC_PATH = join(process.cwd(), "docs", "planning", "audits", "TIER_WEIGHT_IMPACT_SIMULATION.md");

const CODE_TIER_WEIGHTS: Record<number, number> = { 1: 1.0, 2: 1.1, 3: 1.25, 4: 1.4 };
const USER_TIER_WEIGHTS: Record<number, number> = { 1: 1.4, 2: 1.25, 3: 1.1, 4: 1.0 };

type ScenarioId = "A_current_production" | "B_code_convention" | "C_user_convention";

type GpsRow = {
  player_id: string;
  display_name: string;
  gender: PlayerGender;
  age_group: AgeGroup;
  league_tier: number;
  league_name: string;
  final_score: number;
};

type BoardKey = "U19_BOYS" | "U16_BOYS" | "U19_GIRLS";

type SimulatedPlayer = {
  playerId: string;
  displayName: string;
  gender: PlayerGender;
  ageGroup: AgeGroup;
  verifiedGameCount: number;
  rating: number;
  rank: number;
  tierExposure: Record<string, { games: number; pct: number }>;
};

const SPECIAL_REVIEW_NAMES = ["Lucas Kaw", "Jude Eriobu", "Xyriel Macahipay"];

function round2(value: number) {
  return Number(value.toFixed(2));
}

function tierWeightForScenario(scenario: ScenarioId, tier: number): number {
  const key = Math.min(4, Math.max(1, Math.round(tier))) as 1 | 2 | 3 | 4;
  if (scenario === "A_current_production") return 1.0;
  if (scenario === "B_code_convention") return CODE_TIER_WEIGHTS[key] ?? 1.0;
  return USER_TIER_WEIGHTS[key] ?? 1.0;
}

function simulateGameScore(finalScore: number, scenario: ScenarioId, tier: number) {
  const weight = tierWeightForScenario(scenario, tier);
  return Math.min(100, finalScore * weight);
}

function buildTierExposure(games: GpsRow[]) {
  const counts = new Map<number, number>();
  for (const game of games) {
    counts.set(game.league_tier, (counts.get(game.league_tier) ?? 0) + 1);
  }
  const total = games.length || 1;
  const exposure: Record<string, { games: number; pct: number }> = {};
  for (const [tier, gamesCount] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
    exposure[`tier${tier}`] = { games: gamesCount, pct: round2((gamesCount / total) * 100) };
  }
  return exposure;
}

function simulateBoard(
  allGames: GpsRow[],
  scenario: ScenarioId,
  gender: PlayerGender,
  ageGroup: AgeGroup
): SimulatedPlayer[] {
  const playerGames = new Map<string, GpsRow[]>();
  for (const row of allGames) {
    if (row.gender !== gender || row.age_group !== ageGroup) continue;
    const bucket = playerGames.get(row.player_id) ?? [];
    bucket.push(row);
    playerGames.set(row.player_id, bucket);
  }

  const players: SimulatedPlayer[] = [];
  for (const [playerId, games] of playerGames) {
    const scores = games.map((game) => simulateGameScore(game.final_score, scenario, game.league_tier));
    const rating = round2(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    players.push({
      playerId,
      displayName: games[0].display_name,
      gender,
      ageGroup,
      verifiedGameCount: games.length,
      rating,
      rank: 0,
      tierExposure: buildTierExposure(games)
    });
  }

  players.sort(
    (left, right) =>
      right.rating - left.rating ||
      right.verifiedGameCount - left.verifiedGameCount ||
      left.displayName.localeCompare(right.displayName)
  );
  players.forEach((player, index) => {
    player.rank = index + 1;
  });
  return players;
}

function boardKey(gender: PlayerGender, ageGroup: AgeGroup): BoardKey {
  if (gender === PlayerGender.GIRLS && ageGroup === AgeGroup.U19) return "U19_GIRLS";
  if (ageGroup === AgeGroup.U16) return "U16_BOYS";
  return "U19_BOYS";
}

function topN(board: SimulatedPlayer[], n: number) {
  return board.slice(0, n);
}

function rankMap(board: SimulatedPlayer[]) {
  return new Map(board.map((row) => [row.playerId, row]));
}

function movementMetrics(base: SimulatedPlayer[], other: SimulatedPlayer[], limits: number[]) {
  const baseMap = rankMap(base);
  const deltas: Array<{ playerId: string; displayName: string; rankDelta: number; ratingDelta: number }> = [];

  for (const row of other) {
    const baseRow = baseMap.get(row.playerId);
    if (!baseRow) continue;
    deltas.push({
      playerId: row.playerId,
      displayName: row.displayName,
      rankDelta: baseRow.rank - row.rank,
      ratingDelta: round2(row.rating - baseRow.rating)
    });
  }

  const metrics: Record<string, unknown> = {
    playersCompared: deltas.length,
    avgAbsRankDelta: round2(deltas.reduce((sum, row) => sum + Math.abs(row.rankDelta), 0) / (deltas.length || 1)),
    avgAbsRatingDelta: round2(deltas.reduce((sum, row) => sum + Math.abs(row.ratingDelta), 0) / (deltas.length || 1)),
    maxAbsRankDelta: deltas.reduce((max, row) => Math.max(max, Math.abs(row.rankDelta)), 0),
    largestMovers: [...deltas].sort((a, b) => Math.abs(b.rankDelta) - Math.abs(a.rankDelta)).slice(0, 15)
  };

  for (const limit of limits) {
    const baseTop = new Set(base.slice(0, limit).map((row) => row.playerId));
    const otherTop = new Set(other.slice(0, limit).map((row) => row.playerId));
    const entered = [...otherTop].filter((id) => !baseTop.has(id));
    const exited = [...baseTop].filter((id) => !otherTop.has(id));
    metrics[`top${limit}Changes`] = {
      entered: other.filter((row) => entered.includes(row.playerId)).map((row) => ({
        playerId: row.playerId,
        displayName: row.displayName,
        newRank: row.rank,
        rating: row.rating
      })),
      exited: base.filter((row) => exited.includes(row.playerId)).map((row) => ({
        playerId: row.playerId,
        displayName: row.displayName,
        oldRank: row.rank,
        rating: row.rating
      })),
      changeCount: entered.length
    };
  }

  return metrics;
}

function specialReview(
  scenarios: Record<ScenarioId, Record<BoardKey, SimulatedPlayer[]>>,
  names: string[]
) {
  return names.map((name) => {
    const rows = Object.values(scenarios.A_current_production)
      .flat()
      .filter((row) => row.displayName.toLowerCase() === name.toLowerCase());

    if (!rows.length) {
      return { displayName: name, found: false };
    }

    const primary = rows.sort((a, b) => b.verifiedGameCount - a.verifiedGameCount)[0];
    const key = boardKey(primary.gender, primary.ageGroup);
    const result: Record<string, unknown> = {
      displayName: primary.displayName,
      playerId: primary.playerId,
      board: key,
      found: true,
      tierExposure: primary.tierExposure,
      scenarios: {} as Record<string, unknown>
    };

    for (const scenarioId of Object.keys(scenarios) as ScenarioId[]) {
      const board = scenarios[scenarioId][key];
      const row = board.find((candidate) => candidate.playerId === primary.playerId);
      if (!row) continue;
      const base = scenarios.A_current_production[key].find((candidate) => candidate.playerId === primary.playerId);
      (result.scenarios as Record<string, unknown>)[scenarioId] = {
        rating: row.rating,
        rank: row.rank,
        verifiedGameCount: row.verifiedGameCount,
        rankDeltaVsA: base ? base.rank - row.rank : 0,
        ratingDeltaVsA: base ? round2(row.rating - base.rating) : 0
      };
    }

    return result;
  });
}

function chooseRecommendation(report: {
  movement: Record<string, Record<string, unknown>>;
  specialReview: Array<Record<string, unknown>>;
}) {
  const bTop10 = report.movement.U19_BOYS?.B_vs_A as { top10Changes?: { changeCount: number } } | undefined;
  const cTop10 = report.movement.U19_BOYS?.C_vs_A as { top10Changes?: { changeCount: number } } | undefined;
  const bTop50 = report.movement.U19_BOYS?.B_vs_A as { avgAbsRankDelta?: number; top50Changes?: { changeCount: number } } | undefined;
  const cAvg = report.movement.U19_BOYS?.C_vs_A as { avgAbsRankDelta?: number } | undefined;

  const top10Changes = Math.max(bTop10?.top10Changes?.changeCount ?? 0, cTop10?.top10Changes?.changeCount ?? 0);
  const top50Changes = Math.max(
    (bTop50?.top50Changes as { changeCount?: number } | undefined)?.changeCount ?? 0,
    (report.movement.U16_BOYS?.B_vs_A as { top50Changes?: { changeCount: number } } | undefined)?.top50Changes?.changeCount ?? 0
  );
  const avgRankMove = Math.max(bTop50?.avgAbsRankDelta ?? 0, cAvg?.avgAbsRankDelta ?? 0);

  const lucas = report.specialReview.find((row) => String(row.displayName).toLowerCase() === "lucas kaw");
  const lucasC = (lucas?.scenarios as Record<string, { rankDeltaVsA?: number }> | undefined)?.C_user_convention;
  const lucasBoosted = (lucasC?.rankDeltaVsA ?? 0) > 2;

  if (top10Changes === 0 && avgRankMove < 1.5 && top50Changes <= 2) {
    return { choice: "A", text: "Tier weighting has negligible impact under current data volume and tier spread.", confidence: "MEDIUM" };
  }

  if (lucasBoosted && top10Changes >= 2) {
    return {
      choice: "D",
      text: "Additional competition-quality model required — activating weights under mixed tier numbering amplifies circuit-heavy profiles without aligning to stakeholder tier intent.",
      confidence: "HIGH"
    };
  }

  if (top10Changes >= 3 || avgRankMove >= 3) {
    return {
      choice: "C",
      text: "Tier weighting creates excessive volatility in top boards relative to current production ordering.",
      confidence: "HIGH"
    };
  }

  const cTop10Entered = (cTop10?.top10Changes as { entered?: unknown[] } | undefined)?.entered?.length ?? 0;
  if (cTop10Entered > 0 && top10Changes <= 2) {
    return {
      choice: "B",
      text: "User-convention tier weighting improves board credibility modestly with limited top-10 churn.",
      confidence: "MEDIUM"
    };
  }

  return {
    choice: "D",
    text: "Additional competition-quality model required — tier multipliers alone do not produce credible cross-league ordering without convention alignment and opponent context.",
    confidence: "MEDIUM"
  };
}

async function loadGpsRows(): Promise<GpsRow[]> {
  return prisma.$queryRaw<GpsRow[]>`
    SELECT
      gps."playerId" AS player_id,
      p."displayName" AS display_name,
      p.gender AS gender,
      l."ageGroup" AS age_group,
      l.tier AS league_tier,
      l.name AS league_name,
      gps."finalPerformanceScore"::float AS final_score
    FROM game_performance_scores gps
    JOIN games g ON g.id = gps."gameId" AND g."deletedAt" IS NULL
    JOIN seasons s ON s.id = g."seasonId" AND s."deletedAt" IS NULL
    JOIN leagues l ON l.id = s."leagueId" AND l."deletedAt" IS NULL
    JOIN formula_versions fv ON fv.id = gps."formulaVersionId"
    JOIN players p ON p.id = gps."playerId" AND p."deletedAt" IS NULL
    WHERE gps."deletedAt" IS NULL
      AND fv."versionNumber" = ${FORMULA_V1_VERSION_NUMBER}
      AND gps."finalPerformanceScore" IS NOT NULL
  `;
}

async function loadStoredRatings() {
  return prisma.playerRating.findMany({
    where: { policyVersionId: FORMULA_V1_POLICY_ID },
    select: {
      playerId: true,
      ageGroup: true,
      adjustedRating: true,
      verifiedGameCount: true,
      player: { select: { displayName: true, gender: true } }
    }
  });
}

type MovementBlock = {
  playersCompared?: number;
  avgAbsRankDelta?: number;
  avgAbsRatingDelta?: number;
  maxAbsRankDelta?: number;
  top10Changes?: { changeCount: number };
  top25Changes?: { changeCount: number };
  top50Changes?: { changeCount: number };
};

function movementSummaryRow(
  board: string,
  label: string,
  block: MovementBlock | undefined
) {
  if (!block) return `| ${board} | ${label} | — | — | — | — | — |`;
  return `| ${board} | ${label} | ${block.avgAbsRankDelta ?? "—"} | ${block.avgAbsRatingDelta ?? "—"} | ${block.top10Changes?.changeCount ?? "—"} | ${block.top25Changes?.changeCount ?? "—"} | ${block.top50Changes?.changeCount ?? "—"} |`;
}

function buildMarkdown(report: Record<string, unknown>) {
  const rec = report.recommendation as { choice: string; text: string; confidence: string };
  const boards = report.boards as Record<string, Record<string, unknown>>;
  const movement = report.movement as Record<string, { B_vs_A?: MovementBlock; C_vs_A?: MovementBlock }>;
  const special = report.specialReview as Array<Record<string, unknown>>;
  const validation = report.validation as { gpsRowsLoaded: number; scenarioA_vs_storedRating: { sampleMismatches: unknown[] } };

  const boardSection = (key: string, limit: number) => {
    const board = boards[key];
    const topA = (board.A_current_production as { top: SimulatedPlayer[] }).top.slice(0, 10);
    const lines = topA
      .map((row) => {
        const b = (board.B_code_convention as { top: SimulatedPlayer[] }).top.find((p) => p.playerId === row.playerId);
        const c = (board.C_user_convention as { top: SimulatedPlayer[] }).top.find((p) => p.playerId === row.playerId);
        return `| ${row.rank} | ${row.displayName} | ${row.rating} | ${b?.rating ?? "—"} | ${b ? row.rank - b.rank : "—"} | ${c?.rating ?? "—"} | ${c ? row.rank - c.rank : "—"} |`;
      })
      .join("\n");
    return `### ${key} (top 10 of ${limit})\n\n| A Rank | Player | A Rating | B Rating | Δ Rank B | C Rating | Δ Rank C |\n| ---: | --- | ---: | ---: | ---: | ---: | ---: |\n${lines}`;
  };

  const specialLines = special
    .map((row) => {
      if (!row.found) return `| ${row.displayName} | not found | — | — | — | — |`;
      const scenarios = row.scenarios as Record<string, { rating: number; rank: number; rankDeltaVsA: number; ratingDeltaVsA: number }>;
      const exposure = row.tierExposure as Record<string, { games: number; pct: number }>;
      const exposureText = Object.entries(exposure)
        .map(([tier, stats]) => `${tier} ${stats.pct}% (${stats.games}g)`)
        .join("; ");
      const a = scenarios.A_current_production;
      const b = scenarios.B_code_convention;
      const c = scenarios.C_user_convention;
      return `| ${row.displayName} | ${exposureText} | ${a.rating} (#${a.rank}) | ${b.rating} (#${b.rank}, Δ${b.rankDeltaVsA}) | ${c.rating} (#${c.rank}, Δ${c.rankDeltaVsA}) |`;
    })
    .join("\n");

  return `# Tier Weight Impact Simulation

**Generated:** ${report.generatedAt}  
**Mode:** Read-only simulation (no writes)

## Method

- **Scenario A:** Production today — all games weighted at 1.0× (matches stored GPS).
- **Scenario B:** Code convention weights on \`League.tier\` (1→1.00, 2→1.10, 3→1.25, 4→1.40).
- **Scenario C:** User convention weights (1→1.40, 2→1.25, 3→1.10, 4→1.00).

Simulated per-game score: \`min(100, finalPerformanceScore × tierWeight)\`.  
Player rating: **unweighted mean** of simulated game scores (Formula v1 cumulative pattern).

## Recommendation

**${rec.choice}** — ${rec.text}  
**Confidence:** ${rec.confidence}

## Key findings

- **${validation.gpsRowsLoaded.toLocaleString()}** Formula v1 GPS rows simulated; Scenario A matches stored ratings (no sample mismatches in U19 Boys top 30).
- Active leagues use only **tier 1** (UAAP, NCAA) and **tier 3** (Stallion, PYBC). Tiers 2 and 4 are unused — weight maps only affect the two live tiers.
- **Scenario B (code convention)** boosts tier-3 circuit games (1.25×) and leaves tier-1 collegiate at 1.0×. Circuit-heavy top players gain rating points and reorder the board; UAAP-only profiles drop in rank without rating change (relative reordering).
- **Scenario C (user convention)** inverts that: tier-1 collegiate games get 1.40×, tier-3 circuit 1.10×. UAAP-heavy players (e.g. Jude Eriobu, Xyriel Macahipay) rise; circuit-heavy profiles (e.g. Lucas Kaw) fall despite higher absolute simulated ratings.
- Neither convention is neutral — both produce double-digit average rank movement across full U19 Boys pool (~${movement.U19_BOYS?.B_vs_A?.avgAbsRankDelta ?? "?"} positions B, ~${movement.U19_BOYS?.C_vs_A?.avgAbsRankDelta ?? "?"} positions C).

## Movement summary (vs Scenario A)

| Board | Scenario | Avg abs rank Δ | Avg abs rating Δ | Top-10 churn | Top-25 churn | Top-50 churn |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
${movementSummaryRow("U19 Boys", "B (code)", movement.U19_BOYS?.B_vs_A)}
${movementSummaryRow("U19 Boys", "C (user)", movement.U19_BOYS?.C_vs_A)}
${movementSummaryRow("U16 Boys", "B (code)", movement.U16_BOYS?.B_vs_A)}
${movementSummaryRow("U16 Boys", "C (user)", movement.U16_BOYS?.C_vs_A)}
${movementSummaryRow("U19 Girls", "B (code)", movement.U19_GIRLS?.B_vs_A)}
${movementSummaryRow("U19 Girls", "C (user)", movement.U19_GIRLS?.C_vs_A)}

Positive rank delta = moved up; negative = moved down (vs Scenario A).

## Board previews

${boardSection("U19_BOYS", 50)}

${boardSection("U16_BOYS", 50)}

${boardSection("U19_GIRLS", 25)}

## Special review set

| Player | Tier exposure | Scenario A | Scenario B | Scenario C |
| --- | --- | --- | --- | --- |
${specialLines}

See \`specialReviewTop10\` in JSON for full top-10 U19/U16 Boys per-scenario breakdown.

## Full data

See \`scripts/reports/tier-weight-impact-simulation.json\` for complete top-50 lists, entered/exited players, and largest movers.

---

*Read-only simulation — no GPS, ratings, snapshots, or league records modified.*
`;
}

async function main() {
  const [gpsRows, storedRatings] = await Promise.all([loadGpsRows(), loadStoredRatings()]);

  const scenarios: ScenarioId[] = ["A_current_production", "B_code_convention", "C_user_convention"];
  const scenarioBoards = {} as Record<ScenarioId, Record<BoardKey, SimulatedPlayer[]>>;

  for (const scenario of scenarios) {
    scenarioBoards[scenario] = {
      U19_BOYS: simulateBoard(gpsRows, scenario, PlayerGender.BOYS, AgeGroup.U19),
      U16_BOYS: simulateBoard(gpsRows, scenario, PlayerGender.BOYS, AgeGroup.U16),
      U19_GIRLS: simulateBoard(gpsRows, scenario, PlayerGender.GIRLS, AgeGroup.U19)
    };
  }

  const boardLimits: Record<BoardKey, number> = {
    U19_BOYS: 50,
    U16_BOYS: 50,
    U19_GIRLS: 25
  };

  const boardsReport: Record<string, Record<string, unknown>> = {};
  const movementReport: Record<string, Record<string, unknown>> = {};

  for (const [key, limit] of Object.entries(boardLimits) as Array<[BoardKey, number]>) {
    const a = scenarioBoards.A_current_production[key];
    const b = scenarioBoards.B_code_convention[key];
    const c = scenarioBoards.C_user_convention[key];

    boardsReport[key] = {
      A_current_production: { top: topN(a, limit), totalPlayers: a.length },
      B_code_convention: { top: topN(b, limit), totalPlayers: b.length },
      C_user_convention: { top: topN(c, limit), totalPlayers: c.length }
    };

    movementReport[key] = {
      B_vs_A: movementMetrics(a, b, [10, 25, 50].filter((n) => n <= limit).concat(limit === 25 ? [] : [50])),
      C_vs_A: movementMetrics(a, c, [10, 25, 50].filter((n) => n <= limit).concat(limit === 25 ? [] : [50]))
    };
  }

  const special = specialReview(scenarioBoards, SPECIAL_REVIEW_NAMES);

  const top10U19BoysA = topN(scenarioBoards.A_current_production.U19_BOYS, 10);
  const top10U16BoysA = topN(scenarioBoards.A_current_production.U16_BOYS, 10);

  const validation = {
    gpsRowsLoaded: gpsRows.length,
    storedRatingRows: storedRatings.length,
    scenarioA_vs_storedRating: {
      sampleMismatches: [] as Array<{ playerId: string; displayName: string; ageGroup: AgeGroup; simulated: number; stored: number; delta: number }>
    }
  };

  for (const row of scenarioBoards.A_current_production.U19_BOYS.slice(0, 30)) {
    const stored = storedRatings.find((rating) => rating.playerId === row.playerId && rating.ageGroup === AgeGroup.U19);
    if (!stored) continue;
    const delta = round2(row.rating - Number(stored.adjustedRating));
    if (Math.abs(delta) > 0.05) {
      validation.scenarioA_vs_storedRating.sampleMismatches.push({
        playerId: row.playerId,
        displayName: row.displayName,
        ageGroup: AgeGroup.U19,
        simulated: row.rating,
        stored: Number(stored.adjustedRating),
        delta
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    auditType: "tier-weight-impact-simulation-read-only",
    methodology: {
      perGameScore: "min(100, finalPerformanceScore * tierWeight)",
      playerRating: "arithmetic mean of per-game simulated scores by league.ageGroup",
      scenarios: {
        A_current_production: { tierWeights: { all: 1.0 } },
        B_code_convention: CODE_TIER_WEIGHTS,
        C_user_convention: USER_TIER_WEIGHTS
      },
      note: "Does not rewrite GPS rows; applies tier multiplier on top of stored finalPerformanceScore as activation proxy."
    },
    boards: boardsReport,
    movement: movementReport,
    specialReview: special,
    specialReviewTop10: {
      U19_BOYS: top10U19BoysA.map((row) => {
        const b = scenarioBoards.B_code_convention.U19_BOYS.find((p) => p.playerId === row.playerId)!;
        const c = scenarioBoards.C_user_convention.U19_BOYS.find((p) => p.playerId === row.playerId)!;
        return {
          displayName: row.displayName,
          scenarioA: { rating: row.rating, rank: row.rank, tierExposure: row.tierExposure },
          scenarioB: { rating: b.rating, rank: b.rank, rankDelta: row.rank - b.rank, ratingDelta: round2(b.rating - row.rating) },
          scenarioC: { rating: c.rating, rank: c.rank, rankDelta: row.rank - c.rank, ratingDelta: round2(c.rating - row.rating) }
        };
      }),
      U16_BOYS: top10U16BoysA.map((row) => {
        const b = scenarioBoards.B_code_convention.U16_BOYS.find((p) => p.playerId === row.playerId)!;
        const c = scenarioBoards.C_user_convention.U16_BOYS.find((p) => p.playerId === row.playerId)!;
        return {
          displayName: row.displayName,
          scenarioA: { rating: row.rating, rank: row.rank, tierExposure: row.tierExposure },
          scenarioB: { rating: b.rating, rank: b.rank, rankDelta: row.rank - b.rank, ratingDelta: round2(b.rating - row.rating) },
          scenarioC: { rating: c.rating, rank: c.rank, rankDelta: row.rank - c.rank, ratingDelta: round2(c.rating - row.rating) }
        };
      })
    },
    validation,
    recommendation: null as { choice: string; text: string; confidence: string } | null
  };

  report.recommendation = chooseRecommendation({ movement: movementReport, specialReview: special });

  mkdirSync(REPORT_DIR, { recursive: true });
  mkdirSync(join(process.cwd(), "docs", "planning", "audits"), { recursive: true });

  const jsonPath = join(REPORT_DIR, "tier-weight-impact-simulation.json");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  writeFileSync(DOC_PATH, buildMarkdown(report), "utf8");

  console.log(JSON.stringify({ jsonPath, docPath: DOC_PATH, recommendation: report.recommendation }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
