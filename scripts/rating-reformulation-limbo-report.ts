/**
 * Read-only limbo player report (playing up, no home-board v1 rating).
 * Usage: npx tsx scripts/rating-reformulation-limbo-report.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { getCurrentRankingAgeBracket } from "../src/lib/ranking-eligibility";
import { deriveEvidenceRole } from "../src/lib/ratings/formula-vnext/context-factors";
import { computeShadowBoard } from "../src/lib/ratings/formula-vnext";
import { resolveShadowFormulaParams } from "../src/lib/ratings/formula-vnext/resolve-params";

const reportsDir = join(process.cwd(), "scripts", "reports");
const jsonPath = join(reportsDir, "rating-reformulation-limbo-report.json");
const mdPath = join(reportsDir, "rating-reformulation-limbo-report.md");

async function main() {
  const asOfDate = new Date();
  const params = resolveShadowFormulaParams();

  const gps = await prisma.$queryRaw<
    Array<{
      player_id: string;
      display_name: string;
      gender: string;
      birth_date: Date | null;
      class_year_override: number | null;
      competition_age_group: AgeGroup;
      gps_count: number;
      avg_score: number;
    }>
  >`
    SELECT
      p.id AS player_id,
      p."displayName" AS display_name,
      p.gender::text AS gender,
      p."birthDate" AS birth_date,
      p."classYearOverride" AS class_year_override,
      l."ageGroup" AS competition_age_group,
      COUNT(*)::int AS gps_count,
      AVG(gps."finalPerformanceScore")::float AS avg_score
    FROM game_performance_scores gps
    JOIN players p ON p.id = gps."playerId" AND p."deletedAt" IS NULL
    JOIN games g ON g.id = gps."gameId" AND g."deletedAt" IS NULL
    JOIN seasons s ON s.id = g."seasonId"
    JOIN leagues l ON l.id = s."leagueId"
    JOIN formula_versions fv ON fv.id = gps."formulaVersionId" AND fv."versionNumber" = 1
    WHERE gps."deletedAt" IS NULL AND gps."finalPerformanceScore" IS NOT NULL
    GROUP BY p.id, p."displayName", p.gender, p."birthDate", p."classYearOverride", l."ageGroup"
  `;

  const ratings = await prisma.playerRating.findMany({
    select: { playerId: true, ageGroup: true, adjustedRating: true, verifiedGameCount: true }
  });
  const ratingMap = new Map(ratings.map((r) => [`${r.playerId}|${r.ageGroup}`, r]));

  const limboByBoard = new Map<string, typeof gps>();
  for (const row of gps) {
    const homeBracket = getCurrentRankingAgeBracket(
      row.birth_date,
      asOfDate,
      row.class_year_override,
      row.competition_age_group
    );
    const role = deriveEvidenceRole(homeBracket, row.competition_age_group);
    if (role !== "PLAYING_UP") continue;
    const homeKey = homeBracket && homeBracket !== "OUT_OF_RANGE" ? `${row.player_id}|${homeBracket}` : null;
    const compKey = `${row.player_id}|${row.competition_age_group}`;
    if (homeKey && ratingMap.has(homeKey)) continue;
    if (!ratingMap.has(compKey)) continue;

    const boardKey = `${homeBracket}|${row.gender}`;
    const bucket = limboByBoard.get(boardKey) ?? [];
    bucket.push(row);
    limboByBoard.set(boardKey, bucket);
  }

  const shadowByPlayer = new Map<string, { rating: number; games: number }>();
  for (const [boardKey, rows] of limboByBoard) {
    const [homeBracket, genderText] = boardKey.split("|");
    if (!homeBracket || homeBracket === "OUT_OF_RANGE") continue;
    const board = await computeShadowBoard({
      ageGroup: homeBracket as AgeGroup,
      gender: genderText as "BOYS" | "GIRLS",
      asOfDate,
      params
    });
    for (const shadowRow of board.rows) {
      shadowByPlayer.set(shadowRow.playerId, {
        rating: shadowRow.adjustedRating,
        games: shadowRow.verifiedGameCount
      });
    }
  }

  const limboCases = [];
  for (const row of gps) {
    const homeBracket = getCurrentRankingAgeBracket(
      row.birth_date,
      asOfDate,
      row.class_year_override,
      row.competition_age_group
    );
    const role = deriveEvidenceRole(homeBracket, row.competition_age_group);
    if (role !== "PLAYING_UP") continue;

    const homeKey = homeBracket && homeBracket !== "OUT_OF_RANGE" ? `${row.player_id}|${homeBracket}` : null;
    const compKey = `${row.player_id}|${row.competition_age_group}`;
    const hasHomeRating = homeKey ? ratingMap.has(homeKey) : false;
    const compRating = ratingMap.get(compKey);
    if (hasHomeRating || !compRating) continue;

    const shadow = shadowByPlayer.get(row.player_id);
    limboCases.push({
      playerId: row.player_id,
      displayName: row.display_name,
      homeBracket,
      competitionAgeGroup: row.competition_age_group,
      gpsCount: row.gps_count,
      avgCompetitionScore: Number(row.avg_score.toFixed(2)),
      v1CompetitionRating: Number(compRating.adjustedRating),
      v1CompetitionGames: compRating.verifiedGameCount,
      vNextHomeRating: shadow?.rating ?? null,
      vNextHomeGames: shadow?.games ?? null,
      resolvesUnderVnext: shadow !== undefined
    });
  }

  const deduped = [...new Map(limboCases.map((c) => [c.playerId, c])).values()];
  deduped.sort((a, b) => b.gpsCount - a.gpsCount);

  const report = {
    generatedAt: asOfDate.toISOString(),
    mode: "read-only",
    policyVersionId: params.policyVersionId,
    limboCount: deduped.length,
    resolvesCount: deduped.filter((c) => c.resolvesUnderVnext).length,
    cases: deduped
  };

  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  writeFileSync(
    mdPath,
    `# Rating Reformulation Limbo Report

Generated: ${report.generatedAt}

Players **playing up** with a v1 competition rating but **no home-board v1 rating**.

| Metric | Count |
|--------|------:|
| Limbo cases | ${report.limboCount} |
| Resolved by vNext shadow | ${report.resolvesCount} |

| Player | Home | Competition | Games | v1 Comp Rating | vNext Home Rating |
|--------|------|-------------|------:|---------------:|------------------:|
${deduped
  .map(
    (c) =>
      `| ${c.displayName} | ${c.homeBracket ?? "—"} | ${c.competitionAgeGroup} | ${c.gpsCount} | ${c.v1CompetitionRating ?? "—"} | ${c.vNextHomeRating ?? "—"} |`
  )
  .join("\n")}

Read-only. No database writes.
`
  );

  console.log(`Wrote ${jsonPath}`);
  console.log(`Limbo: ${report.limboCount}, vNext resolves: ${report.resolvesCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
