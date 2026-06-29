/**
 * Read-only preview for a Phase 1 tier-normalized rating reform.
 *
 * This intentionally keeps current public board membership fixed. It answers:
 * "If Formula v1 game scores were normalized by competition tier, how would the
 * already-visible public board reorder?"
 *
 * No database writes. No snapshots. No GPS recompute.
 *
 * Usage: npx tsx scripts/rating-reformulation-tier-normalized-preview.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { getPublicBoardRows } from "../src/lib/public-board-ranks";
import { FORMULA_V1_VERSION_NUMBER } from "../src/lib/ratings/formula-constants";
import { getLatestNationalRankings, type NationalRankingRow } from "../src/lib/rankings";

const REPORT_DIR = join(process.cwd(), "scripts", "reports");
const JSON_PATH = join(REPORT_DIR, "rating-reformulation-tier-normalized-preview.json");
const MD_PATH = join(REPORT_DIR, "rating-reformulation-tier-normalized-preview.md");

const REVIEW_NAMES = ["Lucas Kaw", "Jude Eriobu", "Josef Calo-oy", "Xyriel Macahipay", "Prince Cariño"];

type ScenarioId = "SOFT_DISCOUNT" | "MEDIUM_DISCOUNT" | "FIRM_DISCOUNT";

type GpsRow = {
  player_id: string;
  display_name: string;
  league_tier: number;
  league_name: string;
  final_score: number;
};

type BoardKey = "U19_BOYS" | "U16_BOYS" | "U19_GIRLS" | "U16_GIRLS" | "U13_BOYS" | "U13_GIRLS";

type PreviewRow = {
  playerId: string;
  displayName: string;
  currentRank: number;
  previewRank: number;
  currentRating: number;
  previewRating: number;
  ratingDelta: number;
  rankDelta: number;
  verifiedGameCount: number;
  primaryCompetition: string | null;
  tierExposure: Record<string, { games: number; pct: number }>;
};

const SCENARIOS: Record<ScenarioId, { label: string; weights: Record<1 | 2 | 3 | 4, number> }> = {
  SOFT_DISCOUNT: {
    label: "Soft lower-tier discount",
    weights: { 1: 1.0, 2: 0.97, 3: 0.93, 4: 0.9 }
  },
  MEDIUM_DISCOUNT: {
    label: "Medium lower-tier discount",
    weights: { 1: 1.0, 2: 0.95, 3: 0.9, 4: 0.85 }
  },
  FIRM_DISCOUNT: {
    label: "Firm lower-tier discount",
    weights: { 1: 1.0, 2: 0.93, 3: 0.86, 4: 0.8 }
  }
};

function round2(value: number) {
  return Number(value.toFixed(2));
}

function boardKey(ageGroup: AgeGroup, gender: "Boys" | "Girls"): BoardKey {
  return `${ageGroup}_${gender.toUpperCase()}` as BoardKey;
}

function tierKey(tier: number): 1 | 2 | 3 | 4 {
  return Math.min(4, Math.max(1, Math.round(tier))) as 1 | 2 | 3 | 4;
}

function tierExposure(games: GpsRow[]) {
  const counts = new Map<number, number>();
  for (const game of games) counts.set(game.league_tier, (counts.get(game.league_tier) ?? 0) + 1);
  const total = games.length || 1;
  return Object.fromEntries(
    [...counts.entries()]
      .sort(([left], [right]) => left - right)
      .map(([tier, gamesCount]) => [`tier${tier}`, { games: gamesCount, pct: round2((gamesCount / total) * 100) }])
  );
}

function scenarioRating(games: GpsRow[], scenario: ScenarioId, fallbackRating: number) {
  if (!games.length) return fallbackRating;
  const weights = SCENARIOS[scenario].weights;
  const scores = games.map((game) => Math.min(100, game.final_score * weights[tierKey(game.league_tier)]));
  return round2(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

function previewBoard(rows: NationalRankingRow[], gpsByPlayer: Map<string, GpsRow[]>, scenario: ScenarioId): PreviewRow[] {
  const previewRows = rows.map((row) => {
    const games = gpsByPlayer.get(row.playerId) ?? [];
    return {
      playerId: row.playerId,
      displayName: row.displayName,
      currentRank: row.rank,
      previewRank: 0,
      currentRating: row.rating,
      previewRating: scenarioRating(games, scenario, row.rating),
      ratingDelta: 0,
      rankDelta: 0,
      verifiedGameCount: row.verifiedGameCount,
      primaryCompetition: row.primaryCompetition?.shortName ?? null,
      tierExposure: tierExposure(games)
    };
  });

  previewRows.sort(
    (left, right) =>
      right.previewRating - left.previewRating ||
      right.verifiedGameCount - left.verifiedGameCount ||
      left.displayName.localeCompare(right.displayName)
  );

  previewRows.forEach((row, index) => {
    row.previewRank = index + 1;
    row.rankDelta = row.currentRank - row.previewRank;
    row.ratingDelta = round2(row.previewRating - row.currentRating);
  });

  return previewRows;
}

function movementMetrics(currentRows: NationalRankingRow[], previewRows: PreviewRow[]) {
  const byId = new Map(previewRows.map((row) => [row.playerId, row]));
  const deltas = currentRows.map((row) => byId.get(row.playerId)).filter((row): row is PreviewRow => Boolean(row));

  function topChurn(limit: number) {
    const currentTop = new Set(currentRows.slice(0, limit).map((row) => row.playerId));
    const previewTop = new Set(previewRows.slice(0, limit).map((row) => row.playerId));
    return {
      changeCount: [...previewTop].filter((id) => !currentTop.has(id)).length,
      entered: previewRows
        .filter((row) => row.previewRank <= limit && !currentTop.has(row.playerId))
        .map((row) => ({ name: row.displayName, rank: row.previewRank, rating: row.previewRating })),
      exited: currentRows
        .filter((row) => row.rank <= limit && !previewTop.has(row.playerId))
        .map((row) => ({ name: row.displayName, rank: row.rank, rating: row.rating }))
    };
  }

  return {
    playersCompared: deltas.length,
    avgAbsRankDelta: round2(deltas.reduce((sum, row) => sum + Math.abs(row.rankDelta), 0) / (deltas.length || 1)),
    avgAbsRatingDelta: round2(deltas.reduce((sum, row) => sum + Math.abs(row.ratingDelta), 0) / (deltas.length || 1)),
    maxAbsRankDelta: deltas.reduce((max, row) => Math.max(max, Math.abs(row.rankDelta)), 0),
    top10: topChurn(10),
    top25: topChurn(25),
    largestMovers: [...deltas].sort((a, b) => Math.abs(b.rankDelta) - Math.abs(a.rankDelta)).slice(0, 12)
  };
}

function chooseCandidate(report: {
  boards: Record<BoardKey, { rows: NationalRankingRow[]; scenarios: Record<ScenarioId, { movement: ReturnType<typeof movementMetrics>; reviewSet: PreviewRow[] }> }>;
}) {
  const candidates = Object.keys(SCENARIOS) as ScenarioId[];
  const u19 = report.boards.U19_BOYS;
  if (!u19) return { scenario: null, label: "No U19 Boys board found", reason: "Cannot choose without primary board." };

  for (const scenario of candidates) {
    const movement = u19.scenarios[scenario].movement;
    const lucas = u19.scenarios[scenario].reviewSet.find((row) => row.displayName === "Lucas Kaw");
    const jude = u19.scenarios[scenario].reviewSet.find((row) => row.displayName === "Jude Eriobu");
    const josef = u19.scenarios[scenario].reviewSet.find((row) => row.displayName === "Josef Calo-oy");

    const lucasLeavesTopTwo = lucas ? lucas.previewRank > 2 : false;
    const uaapAnchorProtected = jude ? jude.previewRank <= 2 : false;
    const top10ChurnAcceptable = movement.top10.changeCount <= 3;
    const avgMovementAcceptable = movement.avgAbsRankDelta <= 8;
    const collegiateAnchorRises = josef ? josef.rankDelta > 0 : true;

    if (lucasLeavesTopTwo && uaapAnchorProtected && collegiateAnchorRises && top10ChurnAcceptable && avgMovementAcceptable) {
      return {
        scenario,
        label: SCENARIOS[scenario].label,
        reason: "Best first candidate: fixes the Lucas/circuit-heavy signal while keeping top-10 churn within guardrails."
      };
    }
  }

  return {
    scenario: null,
    label: "No Phase 1 candidate passes",
    reason: "Tier discount alone does not satisfy named-player and volatility guardrails. Move to full vNext calibration."
  };
}

async function loadGpsRows(): Promise<GpsRow[]> {
  return prisma.$queryRaw<GpsRow[]>`
    SELECT
      gps."playerId" AS player_id,
      p."displayName" AS display_name,
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

function markdown(report: {
  generatedAt: string;
  candidate: ReturnType<typeof chooseCandidate>;
  boards: Record<BoardKey, { label: string; rows: NationalRankingRow[]; scenarios: Record<ScenarioId, { top10: PreviewRow[]; movement: ReturnType<typeof movementMetrics>; reviewSet: PreviewRow[] }> }>;
}) {
  const movementRows = Object.entries(report.boards)
    .flatMap(([key, board]) =>
      (Object.keys(SCENARIOS) as ScenarioId[]).map((scenario) => {
        const movement = board.scenarios[scenario].movement;
        return `| ${board.label} | ${SCENARIOS[scenario].label} | ${movement.avgAbsRankDelta} | ${movement.avgAbsRatingDelta} | ${movement.top10.changeCount} | ${movement.top25.changeCount} |`;
      })
    )
    .join("\n");

  const u19 = report.boards.U19_BOYS;
  const reviewRows = u19
    ? (Object.keys(SCENARIOS) as ScenarioId[])
        .map((scenario) => {
          const rows = u19.scenarios[scenario].reviewSet;
          return `### ${SCENARIOS[scenario].label}\n\n| Player | Current | Preview | Rating | Δ Rating | Primary | Tier exposure |\n| --- | ---: | ---: | ---: | ---: | --- | --- |\n${rows
            .map((row) => {
              const exposure = Object.entries(row.tierExposure)
                .map(([tier, stats]) => `${tier}: ${stats.games}g`)
                .join("; ");
              return `| ${row.displayName} | #${row.currentRank} | #${row.previewRank} | ${row.previewRating} | ${row.ratingDelta} | ${row.primaryCompetition ?? "—"} | ${exposure || "—"} |`;
            })
            .join("\n")}`;
        })
        .join("\n\n")
    : "No U19 Boys board found.";

  return `# Rating Reformulation — Tier-Normalized Phase 1 Preview

**Generated:** ${report.generatedAt}  
**Mode:** Read-only preview. No GPS, PlayerRating, RankingSnapshot, or schema writes.

## Candidate decision

**${report.candidate.label}**  
${report.candidate.reason}

This preview keeps current public eligibility and board membership fixed, then recalculates ranking order using tier-normalized game scores.

## Scenario weights

| Scenario | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
| --- | ---: | ---: | ---: | ---: |
${(Object.keys(SCENARIOS) as ScenarioId[])
  .map((scenario) => {
    const w = SCENARIOS[scenario].weights;
    return `| ${SCENARIOS[scenario].label} | ${w[1]} | ${w[2]} | ${w[3]} | ${w[4]} |`;
  })
  .join("\n")}

## Movement summary

| Board | Scenario | Avg abs rank Δ | Avg abs rating Δ | Top-10 churn | Top-25 churn |
| --- | --- | ---: | ---: | ---: | ---: |
${movementRows}

## U19 Boys named-player review

${reviewRows}

## Interpretation

- A viable Phase 1 should move circuit-heavy profiles out of obviously over-credited slots without wiping out the current board.
- If no candidate passes, the next step is full Formula vNext calibration with opponent strength, home-board evidence roles, recency, and shrinkage.
- Production promotion still requires explicit approval and a separate write/recompute path.
`;
}

async function main() {
  const generatedAt = new Date().toISOString();
  const rankings = await getLatestNationalRankings();
  const gpsRows = await loadGpsRows();
  const gpsByPlayer = new Map<string, GpsRow[]>();

  for (const row of gpsRows) {
    const bucket = gpsByPlayer.get(row.player_id) ?? [];
    bucket.push(row);
    gpsByPlayer.set(row.player_id, bucket);
  }

  const boardInputs = [
    { label: "U19 Boys", rows: getPublicBoardRows(rankings.snapshotsByAge.U19.boys) },
    { label: "U19 Girls", rows: getPublicBoardRows(rankings.snapshotsByAge.U19.girls) },
    { label: "U16 Boys", rows: getPublicBoardRows(rankings.snapshotsByAge.U16.boys) },
    { label: "U16 Girls", rows: getPublicBoardRows(rankings.snapshotsByAge.U16.girls) },
    { label: "U13 Boys", rows: getPublicBoardRows(rankings.snapshotsByAge.U13.boys) },
    { label: "U13 Girls", rows: getPublicBoardRows(rankings.snapshotsByAge.U13.girls) }
  ];

  const boards = {} as Record<
    BoardKey,
    { label: string; rows: NationalRankingRow[]; scenarios: Record<ScenarioId, { top10: PreviewRow[]; movement: ReturnType<typeof movementMetrics>; reviewSet: PreviewRow[] }> }
  >;

  for (const input of boardInputs) {
    if (!input.rows.length) continue;
    const key = boardKey(input.rows[0].ageGroup as AgeGroup, input.rows[0].gender);
    const scenarios = {} as Record<ScenarioId, { top10: PreviewRow[]; movement: ReturnType<typeof movementMetrics>; reviewSet: PreviewRow[] }>;
    for (const scenario of Object.keys(SCENARIOS) as ScenarioId[]) {
      const previewRows = previewBoard(input.rows, gpsByPlayer, scenario);
      scenarios[scenario] = {
        top10: previewRows.slice(0, 10),
        movement: movementMetrics(input.rows, previewRows),
        reviewSet: REVIEW_NAMES.map((name) => previewRows.find((row) => row.displayName === name)).filter(
          (row): row is PreviewRow => Boolean(row)
        )
      };
    }
    boards[key] = { label: input.label, rows: input.rows, scenarios };
  }

  const report = {
    generatedAt,
    mode: "read-only-tier-normalized-preview",
    warning: "NO DATABASE WRITES — explicit approval required before production recompute.",
    scenarioWeights: SCENARIOS,
    gpsRows: gpsRows.length,
    candidate: chooseCandidate({ boards }),
    boards
  };

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(JSON_PATH, JSON.stringify(report, null, 2));
  writeFileSync(MD_PATH, markdown(report));

  console.log(`Wrote ${JSON_PATH}`);
  console.log(`Wrote ${MD_PATH}`);
  console.log(`Candidate: ${report.candidate.label}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
