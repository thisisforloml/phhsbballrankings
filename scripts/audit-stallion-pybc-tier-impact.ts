/**
 * Read-only audit: Stallion + PYBC player rating/rank changes after tier cutover.
 * Usage: npx tsx scripts/audit-stallion-pybc-tier-impact.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { FORMULA_TIER_NORMALIZED_V1_POLICY_ID, FORMULA_V1_POLICY_ID, FORMULA_V1_VERSION_NUMBER } from "../src/lib/ratings/formula-constants";
import { getPublicBoardRows } from "../src/lib/public-board-ranks";
import { getLatestNationalRankings } from "../src/lib/rankings";
import { publicBoardMinimumGames } from "../src/lib/eligibility";
import { isRankingEligibleByClassYear } from "../src/lib/ranking-eligibility";

const reportsDir = join(process.cwd(), "scripts", "reports");

function competitionPattern(source: "stallion" | "pybc") {
  return source === "stallion" ? /stallion/i : /\bPYBC\b|philippine youth basketball/i;
}

async function main() {
  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: FORMULA_V1_VERSION_NUMBER },
    select: { id: true }
  });
  if (!formulaVersion) throw new Error("Formula v1 not found.");

  const gpsPlayers = await prisma.$queryRaw<
    Array<{ player_id: string; display_name: string; league_name: string; league_tier: number; age_group: AgeGroup }>
  >`
    SELECT DISTINCT
      p.id AS player_id,
      p."displayName" AS display_name,
      l.name AS league_name,
      l.tier AS league_tier,
      l."ageGroup" AS age_group
    FROM game_performance_scores gps
    JOIN players p ON p.id = gps."playerId" AND p."deletedAt" IS NULL
    JOIN games g ON g.id = gps."gameId" AND g."deletedAt" IS NULL
    JOIN seasons s ON s.id = g."seasonId"
    JOIN leagues l ON l.id = s."leagueId"
    JOIN formula_versions fv ON fv.id = gps."formulaVersionId" AND fv."versionNumber" = ${FORMULA_V1_VERSION_NUMBER}
    WHERE gps."deletedAt" IS NULL AND gps."finalPerformanceScore" IS NOT NULL
  `;

  const classify = (leagueName: string): "stallion" | "pybc" | null => {
    if (competitionPattern("stallion").test(leagueName)) return "stallion";
    if (competitionPattern("pybc").test(leagueName)) return "pybc";
    return null;
  };

  const playerCompetitions = new Map<string, { displayName: string; sources: Set<"stallion" | "pybc">; tiers: Set<number> }>();
  for (const row of gpsPlayers) {
    const source = classify(row.league_name);
    if (!source) continue;
    const bucket = playerCompetitions.get(row.player_id) ?? {
      displayName: row.display_name,
      sources: new Set<"stallion" | "pybc">(),
      tiers: new Set<number>()
    };
    bucket.sources.add(source);
    bucket.tiers.add(row.league_tier);
    playerCompetitions.set(row.player_id, bucket);
  }

  const playerIds = [...playerCompetitions.keys()];
  const ratings = await prisma.playerRating.findMany({
    where: {
      playerId: { in: playerIds },
      formulaVersionId: formulaVersion.id,
      policyVersionId: { in: [FORMULA_V1_POLICY_ID, FORMULA_TIER_NORMALIZED_V1_POLICY_ID] }
    },
    select: {
      playerId: true,
      ageGroup: true,
      policyVersionId: true,
      adjustedRating: true,
      verifiedGameCount: true,
      player: { select: { gender: true, birthDate: true } }
    }
  });

  const productionByKey = new Map<string, (typeof ratings)[number]>();
  const tierByKey = new Map<string, (typeof ratings)[number]>();
  for (const rating of ratings) {
    const key = `${rating.playerId}|${rating.ageGroup}`;
    if (rating.policyVersionId === FORMULA_V1_POLICY_ID) productionByKey.set(key, rating);
    if (rating.policyVersionId === FORMULA_TIER_NORMALIZED_V1_POLICY_ID) tierByKey.set(key, rating);
  }

  const publicRankings = await getLatestNationalRankings();
  const publicRank = new Map<string, { rank: number; ageGroup: AgeGroup; gender: PlayerGender; rating: number }>();
  for (const ageGroup of [AgeGroup.U13, AgeGroup.U16, AgeGroup.U19] as const) {
    for (const gender of [PlayerGender.BOYS, PlayerGender.GIRLS] as const) {
      const snapshot = publicRankings.snapshotsByAge[ageGroup][gender === PlayerGender.GIRLS ? "girls" : "boys"];
      getPublicBoardRows(snapshot).forEach((row) => {
        publicRank.set(`${row.playerId}|${ageGroup}|${gender}`, {
          rank: row.rank,
          ageGroup,
          gender,
          rating: row.rating
        });
      });
    }
  }

  const productionRank = new Map<string, number>();
  for (const ageGroup of [AgeGroup.U13, AgeGroup.U16, AgeGroup.U19] as const) {
    for (const gender of [PlayerGender.BOYS, PlayerGender.GIRLS] as const) {
      const minGames = publicBoardMinimumGames(gender === PlayerGender.GIRLS ? "Girls" : "Boys");
      const rows = await prisma.playerRating.findMany({
        where: {
          ageGroup,
          formulaVersionId: formulaVersion.id,
          policyVersionId: FORMULA_V1_POLICY_ID,
          verifiedGameCount: { gte: minGames },
          player: { gender, deletedAt: null }
        },
        include: { player: { select: { birthDate: true } } },
        orderBy: [{ adjustedRating: "desc" }, { verifiedGameCount: "desc" }, { player: { displayName: "asc" } }]
      });
      const eligible = rows.filter((row) => isRankingEligibleByClassYear(row.player.birthDate, new Date()));
      eligible.forEach((row, index) => {
        productionRank.set(`${row.playerId}|${ageGroup}|${gender}`, index + 1);
      });
    }
  }

  type PlayerAudit = {
    playerId: string;
    displayName: string;
    sources: string[];
    tiers: number[];
    brackets: Array<{
      ageGroup: AgeGroup;
      oldRating: number | null;
      newRating: number | null;
      ratingDelta: number | null;
      unchanged: boolean;
      oldPublicRank: number | null;
      newPublicRank: number | null;
      rankDelta: number | null;
      rankMoved: boolean | null;
    }>;
  };

  const audits: PlayerAudit[] = [];

  for (const [playerId, meta] of playerCompetitions) {
    const bracketKeys = new Set<string>();
    for (const rating of ratings.filter((row) => row.playerId === playerId)) {
      bracketKeys.add(`${rating.ageGroup}|${rating.player.gender}`);
    }

    const brackets: PlayerAudit["brackets"] = [];
    for (const key of bracketKeys) {
      const [ageGroup, gender] = key.split("|") as [AgeGroup, PlayerGender];
      const ratingKey = `${playerId}|${ageGroup}`;
      const prod = productionByKey.get(ratingKey);
      const tier = tierByKey.get(ratingKey);
      const oldRating = prod ? Number(prod.adjustedRating) : null;
      const newRating = tier ? Number(tier.adjustedRating) : null;
      const rankKey = `${playerId}|${ageGroup}|${gender}`;
      const oldRank = productionRank.get(rankKey) ?? null;
      const newRank = publicRank.get(rankKey)?.rank ?? null;

      brackets.push({
        ageGroup,
        oldRating,
        newRating,
        ratingDelta: oldRating !== null && newRating !== null ? Number((newRating - oldRating).toFixed(2)) : null,
        unchanged: oldRating !== null && newRating !== null ? Math.abs(oldRating - newRating) < 0.01 : false,
        oldPublicRank: oldRank,
        newPublicRank: newRank,
        rankDelta: oldRank !== null && newRank !== null ? newRank - oldRank : null,
        rankMoved: oldRank !== null && newRank !== null ? oldRank !== newRank : null
      });
    }

    audits.push({
      playerId,
      displayName: meta.displayName,
      sources: [...meta.sources],
      tiers: [...meta.tiers].sort(),
      brackets
    });
  }

  const summarize = (source: "stallion" | "pybc") => {
    const subset = audits.filter((row) => row.sources.includes(source));
    const ratingRows = subset.flatMap((row) => row.brackets.filter((b) => b.newRating !== null));
    const unchangedRatings = ratingRows.filter((b) => b.unchanged).length;
    const changedRatings = ratingRows.filter((b) => !b.unchanged).length;
    const rankComparable = ratingRows.filter((b) => b.rankMoved !== null);
    const rankMoved = rankComparable.filter((b) => b.rankMoved).length;
    const rankUnchanged = rankComparable.filter((b) => !b.rankMoved).length;
    const missingTierRow = subset.filter((row) => row.brackets.some((b) => b.newRating === null && b.oldRating !== null)).length;

    return {
      playersWithVerifiedGps: subset.length,
      ratingRows: ratingRows.length,
      ratingsUnchanged: unchangedRatings,
      ratingsChanged: changedRatings,
      publicRankComparable: rankComparable.length,
      publicRankMoved: rankMoved,
      publicRankUnchanged: rankUnchanged,
      missingNewPolicyRow: missingTierRow
    };
  };

  const report = {
    generatedAt: new Date().toISOString(),
    stallion: summarize("stallion"),
    pybc: summarize("pybc"),
    notAllPlayersChanged:
      "Only players with GPS in tier-discounted leagues (tier > 1 or mixed tiers) change. Tier-1 flagship-only players with identical weighted average stay unchanged.",
    tierWeights: { 1: 1.0, 2: 0.97, 3: 0.93, 4: 0.9 },
    topStallionMoves: audits
      .filter((row) => row.sources.includes("stallion"))
      .flatMap((row) =>
        row.brackets
          .filter((b) => b.ratingDelta !== null && Math.abs(b.ratingDelta) > 0.01)
          .map((b) => ({
            displayName: row.displayName,
            ageGroup: b.ageGroup,
            oldRating: b.oldRating,
            newRating: b.newRating,
            ratingDelta: b.ratingDelta,
            oldPublicRank: b.oldPublicRank,
            newPublicRank: b.newPublicRank,
            rankDelta: b.rankDelta
          }))
      )
      .sort((a, b) => Math.abs(b.ratingDelta ?? 0) - Math.abs(a.ratingDelta ?? 0))
      .slice(0, 25),
    topPybcMoves: audits
      .filter((row) => row.sources.includes("pybc"))
      .flatMap((row) =>
        row.brackets
          .filter((b) => b.ratingDelta !== null && Math.abs(b.ratingDelta) > 0.01)
          .map((b) => ({
            displayName: row.displayName,
            ageGroup: b.ageGroup,
            oldRating: b.oldRating,
            newRating: b.newRating,
            ratingDelta: b.ratingDelta,
            oldPublicRank: b.oldPublicRank,
            newPublicRank: b.newPublicRank,
            rankDelta: b.rankDelta
          }))
      )
      .sort((a, b) => Math.abs(b.ratingDelta ?? 0) - Math.abs(a.ratingDelta ?? 0))
      .slice(0, 25)
  };

  mkdirSync(reportsDir, { recursive: true });
  const jsonPath = join(reportsDir, "stallion-pybc-tier-impact-audit.json");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`Wrote ${jsonPath}`);
  console.log(JSON.stringify({ stallion: report.stallion, pybc: report.pybc }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
