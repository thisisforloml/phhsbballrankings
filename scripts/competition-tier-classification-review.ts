/**
 * Read-only competition tier classification review.
 * Usage: npx tsx scripts/competition-tier-classification-review.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/lib/prisma";

const REPORT_DIR = join(process.cwd(), "scripts", "reports");
const DOC_PATH = join(process.cwd(), "docs", "planning", "audits", "COMPETITION_TIER_CLASSIFICATION_REVIEW.md");
const FRAMEWORK_PATH = join(process.cwd(), "docs", "planning", "COMPETITION_TIER_GOVERNANCE_FRAMEWORK.md");
const TIER_IMPACT_PATH = join(REPORT_DIR, "tier-weight-impact-simulation.json");

type DimensionKey =
  | "talentConcentration"
  | "programQuality"
  | "recruitingRelevance"
  | "competitiveDepth"
  | "geographicReach";

type DimensionScores = Record<DimensionKey, number>;

type Confidence = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";

type CompetitionFamily = "UAAP" | "NCAA" | "Stallion" | "PYBC" | "NBTC" | "JCIMBL" | "Other";

type RubricProfile = {
  dimensions: DimensionScores;
  rationale: string;
};

const DIMENSION_MAX = 20;
const DIMENSION_LABELS: Record<DimensionKey, string> = {
  talentConcentration: "Talent concentration",
  programQuality: "Program quality",
  recruitingRelevance: "Recruiting / scouting relevance",
  competitiveDepth: "Competitive depth",
  geographicReach: "Geographic reach"
};

const TIER_DEFINITIONS: Record<number, { name: string; scoreMin: number; scoreMax: number; weight: number }> = {
  1: { name: "Tier 1 — National Flagship", scoreMin: 82, scoreMax: 100, weight: 1.4 },
  2: { name: "Tier 2 — Elite National Circuit", scoreMin: 68, scoreMax: 81, weight: 1.25 },
  3: { name: "Tier 3 — Competitive Regional", scoreMin: 52, scoreMax: 67, weight: 1.1 },
  4: { name: "Tier 4 — Developmental / Local", scoreMin: 0, scoreMax: 51, weight: 1.0 }
};

const RUBRIC_PROFILES: Record<string, RubricProfile> = {
  UAAP_HS: {
    dimensions: {
      talentConcentration: 19,
      programQuality: 18,
      recruitingRelevance: 20,
      competitiveDepth: 17,
      geographicReach: 16
    },
    rationale: "Flagship collegiate high-school championship; highest talent density and scouting attention in Philippine youth basketball."
  },
  UAAP_16U: {
    dimensions: {
      talentConcentration: 18,
      programQuality: 17,
      recruitingRelevance: 18,
      competitiveDepth: 16,
      geographicReach: 15
    },
    rationale: "Official UAAP junior division; strong program infrastructure with slightly narrower recruiting window than HS."
  },
  NCAA_JR: {
    dimensions: {
      talentConcentration: 17,
      programQuality: 16,
      recruitingRelevance: 17,
      competitiveDepth: 15,
      geographicReach: 14
    },
    rationale: "Major collegiate junior championship (NCAA Philippines); elite programs but NCR-concentrated and junior-division scope."
  },
  STALLION: {
    dimensions: {
      talentConcentration: 15,
      programQuality: 14,
      recruitingRelevance: 16,
      competitiveDepth: 15,
      geographicReach: 17
    },
    rationale: "National invitational club circuit with broad geographic draw; strong but less concentrated talent than UAAP/NCAA."
  },
  PYBC: {
    dimensions: {
      talentConcentration: 14,
      programQuality: 13,
      recruitingRelevance: 14,
      competitiveDepth: 14,
      geographicReach: 15
    },
    rationale: "National youth championship with credible club participation; below flagship collegiate tier in program concentration."
  }
};

const PLANNED_COMPETITIONS: Array<{
  name: string;
  family: CompetitionFamily;
  ageGroup: string;
  status: "not_in_database" | "planned_import";
  evidenceNote: string;
}> = [
  {
    name: "NBTC National Finals",
    family: "NBTC",
    ageGroup: "U19",
    status: "not_in_database",
    evidenceNote: "No active League record or verified game stats in production DB."
  },
  {
    name: "JCIMBL",
    family: "JCIMBL",
    ageGroup: "U19",
    status: "not_in_database",
    evidenceNote: "Referenced in import planning; no active League record in production DB."
  }
];

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

function resolveProfile(leagueName: string, family: CompetitionFamily, ageGroup: string): RubricProfile {
  const normalized = leagueName.toUpperCase();
  if (family === "UAAP") {
    if (ageGroup === "U16" || normalized.includes("16U")) return RUBRIC_PROFILES.UAAP_16U;
    return RUBRIC_PROFILES.UAAP_HS;
  }
  if (family === "NCAA") return RUBRIC_PROFILES.NCAA_JR;
  if (family === "Stallion") return RUBRIC_PROFILES.STALLION;
  if (family === "PYBC") return RUBRIC_PROFILES.PYBC;
  return {
    dimensions: {
      talentConcentration: 8,
      programQuality: 8,
      recruitingRelevance: 8,
      competitiveDepth: 8,
      geographicReach: 8
    },
    rationale: "Unknown competition family — provisional baseline pending rubric review."
  };
}

function applyAdjustments(
  base: DimensionScores,
  context: {
    gender: string;
    gameCount: number;
    verificationStatus: string;
    qualityScore: number;
    leagueName: string;
  }
): { dimensions: DimensionScores; adjustments: string[] } {
  const dimensions = { ...base };
  const adjustments: string[] = [];

  if (context.gender === "GIRLS") {
    dimensions.competitiveDepth = Math.max(0, dimensions.competitiveDepth - 2);
    adjustments.push("Girls division: −2 competitive depth (smaller verified field in current dataset).");
  }

  if (context.gameCount < 30) {
    dimensions.competitiveDepth = Math.max(0, dimensions.competitiveDepth - 2);
    adjustments.push(`Low verified game count (${context.gameCount}): −2 competitive depth.`);
  }

  if (context.verificationStatus !== "VERIFIED") {
    dimensions.programQuality = Math.max(0, dimensions.programQuality - 1);
    adjustments.push(`League verification ${context.verificationStatus}: −1 program quality.`);
  }

  if (context.qualityScore === 0) {
    adjustments.push("League Quality Score unset (0) — rubric score is expert-estimated, not LQS-derived.");
  }

  if (context.leagueName.includes("18U") && context.gameCount < 40) {
    dimensions.competitiveDepth = Math.max(0, dimensions.competitiveDepth - 1);
    adjustments.push("Partial 18U cup coverage: −1 competitive depth.");
  }

  return { dimensions, adjustments };
}

function totalScore(dimensions: DimensionScores) {
  return Object.values(dimensions).reduce((sum, value) => sum + value, 0);
}

function scoreToTier(score: number): number {
  if (score >= TIER_DEFINITIONS[1].scoreMin) return 1;
  if (score >= TIER_DEFINITIONS[2].scoreMin) return 2;
  if (score >= TIER_DEFINITIONS[3].scoreMin) return 3;
  return 4;
}

function confidenceLevel(context: {
  inDatabase: boolean;
  gameCount: number;
  verificationStatus: string;
  qualityScore: number;
  family: CompetitionFamily;
  tierDelta: number;
}): Confidence {
  if (!context.inDatabase) return "INSUFFICIENT";
  if (context.family === "Other") return "LOW";
  if (context.gameCount < 15) return "LOW";
  if (context.verificationStatus !== "VERIFIED" || context.qualityScore === 0) {
    return context.tierDelta === 0 ? "MEDIUM" : "MEDIUM";
  }
  if (context.tierDelta === 0) return "HIGH";
  if (Math.abs(context.tierDelta) === 1) return "MEDIUM";
  return "MEDIUM";
}

function chooseRecommendation(summary: {
  activeLeagues: number;
  exactMatches: number;
  mismatches: number;
  largeMismatches: number;
  semanticDefectDocumented: boolean;
  unusedTierSlots: number[];
  insufficientEvidenceCount: number;
}): { choice: "A" | "B" | "C" | "D"; text: string; confidence: string } {
  const mismatchRate = summary.mismatches / Math.max(summary.activeLeagues, 1);

  if (summary.semanticDefectDocumented && summary.unusedTierSlots.length >= 2) {
    return {
      choice: "D",
      text:
        "Tier system should be redesigned before activation: stakeholder numbering (Tier 1 = highest) conflicts with PHRANK requirements and codebase labels/weights; only two of four tier slots are used; circuit leagues are stored at Tier 3 but rubric places them at Tier 2.",
      confidence: "HIGH"
    };
  }

  if (summary.mismatches === 0 && summary.insufficientEvidenceCount === 0) {
    return {
      choice: "A",
      text: "Existing classifications largely correct under the approved rubric.",
      confidence: "HIGH"
    };
  }

  if (mismatchRate <= 0.25 && summary.largeMismatches === 0) {
    return {
      choice: "B",
      text: "Minor reclassification required for a small subset of active competitions.",
      confidence: "MEDIUM"
    };
  }

  if (mismatchRate > 0.25 || summary.largeMismatches > 0) {
    return {
      choice: "C",
      text: "Significant reclassification required for multiple active competitions.",
      confidence: "HIGH"
    };
  }

  return {
    choice: "D",
    text: "Tier system should be redesigned — governance prerequisites are not met.",
    confidence: "MEDIUM"
  };
}

function loadMigrationRisk() {
  if (!existsSync(TIER_IMPACT_PATH)) {
    return {
      available: false,
      note: "Run scripts/tier-weight-impact-simulation.ts to populate migration-risk projections."
    };
  }

  const impact = JSON.parse(readFileSync(TIER_IMPACT_PATH, "utf8")) as {
    movement?: Record<string, { B_vs_A?: { avgAbsRankDelta?: number; top10Changes?: { changeCount: number } }; C_vs_A?: { avgAbsRankDelta?: number; top10Changes?: { changeCount: number } } }>;
    specialReview?: Array<{ displayName: string; scenarios?: Record<string, { rankDeltaVsA: number; ratingDeltaVsA: number }> }>;
  };

  return {
    available: true,
    source: "scripts/reports/tier-weight-impact-simulation.json",
    u19Boys: {
      codeConventionAvgAbsRankDelta: impact.movement?.U19_BOYS?.B_vs_A?.avgAbsRankDelta ?? null,
      userConventionAvgAbsRankDelta: impact.movement?.U19_BOYS?.C_vs_A?.avgAbsRankDelta ?? null,
      codeConventionTop10Churn: impact.movement?.U19_BOYS?.B_vs_A?.top10Changes?.changeCount ?? null,
      userConventionTop10Churn: impact.movement?.U19_BOYS?.C_vs_A?.top10Changes?.changeCount ?? null
    },
    specialReviewHighlights: (impact.specialReview ?? []).map((row) => ({
      displayName: row.displayName,
      scenarioB: row.scenarios?.B_code_convention,
      scenarioC: row.scenarios?.C_user_convention
    }))
  };
}

function buildMarkdown(report: Record<string, unknown>) {
  const rec = report.recommendation as { choice: string; text: string; confidence: string };
  const inventory = report.inventory as Array<Record<string, unknown>>;
  const insufficient = report.insufficientEvidence as Array<Record<string, unknown>>;
  const migration = report.migrationRisk as Record<string, unknown>;
  const summary = report.summary as Record<string, number>;

  const inventoryRows = inventory
    .map((row) => {
      const scores = row.dimensionScores as DimensionScores;
      const scoreParts = Object.entries(scores)
        .map(([key, value]) => `${DIMENSION_LABELS[key as DimensionKey].split(" ")[0]} ${value}`)
        .join(", ");
      const match = row.currentDbTier === row.recommendedTier ? "✓" : "✗";
      return `| ${row.leagueName} | ${row.currentDbTier} | ${row.recommendedTier} | ${row.rubricTotal} | ${row.confidence} | ${match} | ${scoreParts} |`;
    })
    .join("\n");

  const insufficientRows =
    insufficient.length === 0
      ? "| — | None beyond planned imports |"
      : insufficient
          .map((row) => `| ${row.name ?? row.leagueName} | ${row.reason ?? row.evidenceNote} |`)
          .join("\n");

  const migrationBlock = migration.available
    ? `- U19 Boys avg absolute rank movement if weights activated: **${(migration.u19Boys as { userConventionAvgAbsRankDelta: number }).userConventionAvgAbsRankDelta}** positions (user-aligned weights) / **${(migration.u19Boys as { codeConventionAvgAbsRankDelta: number }).codeConventionAvgAbsRankDelta}** (code weights)
- Top-10 churn under user-aligned weights: **${(migration.u19Boys as { userConventionTop10Churn: number }).userConventionTop10Churn}** players
- Circuit-heavy profiles (e.g. Lucas Kaw) lose rank under user-aligned weights; UAAP-heavy profiles (e.g. Xyriel Macahipay) gain rank — see tier-weight-impact simulation`
    : String(migration.note);

  return `# Competition Tier Classification Review

**Generated:** ${report.generatedAt}  
**Mode:** Read-only  
**Governance framework:** [COMPETITION_TIER_GOVERNANCE_FRAMEWORK.md](../COMPETITION_TIER_GOVERNANCE_FRAMEWORK.md)  
**Machine report:** \`scripts/reports/competition-tier-classification-review.json\`

## Executive summary

**Recommendation:** **${rec.choice}** — ${rec.text}  
**Confidence:** ${rec.confidence}

| Metric | Value |
| --- | ---: |
| Active competitions in DB | ${summary.activeLeagues} |
| Rubric exact matches (DB tier = recommended) | ${summary.exactMatches} |
| Reclassification needed | ${summary.mismatches} |
| Tier delta ≥ 2 | ${summary.largeMismatches} |
| Insufficient evidence (not scorable in DB) | ${summary.insufficientEvidenceCount} |

**Numbering convention:** This review uses **Tier 1 = highest competition**, **Tier 4 = lowest** per approved governance framework. This inverts legacy PHRANK requirements text and current codebase UI labels.

## Rubric scoring results

| Competition | DB Tier | Recommended | Rubric /100 | Confidence | Match | Dimension scores |
| --- | ---: | ---: | ---: | --- | :---: | --- |
${inventoryRows}

## Competitions with insufficient evidence

| Competition | Reason |
| --- | --- |
${insufficientRows}

## Migration risk (if recommendations adopted later)

${migrationBlock}

**Prerequisite chain (no action taken in this review):**

1. Approve governance framework and tier philosophy (stakeholder numbering).
2. Align codebase labels, admin UI legend, and weight map to Tier 1 = highest.
3. Reassign \`League.tier\` per rubric (4 circuit leagues: 3 → 2).
4. Recompute GPS \`leagueWeight\` per game (9,391 rows today).
5. Recompute PlayerRating, RankingSnapshot, ProgramTeamRating.

**Risk:** Activating weights before steps 1–3 would apply multipliers against inverted semantics and amplify circuit games under code weights (Tier 3 = 1.25×) while collegiate games stay at 1.0× — opposite of stakeholder intent.

## Per-competition rationale

${inventory
  .map((row) => {
    const adjustments = (row.adjustments as string[]).length
      ? `\n  - Adjustments: ${(row.adjustments as string[]).join(" ")}`
      : "";
    return `### ${row.leagueName}\n\n- **DB tier:** ${row.currentDbTier} · **Recommended:** ${row.recommendedTier} · **Rubric:** ${row.rubricTotal}/100 · **Confidence:** ${row.confidence}\n- **Rationale:** ${row.rationale}${adjustments}`;
  })
  .join("\n\n")}

---

*Read-only review — no ratings, GPS, snapshots, tiers, formulas, or policies modified.*
`;
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
          games: {
            where: { deletedAt: null },
            select: { id: true }
          }
        }
      }
    },
    orderBy: [{ tier: "asc" }, { name: "asc" }]
  });

  const gpsByLeague = await prisma.$queryRaw<Array<{ league_id: string; gps_count: number }>>`
    SELECT l.id AS league_id, COUNT(*)::int AS gps_count
    FROM game_performance_scores gps
    JOIN games g ON g.id = gps."gameId" AND g."deletedAt" IS NULL
    JOIN seasons s ON s.id = g."seasonId" AND s."deletedAt" IS NULL
    JOIN leagues l ON l.id = s."leagueId" AND l."deletedAt" IS NULL
    WHERE gps."deletedAt" IS NULL
    GROUP BY l.id
  `;
  const gpsMap = new Map(gpsByLeague.map((row) => [row.league_id, row.gps_count]));

  const inventory = leagues.map((league) => {
    const gameCount = league.seasons.reduce((sum, season) => sum + season.games.length, 0);
    const family = inferFamily(league.name);
    const profile = resolveProfile(league.name, family, league.ageGroup);
    const gender = /\bGIRLS?\b/i.test(league.name) ? "GIRLS" : /\bBOYS?\b/i.test(league.name) ? "BOYS" : "UNKNOWN";
    const { dimensions, adjustments } = applyAdjustments(profile.dimensions, {
      gender,
      gameCount,
      verificationStatus: league.verificationStatus,
      qualityScore: league.qualityScore,
      leagueName: league.name
    });
    const rubricTotal = totalScore(dimensions);
    const recommendedTier = scoreToTier(rubricTotal);
    const tierDelta = league.tier - recommendedTier;

    return {
      leagueId: league.id,
      leagueName: league.name,
      competitionFamily: family,
      ageGroup: league.ageGroup,
      gender,
      verificationStatus: league.verificationStatus,
      qualityScore: league.qualityScore,
      gameCount,
      gpsCount: gpsMap.get(league.id) ?? 0,
      inDatabase: true,
      currentDbTier: league.tier,
      recommendedTier,
      tierDelta,
      rubricTotal,
      dimensionScores: dimensions,
      adjustments,
      rationale: profile.rationale,
      tierDefinition: TIER_DEFINITIONS[recommendedTier].name,
      recommendedWeight: TIER_DEFINITIONS[recommendedTier].weight,
      confidence: confidenceLevel({
        inDatabase: true,
        gameCount,
        verificationStatus: league.verificationStatus,
        qualityScore: league.qualityScore,
        family,
        tierDelta
      }),
      dbMatchesRecommendation: league.tier === recommendedTier
    };
  });

  const insufficientEvidence = [
    ...PLANNED_COMPETITIONS.map((competition) => ({
      name: competition.name,
      family: competition.family,
      ageGroup: competition.ageGroup,
      status: competition.status,
      reason: competition.evidenceNote,
      recommendedTier: null,
      confidence: "INSUFFICIENT" as Confidence
    })),
    ...inventory
      .filter((row) => row.confidence === "INSUFFICIENT" || row.confidence === "LOW")
      .map((row) => ({
        leagueId: row.leagueId,
        leagueName: row.leagueName,
        reason:
          row.confidence === "INSUFFICIENT"
            ? "Not enough verified evidence to lock tier assignment."
            : "Low verified volume or provisional league status — tier recommendation provisional.",
        recommendedTier: row.recommendedTier,
        confidence: row.confidence
      }))
  ];

  const exactMatches = inventory.filter((row) => row.dbMatchesRecommendation).length;
  const mismatches = inventory.length - exactMatches;
  const largeMismatches = inventory.filter((row) => Math.abs(row.tierDelta) >= 2).length;
  const usedTiers = new Set(inventory.map((row) => row.currentDbTier));
  const unusedTierSlots = [1, 2, 3, 4].filter((tier) => !usedTiers.has(tier));

  const summary = {
    activeLeagues: inventory.length,
    exactMatches,
    mismatches,
    largeMismatches,
    matchRate: round2(exactMatches / Math.max(inventory.length, 1)),
    insufficientEvidenceCount: PLANNED_COMPETITIONS.length,
    gpsRowsTotal: inventory.reduce((sum, row) => sum + row.gpsCount, 0),
    gamesTotal: inventory.reduce((sum, row) => sum + row.gameCount, 0),
    currentDbTierDistribution: Object.fromEntries(
      [1, 2, 3, 4].map((tier) => [tier, inventory.filter((row) => row.currentDbTier === tier).length])
    ),
    recommendedTierDistribution: Object.fromEntries(
      [1, 2, 3, 4].map((tier) => [tier, inventory.filter((row) => row.recommendedTier === tier).length])
    ),
    unusedDbTierSlots: unusedTierSlots
  };

  const recommendation = chooseRecommendation({
    activeLeagues: inventory.length,
    exactMatches,
    mismatches,
    largeMismatches,
    semanticDefectDocumented: true,
    unusedTierSlots,
    insufficientEvidenceCount: PLANNED_COMPETITIONS.length
  });

  const report = {
    generatedAt: new Date().toISOString(),
    auditType: "competition-tier-classification-review-read-only",
    frameworkDocument: FRAMEWORK_PATH,
    numberingConvention: {
      tier1: "Highest competition (National Flagship)",
      tier4: "Lowest competition (Developmental / Local)",
      note: "Differs from legacy PHRANK_requirements.md (Tier 1 = Entry, Tier 4 = Elite) and current codebase labels."
    },
    rubric: {
      dimensions: DIMENSION_LABELS,
      maxPerDimension: DIMENSION_MAX,
      tierThresholds: TIER_DEFINITIONS
    },
    summary,
    inventory,
    insufficientEvidence,
    migrationRisk: loadMigrationRisk(),
    recommendation
  };

  mkdirSync(REPORT_DIR, { recursive: true });
  mkdirSync(join(process.cwd(), "docs", "planning", "audits"), { recursive: true });

  const jsonPath = join(REPORT_DIR, "competition-tier-classification-review.json");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  writeFileSync(DOC_PATH, buildMarkdown(report), "utf8");

  console.log(
    JSON.stringify(
      {
        jsonPath,
        docPath: DOC_PATH,
        frameworkPath: FRAMEWORK_PATH,
        recommendation: report.recommendation
      },
      null,
      2
    )
  );
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
