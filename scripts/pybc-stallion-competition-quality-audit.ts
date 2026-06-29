/**
 * Read-only PYBC vs Stallion cross-competition performance audit.
 * Usage: npx tsx scripts/pybc-stallion-competition-quality-audit.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/lib/prisma";
import { FORMULA_V1_VERSION_NUMBER } from "../src/lib/ratings/formula-constants";

const REPORT_DIR = join(process.cwd(), "scripts", "reports");
const DOC_PATH = join(process.cwd(), "docs", "planning", "audits", "PYBC_STALLION_COMPETITION_QUALITY_AUDIT.md");

type CompetitionFamily = "PYBC" | "Stallion";

type GpsRow = {
  player_id: string;
  display_name: string;
  league_id: string;
  league_name: string;
  age_group: string;
  team_id: string;
  team_name: string;
  program_id: string | null;
  program_name: string | null;
  family: CompetitionFamily;
  final_score: number;
};

type PlayerCompetitionStats = {
  games: number;
  avgGps: number;
  scores: number[];
};

type OverlapPlayer = {
  playerId: string;
  displayName: string;
  pybc: PlayerCompetitionStats;
  stallion: PlayerCompetitionStats;
  gpsDelta: number;
  pybcPercentile: number;
  stallionPercentile: number;
  percentileDelta: number;
  pybcAgeGroups: string[];
  stallionAgeGroups: string[];
};

function round2(value: number) {
  return Number(value.toFixed(2));
}

function round4(value: number) {
  return Number(value.toFixed(4));
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentileRank(value: number, population: number[]) {
  if (!population.length) return 0;
  const below = population.filter((entry) => entry < value).length;
  const equal = population.filter((entry) => entry === value).length;
  return round2(((below + equal * 0.5) / population.length) * 100);
}

function inferFamily(leagueName: string): CompetitionFamily | null {
  const normalized = leagueName.toUpperCase();
  if (normalized.includes("STALLION")) return "Stallion";
  if (normalized.includes("PYBC") || normalized.includes("PHILIPPINE YOUTH BASKETBALL")) return "PYBC";
  return null;
}

function histogram(values: number[], bucketSize = 5) {
  const buckets = new Map<string, number>();
  for (const value of values) {
    const floor = Math.floor(value / bucketSize) * bucketSize;
    const key = `${floor >= 0 ? "+" : ""}${floor} to ${floor + bucketSize - 1}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .map(([range, count]) => ({ range, count }))
    .sort((a, b) => {
      const parse = (label: string) => Number(label.split(" ")[0].replace("+", ""));
      return parse(a.range) - parse(b.range);
    });
}

function buildPlayerAverages(rows: GpsRow[], family: CompetitionFamily) {
  const byPlayer = new Map<string, { displayName: string; scores: number[]; ageGroups: Set<string> }>();
  for (const row of rows) {
    if (row.family !== family) continue;
    const bucket = byPlayer.get(row.player_id) ?? {
      displayName: row.display_name,
      scores: [],
      ageGroups: new Set<string>()
    };
    bucket.scores.push(row.final_score);
    bucket.ageGroups.add(row.age_group);
    byPlayer.set(row.player_id, bucket);
  }

  const averages: Array<{ playerId: string; displayName: string; avgGps: number; games: number; ageGroups: string[] }> = [];
  for (const [playerId, bucket] of byPlayer) {
    averages.push({
      playerId,
      displayName: bucket.displayName,
      avgGps: mean(bucket.scores),
      games: bucket.scores.length,
      ageGroups: [...bucket.ageGroups].sort()
    });
  }
  return averages;
}

function normalizeTeamName(name: string) {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\b(BASKETBALL|BC|CLUB|TEAM)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function distributionStats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const pct = (p: number) => {
    if (!sorted.length) return 0;
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
  };
  return {
    count: values.length,
    mean: round2(mean(values)),
    median: round2(median(values)),
    p25: round2(pct(25)),
    p75: round2(pct(75)),
    min: round2(sorted[0] ?? 0),
    max: round2(sorted.at(-1) ?? 0),
    stdDev: round2(
      values.length > 1
        ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean(values)) ** 2, 0) / (values.length - 1))
        : 0
    )
  };
}

function buildTeamNameOverlap(rows: GpsRow[]) {
  const teams = new Map<
    string,
    {
      normalizedName: string;
      displayName: string;
      pybcScores: number[];
      stallionScores: number[];
      pybcPlayers: Set<string>;
      stallionPlayers: Set<string>;
    }
  >();

  for (const row of rows) {
    const key = normalizeTeamName(row.team_name);
    if (!key) continue;
    const bucket = teams.get(key) ?? {
      normalizedName: key,
      displayName: row.team_name,
      pybcScores: [],
      stallionScores: [],
      pybcPlayers: new Set<string>(),
      stallionPlayers: new Set<string>()
    };
    if (row.family === "PYBC") {
      bucket.pybcScores.push(row.final_score);
      bucket.pybcPlayers.add(row.player_id);
    } else {
      bucket.stallionScores.push(row.final_score);
      bucket.stallionPlayers.add(row.player_id);
    }
    teams.set(key, bucket);
  }

  return [...teams.values()]
    .filter((row) => row.pybcScores.length > 0 && row.stallionScores.length > 0)
    .map((row) => {
      const pybcTeamAvgGps = round2(mean(row.pybcScores));
      const stallionTeamAvgGps = round2(mean(row.stallionScores));
      return {
        normalizedTeamName: row.normalizedName,
        displayName: row.displayName,
        pybcGames: row.pybcScores.length,
        stallionGames: row.stallionScores.length,
        pybcPlayers: row.pybcPlayers.size,
        stallionPlayers: row.stallionPlayers.size,
        pybcTeamAvgGps,
        stallionTeamAvgGps,
        teamGpsDelta: round2(pybcTeamAvgGps - stallionTeamAvgGps)
      };
    })
    .sort((a, b) => b.pybcGames + b.stallionGames - (a.pybcGames + a.stallionGames));
}

function chooseRecommendation(context: {
  overlapCount: number;
  overlapWithMinGames: number;
  medianDelta: number;
  meanDelta: number;
  pybcMeanAvg: number;
  stallionMeanAvg: number;
  sameAgeOverlapCount: number;
  programOverlapCount: number;
}) {
  if (context.overlapCount < 5) {
    const populationGap = round2(context.pybcMeanAvg - context.stallionMeanAvg);
    const populationNote =
      context.overlapCount === 0
        ? `Zero same-player overlap. PYBC covers U13/U16; Stallion covers U19 — populations are not age-aligned. Population mean GPS gap (PYBC ${context.pybcMeanAvg} vs Stallion ${context.stallionMeanAvg}, Δ ${populationGap >= 0 ? "+" : ""}${populationGap}) is **not** valid evidence for tier ordering because GPS is within-game percentile-scaled and age groups differ.`
        : `Only ${context.overlapCount} overlapping player(s); sample too small for tier inference.`;

    return {
      pybcTierRecommendation: 2,
      tierEvidence: "Inconclusive" as const,
      confidence: "LOW" as const,
      rationale: `${populationNote} Governance rubric (COMPETITION_TIER_GOVERNANCE_FRAMEWORK.md) independently places PYBC and Stallion both at Tier 2 (Elite National Circuit); this audit cannot confirm or refute that via cross-player GPS.`,
      additionalEvidenceRequired: true,
      additionalEvidenceNotes: [
        "Import age-aligned cohorts (e.g. PYBC 17U/19U or Stallion U16) to enable same-player comparison.",
        "No Program appears in both PYBC and Stallion — clubs use separate team records per competition despite Program linkage on GPS rows.",
        "Target ≥15 players with ≥3 games in each competition before GPS-based tier inference.",
        "Use team-name overlap analysis (see report) as supplementary program signal until Program linkage is complete.",
        "Complete League Quality Score computation for PYBC seasons."
      ]
    };
  }

  const stallionHigher = context.stallionMeanAvg > context.pybcMeanAvg;
  const deltaMagnitude = Math.abs(context.medianDelta);

  if (stallionHigher && deltaMagnitude >= 3 && context.sameAgeOverlapCount >= 5) {
    return {
      pybcTierRecommendation: 3,
      tierEvidence: "Supports PYBC Tier 3" as const,
      confidence: "MEDIUM" as const,
      rationale:
        "Overlapping players average higher GPS in Stallion than PYBC with meaningful median delta, suggesting PYBC sits below Stallion in observed performance signal.",
      additionalEvidenceRequired: true,
      additionalEvidenceNotes: [
        "Confirm age-group alignment for overlap cohort.",
        "Validate whether GPS gap reflects competition quality vs schedule/opponent mix."
      ]
    };
  }

  if (!stallionHigher && deltaMagnitude < 3) {
    return {
      pybcTierRecommendation: 2,
      tierEvidence: "Supports PYBC Tier 2" as const,
      confidence: "MEDIUM" as const,
      rationale:
        "Cross-competition GPS averages are close; PYBC performance signal is comparable to Stallion for overlapping players.",
      additionalEvidenceRequired: true,
      additionalEvidenceNotes: [
        "Expand overlap sample before locking tier assignment.",
        "Compare team-level results for programs in both competitions."
      ]
    };
  }

  if (Math.abs(context.pybcMeanAvg - context.stallionMeanAvg) < 2 && context.programOverlapCount > 0) {
    return {
      pybcTierRecommendation: 2,
      tierEvidence: "Supports PYBC Tier 2" as const,
      confidence: "MEDIUM" as const,
      rationale:
        "Aggregate competition means are similar and programs compete in both circuits — supports same elite-national-circuit tier band as Stallion.",
      additionalEvidenceRequired: true,
      additionalEvidenceNotes: ["Increase same-player overlap sample size."]
    };
  }

  return {
    pybcTierRecommendation: 2,
    tierEvidence: "Inconclusive" as const,
    confidence: "LOW" as const,
    rationale:
      "Mixed signals: limited overlap, age-group separation, or inconsistent player deltas prevent a confident tier separation.",
    additionalEvidenceRequired: true,
    additionalEvidenceNotes: [
      "Need more same-player cross-competition games.",
      "Age-aligned cohort comparison required.",
      "Board review with rubric scores from COMPETITION_TIER_GOVERNANCE_FRAMEWORK.md."
    ]
  };
}

function buildMarkdown(report: Record<string, unknown>) {
  const rec = report.recommendation as Record<string, unknown>;
  const summary = report.summary as Record<string, unknown>;
  const overlap = report.overlapPlayers as OverlapPlayer[];
  const aggregates = report.aggregates as Record<string, unknown>;
  const programs = report.programOverlap as Array<Record<string, unknown>>;
  const teams = report.teamNameOverlap as Array<Record<string, unknown>>;
  const population = report.populationStats as Record<string, unknown>;
  const linkage = report.linkageStats as Record<string, unknown>;
  const competition = report.competitionSummary as Record<string, unknown>;

  const overlapRows =
    overlap.length === 0
      ? "| — | No overlapping players | — | — | — | — | — | — | — |"
      : overlap
          .slice(0, 25)
          .map(
            (row) =>
              `| ${row.displayName} | ${row.pybc.games} | ${row.stallion.games} | ${row.pybc.avgGps} | ${row.stallion.avgGps} | ${row.gpsDelta >= 0 ? "+" : ""}${row.gpsDelta} | ${row.pybcPercentile} | ${row.stallionPercentile} | ${row.percentileDelta >= 0 ? "+" : ""}${row.percentileDelta} |`
          )
          .join("\n");

  const programRows =
    programs.length === 0
      ? "| — | No program overlap | — | — | — |"
      : programs
          .slice(0, 20)
          .map(
            (row) =>
              `| ${row.programName} | ${row.pybcGames} | ${row.stallionGames} | ${row.pybcTeamAvgGps} | ${row.stallionTeamAvgGps} | ${row.teamGpsDelta >= 0 ? "+" : ""}${row.teamGpsDelta} |`
          )
          .join("\n");

  const teamRows =
    teams.length === 0
      ? "| — | No normalized team-name overlap | — | — | — | — | — |"
      : teams
          .slice(0, 20)
          .map(
            (row) =>
              `| ${row.displayName} | ${row.pybcGames} | ${row.stallionGames} | ${row.pybcPlayers} | ${row.stallionPlayers} | ${row.pybcTeamAvgGps} | ${row.stallionTeamAvgGps} | ${row.teamGpsDelta >= 0 ? "+" : ""}${row.teamGpsDelta} |`
          )
          .join("\n");

  const pop = population as {
    PYBC: { gameLevel: Record<string, number>; playerAvgLevel: Record<string, number> };
    Stallion: { gameLevel: Record<string, number>; playerAvgLevel: Record<string, number> };
  };

  const histRows = ((aggregates.deltaHistogram as Array<{ range: string; count: number }>) ?? [])
    .map((row) => `| ${row.range} | ${row.count} |`)
    .join("\n");

  return `# PYBC vs Stallion Competition Quality Audit

**Generated:** ${report.generatedAt}  
**Mode:** Read-only  
**Machine report:** \`scripts/reports/pybc-stallion-competition-quality-audit.json\`

## Executive summary

| Metric | PYBC | Stallion |
| --- | --- | --- |
| Leagues | ${(competition.PYBC as { leagueCount: number }).leagueCount} | ${(competition.Stallion as { leagueCount: number }).leagueCount} |
| Games | ${(competition.PYBC as { gameCount: number }).gameCount} | ${(competition.Stallion as { gameCount: number }).gameCount} |
| GPS rows | ${(competition.PYBC as { gpsCount: number }).gpsCount} | ${(competition.Stallion as { gpsCount: number }).gpsCount} |
| Unique players | ${(competition.PYBC as { playerCount: number }).playerCount} | ${(competition.Stallion as { playerCount: number }).playerCount} |
| Mean player avg GPS | ${(competition.PYBC as { meanPlayerAvgGps: number }).meanPlayerAvgGps} | ${(competition.Stallion as { meanPlayerAvgGps: number }).meanPlayerAvgGps} |

**Overlapping players (both competitions):** ${summary.overlapPlayerCount}  
**Overlap with ≥3 games in each:** ${summary.overlapWithMinGamesEach}  
**Programs in both competitions:** ${summary.programOverlapCount}  
**Teams (normalized name) in both:** ${summary.teamNameOverlapCount ?? 0}  
**GPS rows with Program linkage:** ${(linkage as { gpsWithProgramPct?: number }).gpsWithProgramPct ?? "—"}%

## Critical limitation

**Zero same-player overlap.** PYBC leagues are **U13/U16**; Stallion leagues are **U19**. Cross-competition player GPS comparison is **not possible** with current data. Population-level GPS means are shown for transparency but **must not** be used alone for tier ordering (within-game percentile scaling + age mismatch).

## Population-level GPS (non-overlap — descriptive only)

| Stat | PYBC game GPS | Stallion game GPS | PYBC player avg | Stallion player avg |
| --- | ---: | ---: | ---: | ---: |
| Mean | ${pop.PYBC.gameLevel.mean} | ${pop.Stallion.gameLevel.mean} | ${pop.PYBC.playerAvgLevel.mean} | ${pop.Stallion.playerAvgLevel.mean} |
| Median | ${pop.PYBC.gameLevel.median} | ${pop.Stallion.gameLevel.median} | ${pop.PYBC.playerAvgLevel.median} | ${pop.Stallion.playerAvgLevel.median} |
| P25 / P75 | ${pop.PYBC.gameLevel.p25} / ${pop.PYBC.gameLevel.p75} | ${pop.Stallion.gameLevel.p25} / ${pop.Stallion.gameLevel.p75} | ${pop.PYBC.playerAvgLevel.p25} / ${pop.PYBC.playerAvgLevel.p75} | ${pop.Stallion.playerAvgLevel.p25} / ${pop.Stallion.playerAvgLevel.p75} |
| Std dev | ${pop.PYBC.gameLevel.stdDev} | ${pop.Stallion.gameLevel.stdDev} | ${pop.PYBC.playerAvgLevel.stdDev} | ${pop.Stallion.playerAvgLevel.stdDev} |

## Recommendation

| Field | Value |
| --- | --- |
| **Recommended PYBC tier** | **Tier ${rec.pybcTierRecommendation}** |
| **Evidence conclusion** | **${rec.tierEvidence}** |
| **Confidence** | **${rec.confidence}** |
| **Additional evidence required** | **${rec.additionalEvidenceRequired ? "Yes" : "No"}** |

${rec.rationale}

### Expected impact on future rating governance

${report.governanceImpact}

### Additional evidence notes

${(rec.additionalEvidenceNotes as string[]).map((note) => `- ${note}`).join("\n")}

## Aggregate GPS comparison

| Metric | Value |
| --- | ---: |
| Mean PYBC avg GPS (overlap players) | ${aggregates.meanPybcAvgGps ?? "—"} |
| Mean Stallion avg GPS (overlap players) | ${aggregates.meanStallionAvgGps ?? "—"} |
| Mean GPS delta (PYBC − Stallion) | ${aggregates.meanGpsDelta ?? "—"} |
| Median GPS delta | ${aggregates.medianGpsDelta ?? "—"} |
| Std dev of deltas | ${aggregates.stdDevGpsDelta ?? "—"} |
| PYBC higher (count) | ${aggregates.pybcHigherCount ?? 0} |
| Stallion higher (count) | ${aggregates.stallionHigherCount ?? 0} |
| Tied (count) | ${aggregates.tiedCount ?? 0} |

### Delta distribution (PYBC avg − Stallion avg)

| Range | Players |
| --- | ---: |
${histRows || "| — | 0 |"}

### Outliers

**Top positive (PYBC > Stallion):**

${((aggregates.topPositiveOutliers as OverlapPlayer[]) ?? []).map((row) => `- ${row.displayName}: Δ ${row.gpsDelta} (PYBC ${row.pybc.avgGps} vs Stallion ${row.stallion.avgGps})`).join("\n") || "- None"}

**Top negative (Stallion > PYBC):**

${((aggregates.topNegativeOutliers as OverlapPlayer[]) ?? []).map((row) => `- ${row.displayName}: Δ ${row.gpsDelta} (PYBC ${row.pybc.avgGps} vs Stallion ${row.stallion.avgGps})`).join("\n") || "- None"}

## Overlapping players (top 25 by |Δ|)

| Player | PYBC G | Stallion G | PYBC avg | Stallion avg | Δ GPS | PYBC %ile | Stallion %ile | Δ %ile |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${overlapRows}

## Program overlap (via programId)

| Program | PYBC games | Stallion games | PYBC team avg GPS | Stallion team avg GPS | Δ |
| --- | ---: | ---: | ---: | ---: | ---: |
${programRows}

## Team overlap (normalized team name)

| Team | PYBC G | Stallion G | PYBC players | Stallion players | PYBC avg GPS | Stallion avg GPS | Δ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${teamRows}

## Methodology

- **GPS:** Formula v1 \`finalPerformanceScore\` per game.
- **Player avg:** Arithmetic mean of game GPS within each competition family.
- **Percentile:** Player's competition average vs all player averages in that family (0–100).
- **Delta:** PYBC avg GPS − Stallion avg GPS (negative = higher in Stallion).
- **Age-group note:** PYBC leagues are U13/U16; Stallion leagues are U19 — direct player overlap may reflect multi-age careers or data linkage, not same-season cohort.

---

*Read-only audit — no data modified.*
`;
}

async function loadGpsRows(): Promise<GpsRow[]> {
  return prisma.$queryRaw<GpsRow[]>`
    SELECT
      gps."playerId" AS player_id,
      p."displayName" AS display_name,
      l.id AS league_id,
      l.name AS league_name,
      l."ageGroup"::text AS age_group,
      gs."teamId" AS team_id,
      t.name AS team_name,
      t."programId" AS program_id,
      pr."fullName" AS program_name,
      CASE
        WHEN UPPER(l.name) LIKE '%STALLION%' THEN 'Stallion'
        ELSE 'PYBC'
      END AS family,
      gps."finalPerformanceScore"::float AS final_score
    FROM game_performance_scores gps
    JOIN formula_versions fv ON fv.id = gps."formulaVersionId" AND fv."versionNumber" = ${FORMULA_V1_VERSION_NUMBER}
    JOIN game_stats gs ON gs.id = gps."gameStatId" AND gs."deletedAt" IS NULL
    JOIN games g ON g.id = gps."gameId" AND g."deletedAt" IS NULL
    JOIN seasons s ON s.id = g."seasonId" AND s."deletedAt" IS NULL
    JOIN leagues l ON l.id = s."leagueId" AND l."deletedAt" IS NULL
    JOIN players p ON p.id = gps."playerId" AND p."deletedAt" IS NULL
    JOIN teams t ON t.id = gs."teamId" AND t."deletedAt" IS NULL
    LEFT JOIN programs pr ON pr.id = t."programId" AND pr."deletedAt" IS NULL
    WHERE gps."deletedAt" IS NULL
      AND gps."finalPerformanceScore" IS NOT NULL
      AND (
        UPPER(l.name) LIKE '%STALLION%'
        OR UPPER(l.name) LIKE '%PYBC%'
        OR UPPER(l.name) LIKE '%PHILIPPINE YOUTH BASKETBALL%'
      )
  `;
}

async function main() {
  const rows = await loadGpsRows();

  const pybcRows = rows.filter((row) => row.family === "PYBC");
  const stallionRows = rows.filter((row) => row.family === "Stallion");

  const pybcPlayerAvgs = buildPlayerAverages(rows, "PYBC");
  const stallionPlayerAvgs = buildPlayerAverages(rows, "Stallion");

  const pybcAvgPopulation = pybcPlayerAvgs.map((row) => row.avgGps);
  const stallionAvgPopulation = stallionPlayerAvgs.map((row) => row.avgGps);

  const pybcByPlayer = new Map(pybcPlayerAvgs.map((row) => [row.playerId, row]));
  const stallionByPlayer = new Map(stallionPlayerAvgs.map((row) => [row.playerId, row]));

  const overlapPlayerIds = [...pybcByPlayer.keys()].filter((playerId) => stallionByPlayer.has(playerId));

  const overlapPlayers: OverlapPlayer[] = overlapPlayerIds.map((playerId) => {
    const pybc = pybcByPlayer.get(playerId)!;
    const stallion = stallionByPlayer.get(playerId)!;
    const pybcPercentile = percentileRank(pybc.avgGps, pybcAvgPopulation);
    const stallionPercentile = percentileRank(stallion.avgGps, stallionAvgPopulation);

    return {
      playerId,
      displayName: pybc.displayName,
      pybc: {
        games: pybc.games,
        avgGps: round2(pybc.avgGps),
        scores: pybcRows.filter((row) => row.player_id === playerId).map((row) => round2(row.final_score))
      },
      stallion: {
        games: stallion.games,
        avgGps: round2(stallion.avgGps),
        scores: stallionRows.filter((row) => row.player_id === playerId).map((row) => round2(row.final_score))
      },
      gpsDelta: round2(pybc.avgGps - stallion.avgGps),
      pybcPercentile,
      stallionPercentile,
      percentileDelta: round2(pybcPercentile - stallionPercentile),
      pybcAgeGroups: pybc.ageGroups,
      stallionAgeGroups: stallion.ageGroups
    };
  });

  overlapPlayers.sort((a, b) => Math.abs(b.gpsDelta) - Math.abs(a.gpsDelta));

  const deltas = overlapPlayers.map((row) => row.gpsDelta);
  const meanPybcOverlap = mean(overlapPlayers.map((row) => row.pybc.avgGps));
  const meanStallionOverlap = mean(overlapPlayers.map((row) => row.stallion.avgGps));
  const overlapWithMinGamesEach = overlapPlayers.filter((row) => row.pybc.games >= 3 && row.stallion.games >= 3).length;

  const variance =
    deltas.length > 1
      ? deltas.reduce((sum, value) => sum + (value - mean(deltas)) ** 2, 0) / (deltas.length - 1)
      : 0;

  const aggregates = {
    meanPybcAvgGps: round2(meanPybcOverlap),
    meanStallionAvgGps: round2(meanStallionOverlap),
    meanGpsDelta: round2(mean(deltas)),
    medianGpsDelta: round2(median(deltas)),
    stdDevGpsDelta: round2(Math.sqrt(variance)),
    pybcHigherCount: overlapPlayers.filter((row) => row.gpsDelta > 0.01).length,
    stallionHigherCount: overlapPlayers.filter((row) => row.gpsDelta < -0.01).length,
    tiedCount: overlapPlayers.filter((row) => Math.abs(row.gpsDelta) <= 0.01).length,
    deltaHistogram: histogram(deltas, 5),
    topPositiveOutliers: [...overlapPlayers].sort((a, b) => b.gpsDelta - a.gpsDelta).slice(0, 10),
    topNegativeOutliers: [...overlapPlayers].sort((a, b) => a.gpsDelta - b.gpsDelta).slice(0, 10)
  };

  // Program overlap: programs with GPS in both families
  const programStats = new Map<
    string,
    {
      programId: string;
      programName: string;
      pybcScores: number[];
      stallionScores: number[];
      pybcGames: number;
      stallionGames: number;
    }
  >();

  for (const row of rows) {
    if (!row.program_id || !row.program_name) continue;
    const bucket = programStats.get(row.program_id) ?? {
      programId: row.program_id,
      programName: row.program_name,
      pybcScores: [],
      stallionScores: [],
      pybcGames: 0,
      stallionGames: 0
    };
    if (row.family === "PYBC") {
      bucket.pybcScores.push(row.final_score);
      bucket.pybcGames += 1;
    } else {
      bucket.stallionScores.push(row.final_score);
      bucket.stallionGames += 1;
    }
    programStats.set(row.program_id, bucket);
  }

  const programOverlap = [...programStats.values()]
    .filter((row) => row.pybcGames > 0 && row.stallionGames > 0)
    .map((row) => {
      const pybcTeamAvgGps = round2(mean(row.pybcScores));
      const stallionTeamAvgGps = round2(mean(row.stallionScores));
      return {
        programId: row.programId,
        programName: row.programName,
        pybcGames: row.pybcGames,
        stallionGames: row.stallionGames,
        pybcTeamAvgGps,
        stallionTeamAvgGps,
        teamGpsDelta: round2(pybcTeamAvgGps - stallionTeamAvgGps)
      };
    })
    .sort((a, b) => b.pybcGames + b.stallionGames - (a.pybcGames + a.stallionGames));

  const leagueSummary = (family: CompetitionFamily) => {
    const familyRows = rows.filter((row) => row.family === family);
    const leagues = new Map<string, { leagueName: string; ageGroup: string; games: Set<string>; gps: number; players: Set<string> }>();
    for (const row of familyRows) {
      const bucket =
        leagues.get(row.league_id) ??
        ({
          leagueName: row.league_name,
          ageGroup: row.age_group,
          games: new Set<string>(),
          gps: 0,
          players: new Set<string>()
        } as {
          leagueName: string;
          ageGroup: string;
          games: Set<string>;
          gps: number;
          players: Set<string>;
        });
      bucket.gps += 1;
      bucket.players.add(row.player_id);
      leagues.set(row.league_id, bucket);
    }

    const playerAvgs = buildPlayerAverages(familyRows as GpsRow[], family);
    return {
      leagueCount: leagues.size,
      gameCount: family === "PYBC" ? new Set(pybcRows.map((r) => `${r.league_id}`)).size : undefined,
      gpsCount: familyRows.length,
      playerCount: new Set(familyRows.map((row) => row.player_id)).size,
      meanPlayerAvgGps: round2(mean(playerAvgs.map((row) => row.avgGps))),
      leagues: [...leagues.entries()].map(([leagueId, bucket]) => ({
        leagueId,
        leagueName: bucket.leagueName,
        ageGroup: bucket.ageGroup,
        gpsCount: bucket.gps,
        playerCount: bucket.players.size
      }))
    };
  };

  const pybcSummary = leagueSummary("PYBC");
  const stallionSummary = leagueSummary("Stallion");

  // Count game-level uniqueness
  const gameCounts = await prisma.$queryRaw<Array<{ family: string; game_count: number }>>`
    SELECT
      CASE WHEN UPPER(l.name) LIKE '%STALLION%' THEN 'Stallion' ELSE 'PYBC' END AS family,
      COUNT(DISTINCT g.id)::int AS game_count
    FROM games g
    JOIN seasons s ON s.id = g."seasonId" AND s."deletedAt" IS NULL
    JOIN leagues l ON l.id = s."leagueId" AND l."deletedAt" IS NULL
    WHERE g."deletedAt" IS NULL
      AND (
        UPPER(l.name) LIKE '%STALLION%'
        OR UPPER(l.name) LIKE '%PYBC%'
        OR UPPER(l.name) LIKE '%PHILIPPINE YOUTH BASKETBALL%'
      )
    GROUP BY 1
  `;
  const gameCountMap = new Map(gameCounts.map((row) => [row.family, row.game_count]));
  pybcSummary.gameCount = gameCountMap.get("PYBC") ?? 0;
  stallionSummary.gameCount = gameCountMap.get("Stallion") ?? 0;

  const teamNameOverlap = buildTeamNameOverlap(rows);

  const populationStats = {
    PYBC: {
      gameLevel: distributionStats(pybcRows.map((row) => row.final_score)),
      playerAvgLevel: distributionStats(pybcPlayerAvgs.map((row) => row.avgGps))
    },
    Stallion: {
      gameLevel: distributionStats(stallionRows.map((row) => row.final_score)),
      playerAvgLevel: distributionStats(stallionPlayerAvgs.map((row) => row.avgGps))
    }
  };

  const gpsWithProgram = rows.filter((row) => row.program_id).length;
  const linkageStats = {
    totalGpsRows: rows.length,
    gpsWithProgramId: gpsWithProgram,
    gpsWithProgramPct: round2((gpsWithProgram / Math.max(rows.length, 1)) * 100),
    uniqueTeamsPybc: new Set(pybcRows.map((row) => row.team_id)).size,
    uniqueTeamsStallion: new Set(stallionRows.map((row) => row.team_id)).size,
    teamsWithProgramIdPybc: new Set(pybcRows.filter((row) => row.program_id).map((row) => row.team_id)).size,
    teamsWithProgramIdStallion: new Set(stallionRows.filter((row) => row.program_id).map((row) => row.team_id)).size
  };

  const sameAgeOverlapCount = overlapPlayers.filter((row) =>
    row.pybcAgeGroups.some((age) => row.stallionAgeGroups.includes(age))
  ).length;

  const recommendation = chooseRecommendation({
    overlapCount: overlapPlayers.length,
    overlapWithMinGames: overlapWithMinGamesEach,
    medianDelta: aggregates.medianGpsDelta,
    meanDelta: aggregates.meanGpsDelta,
    pybcMeanAvg: pybcSummary.meanPlayerAvgGps,
    stallionMeanAvg: stallionSummary.meanPlayerAvgGps,
    sameAgeOverlapCount,
    programOverlapCount: programOverlap.length
  });

  const governanceImpact =
    recommendation.tierEvidence === "Supports PYBC Tier 2"
      ? "Aligning PYBC with Stallion at Tier 2 (Elite National Circuit) would apply the same 1.25× weight under the approved governance framework. Minimal relative distortion vs Stallion for players/programs active in both. Supports moving PYBC from current DB Tier 3 to Tier 2 per rubric."
      : recommendation.tierEvidence === "Supports PYBC Tier 3"
        ? "Placing PYBC at Tier 3 (1.10×) below Stallion Tier 2 (1.25×) would modestly discount PYBC-heavy player profiles vs Stallion-heavy profiles in future weight activation. Expect rank shifts for players with unequal competition mix."
        : "Provisional Tier 2 assignment stands from governance rubric only — not GPS-validated. Do not activate tier weights or finalize PYBC tier until age-aligned cross-competition evidence exists. Current DB Tier 3 for PYBC should not be changed on GPS grounds alone.";

  const report = {
    generatedAt: new Date().toISOString(),
    auditType: "pybc-stallion-competition-quality-read-only",
    methodology: {
      gpsField: "finalPerformanceScore",
      formulaVersion: FORMULA_V1_VERSION_NUMBER,
      playerAverage: "arithmetic mean per competition family",
      percentile: "player average vs all player averages in same family",
      deltaSign: "PYBC avg - Stallion avg (negative => higher in Stallion)",
      ageGroupCaveat: "PYBC active leagues are U13/U16; Stallion active leagues are U19"
    },
    competitionSummary: {
      PYBC: pybcSummary,
      Stallion: stallionSummary
    },
    summary: {
      overlapPlayerCount: overlapPlayers.length,
      overlapWithMinGamesEach,
    sameAgeOverlapCount,
    programOverlapCount: programOverlap.length,
    teamNameOverlapCount: teamNameOverlap.length,
      allPybcMeanPlayerAvgGps: pybcSummary.meanPlayerAvgGps,
      allStallionMeanPlayerAvgGps: stallionSummary.meanPlayerAvgGps,
      competitionLevelGpsGap: round2(pybcSummary.meanPlayerAvgGps - stallionSummary.meanPlayerAvgGps)
    },
    overlapPlayers,
    aggregates,
    populationStats,
    linkageStats,
    programOverlap,
    teamNameOverlap,
    recommendation,
    governanceImpact
  };

  mkdirSync(REPORT_DIR, { recursive: true });
  mkdirSync(join(process.cwd(), "docs", "planning", "audits"), { recursive: true });

  const jsonPath = join(REPORT_DIR, "pybc-stallion-competition-quality-audit.json");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  writeFileSync(DOC_PATH, buildMarkdown(report), "utf8");

  console.log(
    JSON.stringify(
      {
        jsonPath,
        docPath: DOC_PATH,
        overlapPlayers: overlapPlayers.length,
        programOverlap: programOverlap.length,
        teamNameOverlap: teamNameOverlap.length,
        recommendation
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
