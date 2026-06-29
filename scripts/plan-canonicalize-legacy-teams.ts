import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { normalizeCompetitionDisplayName } from "../src/lib/competition-naming";
import { prisma } from "../src/lib/prisma";
import { getClassYear, getCurrentRankingAgeBracket } from "../src/lib/ranking-eligibility";
import { getTeamDisplayName, normalizeProgramAlias } from "../src/lib/uaap-school-display";

const jsonReportPath = join(process.cwd(), "scripts", "reports", "legacy-team-canonicalization-plan.json");
const markdownReportPath = join(process.cwd(), "scripts", "reports", "legacy-team-canonicalization-plan.md");
const now = new Date();

type Recommendation =
  | "AUTO_READY_ROSTER_ONLY"
  | "NEEDS_REVIEW_ROSTER_ONLY"
  | "AUTO_READY_GAME_AND_STATS"
  | "NEEDS_REVIEW_GAME_AND_STATS"
  | "KEEP_HISTORICAL_REFERENCE"
  | "SAFE_TO_DELETE_ZERO_REFERENCES"
  | "BLOCKED_NO_CANONICAL_TARGET"
  | "BLOCKED_AMBIGUOUS_TARGETS";

type LoadedProgram = Awaited<ReturnType<typeof loadPrograms>>[number];
type LoadedTeam = LoadedProgram["teams"][number];
type LoadedRoster = LoadedTeam["rosterSeasons"][number];

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true })
  );
}

function formatDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

