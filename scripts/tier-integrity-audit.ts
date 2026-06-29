/**
 * Read-only tier integrity audit.
 * Usage: npx tsx scripts/tier-integrity-audit.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/lib/prisma";

const REPORT_DIR = join(process.cwd(), "scripts", "reports");
const DOC_PATH = join(process.cwd(), "docs", "planning", "audits", "TIER_INTEGRITY_AUDIT.md");

const FORMULA_V1_WEIGHTS: Record<number, number> = { 1: 1.0, 2: 1.1, 3: 1.25, 4: 1.4 };

const CODE_TIER_LABELS: Record<number, string> = {
  1: "Entry",
  2: "Developmental",
  3: "Competitive",
  4: "Elite"
};

const USER_TIER_LABELS: Record<number, string> = {
  1: "Highest",
  2: "Strong developmental",
  3: "Competitive regional",
  4: "Lowest"
};

type CompetitionFamily =
  | "UAAP"
  | "NCAA"
  | "NBTC"
  | "Stallion"
  | "PYBC"
  | "JCIMBL"
  | "Other";

function inferFamily(name: string): CompetitionFamily {
  const normalized = name.toUpperCase();
  if (normalized.includes("UAAP")) return "UAAP";
  if (normalized.includes("NCAA")) return "NCAA";
  if (normalized.includes("NBTC")) return "NBTC";
  if (normalized.includes("STALLION")) return "Stallion";
  if (normalized.includes("PYBC") || normalized.includes("PHILIPPINE YOUTH BASKETBALL")) return "PYBC";
  if (normalized.includes("JCIMBL") || normalized.includes("JCIM")) return "JCIMBL";
  return "Other";
}

function inferGender(name: string): "BOYS" | "GIRLS" | "MIXED" | "UNKNOWN" {
  const normalized = name.toUpperCase();
  if (/\bGIRLS?\b/.test(normalized) || normalized.includes("WOMEN")) return "GIRLS";
  if (/\bBOYS?\b/.test(normalized) || normalized.includes("MEN")) return "BOYS";
  return "UNKNOWN";
}

function userConventionWeight(tier: number): number {
  // If Tier 1 = highest, highest tier should get the largest multiplier (mirror v1 scale inverted).
  const inverted: Record<number, number> = { 1: 1.4, 2: 1.25, 3: 1.1, 4: 1.0 };
  return inverted[tier] ?? 1.0;
}

function expectedTierUnderUserConvention(family: CompetitionFamily, name: string): number | null {
  const normalized = name.toUpperCase();
  if (family === "UAAP" || family === "NCAA") return 1;
  if (family === "NBTC") return 1;
  if (family === "Stallion") {
    if (normalized.includes("18U") || normalized.includes("19U") || normalized.includes("TEENS")) return 2;
    return 2;
  }
  if (family === "PYBC") return 2;
  if (family === "JCIMBL") return 2;
  return null;
}

async function main() {
  const leagues = await prisma.league.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      tier: true,
      ageGroup: true,
      verificationStatus: true,
      qualityScore: true,
      seasons: {
        where: { deletedAt: null },
        select: {
          id: true,
          games: {
            where: { deletedAt: null },
            select: { id: true }
          }
        }
      }
    },
    orderBy: [{ tier: "asc" }, { name: "asc" }]
  });

  const leagueIds = leagues.map((league) => league.id);

  const [gameStatsByLeague, gpsByLeague, playerRatingCount, programTeamRatingCount, gpsByStoredWeight] =
    await Promise.all([
      prisma.$queryRaw<Array<{ league_id: string; game_count: number; player_count: number }>>`
        SELECT
          l.id AS league_id,
          COUNT(DISTINCT g.id)::int AS game_count,
          COUNT(DISTINCT gs."playerId")::int AS player_count
        FROM leagues l
        JOIN seasons s ON s."leagueId" = l.id AND s."deletedAt" IS NULL
        JOIN games g ON g."seasonId" = s.id AND g."deletedAt" IS NULL
        LEFT JOIN game_stats gs ON gs."gameId" = g.id AND gs."deletedAt" IS NULL
        WHERE l."deletedAt" IS NULL
        GROUP BY l.id
      `,
      prisma.$queryRaw<Array<{ league_id: string; tier: number; gps_count: number }>>`
        SELECT
          l.id AS league_id,
          l.tier AS tier,
          COUNT(*)::int AS gps_count
        FROM game_performance_scores gps
        JOIN games g ON g.id = gps."gameId" AND g."deletedAt" IS NULL
        JOIN seasons s ON s.id = g."seasonId" AND s."deletedAt" IS NULL
        JOIN leagues l ON l.id = s."leagueId" AND l."deletedAt" IS NULL
        WHERE gps."deletedAt" IS NULL
        GROUP BY l.id, l.tier
      `,
      prisma.playerRating.count(),
      prisma.programTeamRating.count(),
      prisma.$queryRaw<Array<{ league_tier: number; league_weight: string; gps_count: number }>>`
        SELECT
          l.tier AS league_tier,
          gps."leagueWeight"::text AS league_weight,
          COUNT(*)::int AS gps_count
        FROM game_performance_scores gps
        JOIN games g ON g.id = gps."gameId" AND g."deletedAt" IS NULL
        JOIN seasons s ON s.id = g."seasonId" AND s."deletedAt" IS NULL
        JOIN leagues l ON l.id = s."leagueId" AND l."deletedAt" IS NULL
        WHERE gps."deletedAt" IS NULL
        GROUP BY l.tier, gps."leagueWeight"
        ORDER BY l.tier ASC, gps."leagueWeight" ASC
      `
    ]);

  const gameStatsMap = new Map(gameStatsByLeague.map((row) => [row.league_id, row]));
  const gpsMap = new Map(gpsByLeague.map((row) => [row.league_id, row.gps_count]));

  const inventory = leagues.map((league) => {
    const counts = gameStatsMap.get(league.id);
    const family = inferFamily(league.name);
    const expectedUserTier = expectedTierUnderUserConvention(family, league.name);
    const codeLabel = CODE_TIER_LABELS[league.tier] ?? "Unknown";
    const userLabel = USER_TIER_LABELS[league.tier] ?? "Unknown";
    const formulaWeight = FORMULA_V1_WEIGHTS[league.tier] ?? 1.0;
    const userAlignedWeight = userConventionWeight(league.tier);

    return {
      leagueId: league.id,
      leagueName: league.name,
      tier: league.tier,
      codeTierLabel: codeLabel,
      userTierLabelIfInverted: userLabel,
      ageGroup: league.ageGroup,
      gender: inferGender(league.name),
      verificationStatus: league.verificationStatus,
      qualityScore: league.qualityScore,
      gameCount: counts?.game_count ?? 0,
      playerCount: counts?.player_count ?? 0,
      gpsCount: gpsMap.get(league.id) ?? 0,
      competitionFamily: family,
      formulaV1Weight: formulaWeight,
      userConventionAlignedWeight: userAlignedWeight,
      expectedTierUnderUserConvention: expectedUserTier,
      dbTierMatchesUserExpectation:
        expectedUserTier === null ? null : league.tier === expectedUserTier,
      numberingConflict:
        expectedUserTier !== null &&
        league.tier !== expectedUserTier &&
        CODE_TIER_LABELS[league.tier] !== USER_TIER_LABELS[expectedUserTier]
    };
  });

  const byTier = [1, 2, 3, 4].map((tier) => ({
    tier,
    codeLabel: CODE_TIER_LABELS[tier],
    userLabelIfTier1IsHighest: USER_TIER_LABELS[tier],
    formulaV1Weight: FORMULA_V1_WEIGHTS[tier],
    userConventionAlignedWeight: userConventionWeight(tier),
    leagueCount: inventory.filter((row) => row.tier === tier).length,
    gameCount: inventory.filter((row) => row.tier === tier).reduce((sum, row) => sum + row.gameCount, 0),
    playerCount: inventory.filter((row) => row.tier === tier).reduce((sum, row) => sum + row.playerCount, 0),
    gpsCount: inventory.filter((row) => row.tier === tier).reduce((sum, row) => sum + row.gpsCount, 0),
    leagues: inventory
      .filter((row) => row.tier === tier)
      .map((row) => ({
        leagueId: row.leagueId,
        leagueName: row.leagueName,
        ageGroup: row.ageGroup,
        competitionFamily: row.competitionFamily,
        gameCount: row.gameCount,
        gpsCount: row.gpsCount
      }))
  }));

  const keyFamilies = ["UAAP", "NCAA", "NBTC", "Stallion", "PYBC", "JCIMBL"] as const;
  const familySummary = keyFamilies.map((family) => {
    const rows = inventory.filter((row) => row.competitionFamily === family);
    return {
      family,
      leagueCount: rows.length,
      tiers: [...new Set(rows.map((row) => row.tier))].sort(),
      gameCount: rows.reduce((sum, row) => sum + row.gameCount, 0),
      gpsCount: rows.reduce((sum, row) => sum + row.gpsCount, 0),
      leagues: rows.map((row) => ({
        leagueName: row.leagueName,
        tier: row.tier,
        codeTierLabel: row.codeTierLabel,
        ageGroup: row.ageGroup,
        gameCount: row.gameCount,
        expectedTierUnderUserConvention: row.expectedTierUnderUserConvention
      }))
    };
  });

  const mismatchedUnderUserConvention = inventory.filter(
    (row) => row.expectedTierUnderUserConvention !== null && row.tier !== row.expectedTierUnderUserConvention
  );

  const totalGames = inventory.reduce((sum, row) => sum + row.gameCount, 0);
  const totalGps = inventory.reduce((sum, row) => sum + row.gpsCount, 0);
  const affectedGames = mismatchedUnderUserConvention.reduce((sum, row) => sum + row.gameCount, 0);
  const affectedGps = mismatchedUnderUserConvention.reduce((sum, row) => sum + row.gpsCount, 0);
  const affectedLeagues = mismatchedUnderUserConvention.length;

  const internalConsistency = {
    requirementsDocConvention: {
      source: "docs/PHRANK_requirements.md",
      tier1: "Entry (lowest)",
      tier4: "Elite (highest)",
      alignedWithFormulaV1Weights: true
    },
    userConvention: {
      tier1: "Highest",
      tier4: "Lowest",
      alignedWithFormulaV1Weights: false,
      alignedWithCodeTierLabels: false
    },
    implementation: {
      formulaV1Weights: FORMULA_V1_WEIGHTS,
      codeTierLabels: CODE_TIER_LABELS,
      adminUi: "Numeric tier 1–4 only; no label legend in LeagueMetadataForm",
      storedGpsLeagueWeights: gpsByStoredWeight
    },
    dbVsFormulaV1: {
      consistent: gpsByStoredWeight.every((row) => {
        const expected = FORMULA_V1_WEIGHTS[row.league_tier];
        return expected === undefined || Number(row.league_weight) === expected;
      }),
      rows: gpsByStoredWeight,
      note:
        "All stored GPS rows use leagueWeight=1.000 regardless of League.tier. Import path hardcodes leagueWeight:1 in submission-post-import-processing.ts, so tier multipliers are not applied in production ratings today."
    },
    dbTierAssignmentPattern: {
      observation:
        "Leagues appear assigned with stakeholder 1=highest intent (UAAP/NCAA=1, Stallion/PYBC=3) while code labels invert tier 1 as Entry.",
      tiersInUse: [1, 3],
      tiersUnused: [2, 4]
    }
  };

  const numberingInverted =
    internalConsistency.requirementsDocConvention.tier1 === "Entry (lowest)" &&
    internalConsistency.userConvention.tier1 === "Highest";

  let recommendation: "A" | "B" | "C" | "D";
  let recommendationText: string;
  let confidence: "HIGH" | "MEDIUM" | "LOW";

  if (numberingInverted && affectedGps > 0) {
    recommendation = "D";
    recommendationText =
      "Rating-impacting semantic defect: codebase and PHRANK requirements treat tier 4 as elite (highest weight), while stakeholder convention treats tier 1 as highest. Stored league tiers may be assigned with mixed mental models, and Formula v1 weights amplify higher numeric tiers.";
    confidence = affectedLeagues >= 3 && affectedGps > 1000 ? "HIGH" : "MEDIUM";
  } else if (numberingInverted) {
    recommendation = "B";
    recommendationText = "Documentation/admin relabel only.";
    confidence = "MEDIUM";
  } else {
    recommendation = "A";
    recommendationText = "No action required.";
    confidence = "LOW";
  }

  const historicalImpact = {
    ifOnlyRelabelDocsAdmin: {
      recompute: "none",
      note: "Changing labels/help text only."
    },
    ifReassignLeagueTierNumbersToUserConventionWithoutGpsRecompute: {
      recompute: "PlayerRating + snapshots (+ ProgramTeamRating if live)",
      note: "Existing GPS rows retain old leagueWeight baked in at compute time."
    },
    ifReassignLeagueTiersAndRecomputeGps: {
      recompute: "GPS → PlayerRating → RankingSnapshot (+ ProgramTeamRating)",
      note: "Full remediation path for rating fairness under user convention."
    },
    ifInvertFormulaWeightsOnlyFutureGps: {
      recompute: "GPS (future imports only) — partial; historical ratings remain mixed",
      note: "Future-only policy correction (option C variant)."
    },
    currentExposure: {
      activeLeagues: inventory.length,
      totalGames,
      totalGps,
      playerRatingRows: playerRatingCount,
      programTeamRatingRows: programTeamRatingCount,
      leaguesMismatchedVsUserConventionHeuristic: affectedLeagues,
      gamesInMismatchedLeagues: affectedGames,
      gpsInMismatchedLeagues: affectedGps,
      percentGpsInMismatchedLeagues: totalGps ? Number(((affectedGps / totalGps) * 100).toFixed(2)) : 0
    }
  };

  const report = {
    generatedAt: new Date().toISOString(),
    auditType: "tier-integrity-read-only",
    conventions: {
      user: USER_TIER_LABELS,
      codeLabels: CODE_TIER_LABELS,
      formulaV1Weights: FORMULA_V1_WEIGHTS,
      requirementsDoc: internalConsistency.requirementsDocConvention
    },
    internalConsistency,
    inventory,
    groupedByTier: byTier,
    keyCompetitionFamilies: familySummary,
    mismatchedUnderUserConventionHeuristic: mismatchedUnderUserConvention,
    exposureAnalysis: historicalImpact.currentExposure,
    historicalImpact,
    recommendation: {
      choice: recommendation,
      text: recommendationText,
      confidence
    }
  };

  mkdirSync(REPORT_DIR, { recursive: true });
  mkdirSync(join(process.cwd(), "docs", "planning", "audits"), { recursive: true });

  const jsonPath = join(REPORT_DIR, "tier-integrity-audit.json");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");

  const markdown = buildMarkdown(report, jsonPath);
  writeFileSync(DOC_PATH, markdown, "utf8");

  console.log(JSON.stringify({ jsonPath, docPath: DOC_PATH, recommendation: report.recommendation }, null, 2));
}

function buildMarkdown(report: Record<string, unknown>, jsonPath: string) {
  const rec = report.recommendation as { choice: string; text: string; confidence: string };
  const exposure = report.exposureAnalysis as Record<string, number>;
  const families = report.keyCompetitionFamilies as Array<Record<string, unknown>>;
  const byTier = report.groupedByTier as Array<Record<string, unknown>>;
  const consistency = report.internalConsistency as Record<string, unknown>;

  const familyTable = families
    .map((family) => {
      const leagues = (family.leagues as Array<Record<string, unknown>>) || [];
      const leagueLines = leagues
        .map((league) => `| ${league.leagueName} | ${league.tier} | ${league.codeTierLabel} | ${league.ageGroup} | ${league.gameCount} | ${league.expectedTierUnderUserConvention ?? "—"} |`)
        .join("\n");
      return `### ${family.family}\n\n| League | DB Tier | Code Label | Age | Games | Expected (user 1=highest) |\n| --- | ---: | --- | --- | ---: | ---: |\n${leagueLines || "| — | — | — | — | — | — |"}`;
    })
    .join("\n\n");

  const tierSummary = byTier
    .map(
      (group) =>
        `| ${group.tier} | ${group.codeLabel} | ${group.userLabelIfTier1IsHighest} | ${group.formulaV1Weight} | ${group.userConventionAlignedWeight} | ${group.leagueCount} | ${group.gameCount} | ${group.gpsCount} |`
    )
    .join("\n");

  return `# Tier Integrity Audit

**Generated:** ${report.generatedAt}  
**Mode:** Read-only  
**Machine report:** \`${jsonPath.replace(/\\/g, "/")}\`

## Executive summary

**Recommendation:** **${rec.choice}** — ${rec.text}  
**Confidence:** ${rec.confidence}

Stakeholder convention: **Tier 1 = highest**, **Tier 4 = lowest**.  
Codebase + \`PHRANK_requirements.md\`: **Tier 1 = Entry (lowest weight)**, **Tier 4 = Elite (highest weight)**.

Formula v1 applies \`leagueWeight\` at GPS compute time using the **codebase scale** (higher numeric tier → higher multiplier).

## A. Internal consistency

| Layer | Tier 1 meaning | Tier 4 meaning | Aligns with v1 weights? |
| --- | --- | --- | --- |
| User convention | Highest | Lowest | No (inverted) |
| \`PHRANK_requirements.md\` | Entry | Elite | Yes |
| Code labels (\`player-profile.ts\`, \`CompetitionHistory.tsx\`) | Entry | Elite | Yes |
| Formula v1 / TPI-v1 weights | 1.00× | 1.40× | Yes (4 = strongest multiplier) |
| Admin UI | Numeric 1–4 only | Numeric 1–4 only | Ambiguous (no legend) |

**DB vs stored GPS weights:** ${(consistency.dbVsFormulaV1 as { consistent: boolean }).consistent ? "Stored `leagueWeight` on GPS rows matches current tier→weight mapping." : "Mismatch detected between stored GPS weights and tier mapping — inspect JSON."}

## B. Exposure analysis (user convention heuristic)

| Metric | Count |
| --- | ---: |
| Active leagues | ${exposure.activeLeagues} |
| Active games | ${exposure.totalGames} |
| Active GPS rows | ${exposure.totalGps} |
| PlayerRating rows | ${exposure.playerRatingRows} |
| ProgramTeamRating rows | ${exposure.programTeamRatingRows} |
| Leagues flagged vs user-expectation heuristic | ${exposure.leaguesMismatchedVsUserConventionHeuristic} |
| Games in flagged leagues | ${exposure.gamesInMismatchedLeagues} |
| GPS in flagged leagues | ${exposure.gpsInMismatchedLeagues} (${exposure.percentGpsInMismatchedLeagues}% of GPS) |

## C. Tier inventory summary

| DB Tier | Code label | If user 1=highest | v1 weight | User-aligned weight | Leagues | Games | GPS |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
${tierSummary}

## D. Key competitions

${familyTable}

## E. Historical impact if corrected

| Scenario | Recompute scope |
| --- | --- |
| Docs/admin labels only | None |
| Re-number \`League.tier\` only (no GPS rewrite) | PlayerRating, snapshots, ProgramTeamRating |
| Re-number tiers + GPS recompute | GPS → PlayerRating → snapshots (+ team ratings) |
| Invert formula weights for future GPS only | Partial; mixed historical ratings |

## F. Recommendation detail

**Choice ${rec.choice}:** ${rec.text}

### Evidence

- Requirements doc and implementation share one numbering model (1=Entry … 4=Elite).
- User/stakeholder model inverts that scale (1=Highest … 4=Lowest).
- Admin tier field has no legend, allowing mixed assignment intent.
- GPS \`leagueWeight\` is persisted per row; tier changes do not retroactively fix ratings without recompute.

## G. Non-actions (this audit)

- No code changes
- No data writes
- No rating/snapshot recompute
- No migrations

---

*End of read-only tier integrity audit.*
`;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