function normalizeKey(value: string | null | undefined) {
  return normalizeProgramAlias(getTeamDisplayName(value ?? ""))
    .replace(/\b(U13|13U|U16|16U|U19|19U|BOYS|GIRLS|MEN|WOMEN|MALE|FEMALE)\b/gi, "")
    .replace(/\b(JRS?|JUNIORS?|HS|HIGH SCHOOL|VARSITY)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeGender(...values: Array<string | null | undefined>) {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  if (/\b(girls?|women|female|lady|ladies|tigress|tigresses)\b/.test(text)) return "GIRLS";
  if (/\b(boys?|men|male)\b/.test(text)) return "BOYS";
  return "";
}

function normalizeAgeGroup(...values: Array<string | null | undefined>) {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  if (/\b(u13|13u|13 and below)\b/.test(text)) return "U13";
  if (/\b(u16|16u)\b/.test(text)) return "U16";
  if (/\b(u19|19u)\b/.test(text)) return "U19";
  return "";
}

function hasSpecificContext(team: LoadedTeam) {
  const context = teamContext(team);
  return Boolean(context.gender || context.ageGroups.length || context.leagueNames.length || context.seasonNames.length);
}

function hasSpecificNameContext(value: string) {
  return Boolean(normalizeGender(value) || normalizeAgeGroup(value));
}

function isLegacyName(teamName: string, program: Pick<LoadedProgram, "fullName" | "abbreviation">) {
  const reasons: string[] = [];
  if (/\b(jrs?|juniors?)\b/i.test(teamName)) reasons.push("junior label");
  if (/\b(hs|high school)\b/i.test(teamName)) reasons.push("high-school label");
  if (/\bvarsity\b/i.test(teamName)) reasons.push("varsity label");
  if (normalizeKey(teamName) && normalizeKey(teamName) === normalizeKey(program.fullName)) reasons.push("exact generic Program-name Team");
  if (program.abbreviation && normalizeKey(teamName) === normalizeKey(program.abbreviation)) reasons.push("exact generic Program-abbreviation Team");
  return reasons;
}

function isCanonicalTargetCandidate(team: LoadedTeam, program: Pick<LoadedProgram, "fullName" | "abbreviation">) {
  if (isLegacyName(team.name, program).length) return false;
  return hasSpecificNameContext(team.name) || hasSpecificContext(team);
}

function activeRosterWhere() {
  return {
    deletedAt: null,
    OR: [{ endsOn: null }, { endsOn: { gte: now } }]
  };
}

function gameLabel(game: {
  id: string;
  gameNumber: string | null;
  season: { name: string; league: { name: string; ageGroup: string } };
}) {
  return `${game.gameNumber ?? game.id} | ${normalizeCompetitionDisplayName(game.season.league.name) || game.season.league.name} / ${game.season.name}`;
}

function teamGames(team: LoadedTeam) {
  return Array.from(new Map([...team.homeGames, ...team.awayGames].map((game) => [game.id, game])).values());
}

function teamStatGameIds(team: LoadedTeam) {
  return new Set(team.gameStats.map((stat) => stat.gameId));
}

function teamPlayers(team: LoadedTeam) {
  return new Set([
    ...team.rosterSeasons.map((roster) => roster.playerId),
    ...team.gameStats.map((stat) => stat.playerId)
  ]);
}

function teamContext(team: LoadedTeam) {
  const games = teamGames(team);
  const rosterSeasons = team.rosterSeasons.map((roster) => roster.season);
  const statSeasons = team.gameStats.map((stat) => stat.game.season);
  const seasons = [...games.map((game) => game.season), ...rosterSeasons, ...statSeasons];
  const leagueNames = uniqueSorted(seasons.map((season) => normalizeCompetitionDisplayName(season.league.name) || season.league.name));
  const seasonNames = uniqueSorted(seasons.map((season) => season.name));
  const ageGroups = uniqueSorted([normalizeAgeGroup(team.name), ...seasons.map((season) => season.league.ageGroup)].filter(Boolean));
  const gender = normalizeGender(team.name, ...seasons.map((season) => season.league.name));
  const seasonIds = uniqueSorted(seasons.map((season) => season.id));
  return { gender, ageGroups, leagueNames, seasonNames, seasonIds };
}

function referenceCounts(team: LoadedTeam) {
  const games = teamGames(team);
  return {
    playerTeamSeason: team.rosterSeasons.length,
    gameStat: team.gameStats.length,
    gameHomeAway: games.length,
    submissionsImports: "no direct Team relation found in Submission model"
  };
}

function hasAnyReference(team: LoadedTeam) {
  const counts = referenceCounts(team);
  return counts.playerTeamSeason > 0 || counts.gameStat > 0 || counts.gameHomeAway > 0;
}

function inferRosterAgeGroup(roster: LoadedRoster) {
  if (roster.player.ageGroupOverride) return roster.player.ageGroupOverride;
  const current = getCurrentRankingAgeBracket(roster.player.birthDate, now, roster.player.classYearOverride);
  if (current && current !== "OUT_OF_RANGE") return current;
  return roster.season.league.ageGroup || "";
}

function candidateEvidence(legacyTeam: LoadedTeam, candidate: LoadedTeam) {
  const legacyContext = teamContext(legacyTeam);
  const candidateContext = teamContext(candidate);
  const legacyPlayers = teamPlayers(legacyTeam);
  const candidatePlayers = teamPlayers(candidate);
  const playerOverlap = Array.from(legacyPlayers).filter((playerId) => candidatePlayers.has(playerId));
  const sameSeasonIds = legacyContext.seasonIds.filter((seasonId) => candidateContext.seasonIds.includes(seasonId));
  const sameLeagueNames = legacyContext.leagueNames.filter((leagueName) => candidateContext.leagueNames.includes(leagueName));
  const sameAgeGroups = legacyContext.ageGroups.filter((ageGroup) => candidateContext.ageGroups.includes(ageGroup));
  const sameGender =
    legacyContext.gender && candidateContext.gender && legacyContext.gender === candidateContext.gender ? legacyContext.gender : "";
  const crossGender =
    legacyContext.gender && candidateContext.gender && legacyContext.gender !== candidateContext.gender
      ? `${legacyContext.gender} vs ${candidateContext.gender}`
      : "";
  const crossAge =
    legacyContext.ageGroups.length && candidateContext.ageGroups.length && !sameAgeGroups.length
      ? `${legacyContext.ageGroups.join("/")} vs ${candidateContext.ageGroups.join("/")}`
      : "";

  const score =
    sameSeasonIds.length * 4 +
    sameLeagueNames.length * 3 +
    sameAgeGroups.length * 3 +
    (sameGender ? 3 : 0) +
    Math.min(playerOverlap.length, 5) * 2 +
    (normalizeKey(legacyTeam.name) === normalizeKey(candidate.name) ? 2 : 0) -
    (crossGender ? 100 : 0) -
    (crossAge ? 25 : 0);

  return {
    candidateTeamId: candidate.id,
    candidateTeamName: candidate.name,
    candidateDisplayName: getTeamDisplayName(candidate.name),
    candidateKey: normalizeKey(candidate.name),
    score,
    sameSeasonIds,
    sameLeagueNames,
    sameAgeGroups,
    sameGender: sameGender || null,
    crossGender: crossGender || null,
    crossAge: crossAge || null,
    playerOverlapCount: playerOverlap.length,
    playerOverlapIds: playerOverlap.slice(0, 20),
    candidateReferenceCounts: referenceCounts(candidate),
    candidateContext
  };
}

function pickRecommendation(legacyTeam: LoadedTeam, candidates: ReturnType<typeof candidateEvidence>[]): {
  recommendation: Recommendation;
  recommendedTarget: ReturnType<typeof candidateEvidence> | null;
  rationale: string;
} {
  const counts = referenceCounts(legacyTeam);
  const hasRoster = counts.playerTeamSeason > 0;
  const hasGameRefs = counts.gameHomeAway > 0 || counts.gameStat > 0;

  if (!hasRoster && !hasGameRefs) {
    return {
      recommendation: "SAFE_TO_DELETE_ZERO_REFERENCES",
      recommendedTarget: null,
      rationale: "Legacy/generic Team has no active roster, Game, or GameStat references."
    };
  }

  const viable = candidates.filter((candidate) => candidate.score > 0 && !candidate.crossGender);
  if (!viable.length) {
    return {
      recommendation: "BLOCKED_NO_CANONICAL_TARGET",
      recommendedTarget: null,
      rationale: "No same-Program canonical Team has enough same-season, same-age, same-gender, league, or player-overlap evidence."
    };
  }

  const sorted = [...viable].sort((left, right) => right.score - left.score);
  const top = sorted[0];
  const tied = sorted.filter((candidate) => candidate.score === top.score);
  if (tied.length > 1) {
    return {
      recommendation: "BLOCKED_AMBIGUOUS_TARGETS",
      recommendedTarget: null,
      rationale: `Multiple candidate Teams tie at evidence score ${top.score}.`
    };
  }

  const exactContext = Boolean(top.sameSeasonIds.length && top.sameGender && top.sameAgeGroups.length);
  const strongGameContext = exactContext && top.sameLeagueNames.length > 0;

  if (hasGameRefs) {
    if (strongGameContext && top.playerOverlapCount > 0 && top.score >= 12) {
      return {
        recommendation: "AUTO_READY_GAME_AND_STATS",
        recommendedTarget: top,
        rationale: "Game/GameStat references have one canonical target with same season, league, age group, gender, and player-overlap evidence."
      };
    }

    const legacyContext = teamContext(legacyTeam);
    if (!top.sameSeasonIds.length || top.crossAge || top.playerOverlapCount === 0) {
      return {
        recommendation: "KEEP_HISTORICAL_REFERENCE",
        recommendedTarget: top,
        rationale: `Historical game/stat references may represent distinct team context (${legacyContext.leagueNames.join(", ") || "unknown league"}). Keep unless separately approved.`
      };
    }

    return {
      recommendation: "NEEDS_REVIEW_GAME_AND_STATS",
      recommendedTarget: top,
      rationale: "Game/GameStat references have a possible target, but evidence is not strong enough for automatic historical stat reassignment."
    };
  }

  if (hasRoster) {
    const rosterRows = legacyTeam.rosterSeasons.map((roster) => ({
      playerId: roster.playerId,
      playerName: roster.player.displayName,
      playerGender: roster.player.gender,
      inferredAgeGroup: inferRosterAgeGroup(roster),
      seasonId: roster.seasonId,
      seasonName: roster.season.name,
      leagueName: normalizeCompetitionDisplayName(roster.season.league.name) || roster.season.league.name
    }));
    const rosterAgeGroups = uniqueSorted(rosterRows.map((row) => row.inferredAgeGroup));
    const mixedRosterAges = rosterAgeGroups.length > 1;
    if (exactContext && !mixedRosterAges && top.score >= 10) {
      return {
        recommendation: "AUTO_READY_ROSTER_ONLY",
        recommendedTarget: top,
        rationale: "Roster-only references have one same-season, same-age, same-gender target and no historical Game/GameStat references."
      };
    }
    return {
      recommendation: "NEEDS_REVIEW_ROSTER_ONLY",
      recommendedTarget: top,
      rationale: mixedRosterAges
        ? `Roster-only references have mixed inferred age groups (${rosterAgeGroups.join(", ")}), so admin review is required.`
        : "Roster-only references have a possible canonical target, but context is incomplete or not exact."
    };
  }

  return {
    recommendation: "BLOCKED_NO_CANONICAL_TARGET",
    recommendedTarget: null,
    rationale: "No supported cleanup path was identified."
  };
}

function rosterDetails(team: LoadedTeam) {
  return team.rosterSeasons.map((roster) => ({
    playerTeamSeasonId: roster.id,
    playerId: roster.playerId,
    playerName: roster.player.displayName,
    playerGender: roster.player.gender,
    birthDate: formatDate(roster.player.birthDate),
    classYear: roster.player.classYearOverride ?? getClassYear(roster.player.birthDate),
    ageGroupOverride: roster.player.ageGroupOverride,
    inferredAgeGroup: inferRosterAgeGroup(roster) || "UNKNOWN",
    seasonId: roster.seasonId,
    seasonName: roster.season.name,
    leagueName: normalizeCompetitionDisplayName(roster.season.league.name) || roster.season.league.name
  }));
}

async function loadPrograms() {
  return prisma.program.findMany({
    where: { deletedAt: null },
    include: {
      teams: {
        where: { deletedAt: null },
        include: {
          homeGames: {
            where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } },
            select: { id: true, gameNumber: true, seasonId: true, season: { include: { league: true } } }
          },
          awayGames: {
            where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } },
            select: { id: true, gameNumber: true, seasonId: true, season: { include: { league: true } } }
          },
          gameStats: {
            where: { deletedAt: null, game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } },
            select: {
              id: true,
              gameId: true,
              playerId: true,
              player: { select: { id: true, displayName: true } },
              game: { select: { id: true, gameNumber: true, seasonId: true, season: { include: { league: true } } } }
            }
          },
          rosterSeasons: {
            where: activeRosterWhere(),
            include: {
              player: {
                select: {
                  id: true,
                  displayName: true,
                  gender: true,
                  birthDate: true,
                  classYearOverride: true,
                  ageGroupOverride: true
                }
              },
              season: { include: { league: true } }
            },
            orderBy: { createdAt: "asc" }
          }
        },
        orderBy: { name: "asc" }
      }
    },
    orderBy: { fullName: "asc" }
  });
}

function buildMarkdown(report: {
  generatedAt: string;
  summary: Record<string, number>;
  candidates: Array<{
    programName: string;
    legacyTeamName: string;
    recommendation: Recommendation;
    rationale: string;
    referenceCounts: ReturnType<typeof referenceCounts>;
    recommendedTarget: ReturnType<typeof candidateEvidence> | null;
    legacyGameRefs: string[];
  }>;
  cleanupPath: string[];
}) {
  const lines = [
    "# Legacy Team Canonicalization Plan",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Mode: dry-run / read-only. No data was changed.",
    "",
    "## Summary",
    "",
    ...Object.entries(report.summary).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Cleanup Path",
    "",
    ...report.cleanupPath.map((step) => `- ${step}`),
    "",
    "## Candidates",
    ""
  ];

  for (const candidate of report.candidates) {
    lines.push(`### ${candidate.programName} / ${candidate.legacyTeamName}`);
    lines.push("");
    lines.push(`- Recommendation: ${candidate.recommendation}`);
    lines.push(`- Rationale: ${candidate.rationale}`);
    lines.push(`- References: roster ${candidate.referenceCounts.playerTeamSeason}, GameStats ${candidate.referenceCounts.gameStat}, game home/away ${candidate.referenceCounts.gameHomeAway}`);
    lines.push(`- Recommended target: ${candidate.recommendedTarget ? `${candidate.recommendedTarget.candidateTeamName} (${candidate.recommendedTarget.candidateTeamId})` : "None"}`);
    if (candidate.legacyGameRefs.length) lines.push(`- Game refs: ${candidate.legacyGameRefs.join(", ")}`);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const programs = await loadPrograms();
  const candidates = [];

  for (const program of programs) {
    const specificTeams = program.teams.filter((team) => hasSpecificNameContext(team.name) || hasSpecificContext(team));
    const nonEmptySpecificCandidates = program.teams.filter((team) => {
      return team.deletedAt === null && isCanonicalTargetCandidate(team, program);
    });

    for (const team of program.teams) {
      const legacyReasons = isLegacyName(team.name, program);
      if (!legacyReasons.length) continue;

      const counts = referenceCounts(team);
      const canonicalCandidates = nonEmptySpecificCandidates
        .filter((candidate) => candidate.id !== team.id)
        .map((candidate) => candidateEvidence(team, candidate))
        .sort((left, right) => right.score - left.score);
      const picked = pickRecommendation(team, canonicalCandidates);
      const games = teamGames(team);

      candidates.push({
        programId: program.id,
        programName: program.fullName,
        legacyTeamId: team.id,
        legacyTeamName: team.name,
        legacyDisplayName: getTeamDisplayName(team.name),
        legacyKey: normalizeKey(team.name),
        legacyReasons,
        referenceCounts: counts,
        rosterRows: rosterDetails(team),
        legacyGameRefs: uniqueSorted(games.map((game) => game.gameNumber ?? game.id)),
        legacyGameLabels: games.map(gameLabel).sort(),
        legacyGameStatGameRefs: uniqueSorted(team.gameStats.map((stat) => stat.game.gameNumber ?? stat.game.id)),
        legacyPlayerIds: Array.from(teamPlayers(team)).sort(),
        legacyContext: teamContext(team),
        candidateCanonicalTeams: canonicalCandidates,
        recommendedTarget: picked.recommendedTarget,
        recommendation: picked.recommendation,
        rationale: picked.rationale,
        cleanupPath: [
          "Step A: reassign safe PlayerTeamSeason rows only after explicit admin approval.",
          "Step B: reassign Game.homeTeamId / Game.awayTeamId / GameStat.teamId only when same-team historical evidence is approved.",
          "Step C: after zero references remain, retire/delete/archive the legacy Team through a separate explicit action.",
          "Step D: rerun Program Management and canonicalization audits."
        ]
      });
    }
  }

  const summary = candidates.reduce<Record<Recommendation | "totalLegacyTeams", number>>((acc, candidate) => {
    acc.totalLegacyTeams += 1;
    acc[candidate.recommendation] += 1;
    return acc;
  }, {
    totalLegacyTeams: 0,
    AUTO_READY_ROSTER_ONLY: 0,
    NEEDS_REVIEW_ROSTER_ONLY: 0,
    AUTO_READY_GAME_AND_STATS: 0,
    NEEDS_REVIEW_GAME_AND_STATS: 0,
    KEEP_HISTORICAL_REFERENCE: 0,
    SAFE_TO_DELETE_ZERO_REFERENCES: 0,
    BLOCKED_NO_CANONICAL_TARGET: 0,
    BLOCKED_AMBIGUOUS_TARGETS: 0
  });

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "dry-run-read-only",
    guardrails: [
      "No database writes.",
      "No deletes.",
      "No merges.",
      "No schema changes.",
      "No imports or publishes.",
      "No rating/ranking recompute.",
      "No GameStat/Game rewrites.",
      "Any future execute path must require explicit approval and exact Team IDs/counts."
    ],
    summary,
    cleanupPath: [
      "Step A: reassign safe PlayerTeamSeason rows.",
      "Step B: reassign safe Game/GameStat refs only when approved.",
      "Step C: after zero references remain, retire/delete/archive legacy Team.",
      "Step D: rerun Program Management audit."
    ],
    candidates
  };

  mkdirSync(dirname(jsonReportPath), { recursive: true });
  writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(markdownReportPath, buildMarkdown(report));

  const ustCandidates = candidates.filter((candidate) => candidate.programName.includes("Santo Tomas") || /\bUST\b/i.test(candidate.legacyTeamName));
  const examples = {
    AUTO_READY: candidates.find((candidate) => candidate.recommendation.startsWith("AUTO_READY")) ?? null,
    NEEDS_REVIEW: candidates.find((candidate) => candidate.recommendation.startsWith("NEEDS_REVIEW")) ?? null,
    KEEP_HISTORICAL_REFERENCE: candidates.find((candidate) => candidate.recommendation === "KEEP_HISTORICAL_REFERENCE") ?? null
  };

  console.log(JSON.stringify({
    jsonReportPath,
    markdownReportPath,
    summary,
    ustCandidates: ustCandidates.map((candidate) => ({
      programName: candidate.programName,
      legacyTeamId: candidate.legacyTeamId,
      legacyTeamName: candidate.legacyTeamName,
      referenceCounts: candidate.referenceCounts,
      recommendation: candidate.recommendation,
      recommendedTarget: candidate.recommendedTarget
        ? {
            teamId: candidate.recommendedTarget.candidateTeamId,
            teamName: candidate.recommendedTarget.candidateTeamName,
            score: candidate.recommendedTarget.score
          }
        : null,
      rationale: candidate.rationale
    })),
    examples
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
