/**
 * Competition Import Execution Queue — read-only analysis.
 * Usage: npx tsx scripts/generate-competition-import-queue.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup, PlayerGender, SubmissionStatus } from "@prisma/client";
import {
  buildEligibilityInput,
  evaluateEligibility,
  resolveLaunchThreshold,
  type EligibilityBoard
} from "../src/lib/eligibility";
import { prisma } from "../src/lib/prisma";
import { safeParseSubmissionJson } from "../src/lib/submission-json";

const OUT_DIR = join(process.cwd(), "docs", "planning", "audits");
const PHASE_D_PATH = join(process.cwd(), "scripts", "reports", "phase-d-competition-coverage-audit-report.json");

type CoverageRow = {
  competitionKey: string;
  leagueName: string;
  seasonName: string;
  ageGroup: string;
  dbGames: number;
  submissionGames: number;
  submissionDbGameDelta: number | null;
  missingStages: string[];
  coverageStatus: string;
  stagesInSubmissions: string[];
};

type FamilyAggregate = {
  family: string;
  submissionDbGameDelta: number;
  submissionGames: number;
  db: { games: number; gameStats: number };
  missingStages: string[];
  coverageStatus: string;
  titles?: string[];
};

type StageKind = "eliminations" | "playoffs" | "finals" | "batch" | "regular" | "unknown";
type Effort = "low" | "medium" | "high";
type QueueTier = "IMPORT_NOW" | "IMPORT_NEXT" | "IMPORT_LATER";

type NearPlayer = {
  playerId: string;
  name: string;
  program: string;
  games: number;
  gamesShort: number;
  board: string;
  ageGroup: EligibilityBoard;
  gender: PlayerGender;
  hasDob: boolean;
  wouldRankWithImport: boolean;
};

type QueueItem = {
  tier: QueueTier;
  competition: string;
  season: string;
  ageGroup: string;
  gender: string;
  missingRoundsPhases: string[];
  affectedPlayers: number;
  affectedPlayerNames: string[];
  projectedNewRanked: number;
  projectedP7Reduction: number;
  projectedP12Shift: number;
  missingGames: number;
  effort: Effort;
  roiScore: number;
  sourceType: "pending_submission" | "missing_stage" | "game_gap" | "partial_coverage";
  submissionId?: string;
  submissionStatus?: string;
};

function normalizeName(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function inferGender(text: string): "Boys" | "Girls" | "Mixed" {
  const lower = text.toLowerCase();
  if (lower.includes("girls") && !lower.includes("boys")) return "Girls";
  if (lower.includes("boys") && !lower.includes("girls")) return "Boys";
  if (lower.includes("girls")) return "Mixed";
  return "Boys";
}

function inferStage(title: string): StageKind {
  const lower = title.toLowerCase();
  if (lower.includes("elimination")) return "eliminations";
  if (lower.includes("playoff")) return "playoffs";
  if (lower.includes("final")) return "finals";
  if (/\d+\s*-\s*\d+/.test(title) || lower.includes("batch")) return "batch";
  if (lower.includes("regular")) return "regular";
  return "unknown";
}

function parseSubmission(input: { rawText: string | null; parsedPreview: unknown }) {
  const parsed = safeParseSubmissionJson(input);
  if (!parsed.ok) {
    return {
      ok: false as const,
      games: 0,
      playerNames: [] as string[],
      leagueName: "",
      seasonName: "",
      gameNumbers: [] as string[]
    };
  }

  const root = parsed.data;
  const packages = Array.isArray(root) ? root : [root];
  const playerNames = new Set<string>();
  const gameNumbers: string[] = [];
  let leagueName = "";
  let seasonName = "";
  let games = 0;

  for (const pkg of packages) {
    if (!pkg || typeof pkg !== "object") continue;
    const record = pkg as Record<string, unknown>;
    const league = record.league as Record<string, unknown> | undefined;
    const season = record.season as Record<string, unknown> | undefined;
    leagueName = leagueName || String(league?.name ?? "").trim();
    seasonName = seasonName || String(season?.name ?? "").trim();

    const gamesArr = Array.isArray(record.games) ? record.games : [];
    for (const game of gamesArr) {
      if (!game || typeof game !== "object") continue;
      games += 1;
      const g = game as Record<string, unknown>;
      const gn = String(g.gameNumber ?? "").trim();
      if (gn) gameNumbers.push(gn);
      const players = Array.isArray(g.players) ? g.players : [];
      for (const row of players) {
        if (!row || typeof row !== "object") continue;
        const r = row as Record<string, unknown>;
        const name = String(r.name ?? r.playerName ?? "").trim();
        if (name) playerNames.add(name);
      }
    }
  }

  return {
    ok: true as const,
    games,
    playerNames: [...playerNames],
    leagueName,
    seasonName,
    gameNumbers
  };
}

async function loadNearThresholdPlayers(formulaVersionId: string | null): Promise<NearPlayer[]> {
  const ageGroups: AgeGroup[] = [AgeGroup.U19, AgeGroup.U16, AgeGroup.U13];
  const rows: NearPlayer[] = [];

  for (const ageGroup of ageGroups) {
    const ratings = await prisma.playerRating.findMany({
      where: { ageGroup, player: { deletedAt: null } },
      include: {
        player: {
          select: {
            id: true,
            displayName: true,
            gender: true,
            birthDate: true,
            classYearOverride: true,
            ageGroupOverride: true,
            currentProgram: { select: { fullName: true } },
            rosterSeasons: {
              where: { deletedAt: null },
              take: 1,
              orderBy: { createdAt: "desc" },
              include: { team: { select: { program: { select: { fullName: true } } } } }
            }
          }
        }
      }
    });

    for (const rating of ratings) {
      const threshold = resolveLaunchThreshold(rating.player.gender);
      const gamesShort = threshold - rating.verifiedGameCount;
      if (gamesShort < 1 || gamesShort > 4) continue;

      const verdict = evaluateEligibility(
        buildEligibilityInput({
          playerId: rating.playerId,
          gender: rating.player.gender,
          birthDate: rating.player.birthDate,
          classYearOverride: rating.player.classYearOverride,
          ageGroupOverride: rating.player.ageGroupOverride,
          ratingAgeGroup: ageGroup as EligibilityBoard,
          verifiedGameCount: rating.verifiedGameCount,
          evaluatedBoard: ageGroup as EligibilityBoard,
          formulaVersionId
        })
      );

      if (verdict.provisionalReason !== "BELOW_THRESHOLD") continue;

      const genderLabel = rating.player.gender === PlayerGender.GIRLS ? "Girls" : "Boys";
      const hasDob = Boolean(rating.player.birthDate);
      const program =
        rating.player.currentProgram?.fullName ??
        rating.player.rosterSeasons[0]?.team.program?.fullName ??
        "Unassigned";

      rows.push({
        playerId: rating.playerId,
        name: rating.player.displayName,
        program,
        games: rating.verifiedGameCount,
        gamesShort,
        board: `${ageGroup} ${genderLabel}`,
        ageGroup: ageGroup as EligibilityBoard,
        gender: rating.player.gender,
        hasDob,
        wouldRankWithImport: hasDob
      });
    }
  }

  return rows;
}

function effortFor(input: {
  missingGames: number;
  status?: string;
  missingStages: string[];
  hasLineage: boolean;
}): Effort {
  if (input.status === SubmissionStatus.APPROVED && input.missingGames <= 15) return "low";
  if (input.missingGames <= 10 && input.hasLineage) return "low";
  if (input.missingStages.length > 0 || input.missingGames > 30) return "high";
  return "medium";
}

function assignTier(item: Omit<QueueItem, "tier">): QueueTier {
  const hasMissingRound = item.missingRoundsPhases.some(
    (p) => p.includes("playoffs") || p.includes("eliminations") || p.includes("batch")
  );
  if (item.projectedNewRanked >= 1 && item.effort !== "high") return "IMPORT_NOW";
  if (hasMissingRound && item.affectedPlayers >= 8 && item.effort === "low") return "IMPORT_NOW";
  if (item.missingGames >= 5 && item.affectedPlayers >= 20 && item.effort !== "high") return "IMPORT_NOW";
  if (item.projectedNewRanked >= 1 || item.projectedP7Reduction >= 10) return "IMPORT_NEXT";
  if (item.affectedPlayers >= 8 && item.projectedP7Reduction >= 5) return "IMPORT_NEXT";
  return "IMPORT_LATER";
}

function renderMarkdown(payload: Record<string, unknown>) {
  const executive = payload.executiveSummary as Record<string, unknown>;
  const queue = payload.importQueue as { IMPORT_NOW: QueueItem[]; IMPORT_NEXT: QueueItem[]; IMPORT_LATER: QueueItem[] };
  const growth = payload.expectedBoardGrowth as Record<string, number>;
  const order = payload.recommendedExecutionOrder as string[];

  const section = (title: string, items: QueueItem[]) => {
    const lines = [`### ${title} (${items.length})`, ""];
    if (!items.length) {
      lines.push("_None._", "");
      return lines;
    }
    for (const item of items) {
      lines.push(
        `#### ${item.competition}`,
        `- **Season:** ${item.season}`,
        `- **Age group / gender:** ${item.ageGroup} · ${item.gender}`,
        `- **Missing rounds/phases:** ${item.missingRoundsPhases.join(", ") || "—"}`,
        `- **Affected players:** ${item.affectedPlayers}`,
        `- **Projected new RANKED:** ${item.projectedNewRanked}`,
        `- **Projected P7 reduction:** ${item.projectedP7Reduction}`,
        `- **Effort:** ${item.effort}`,
        ""
      );
    }
    return lines;
  };

  return [
    "# Competition Import Execution Queue",
    "",
    `**Generated:** ${payload.generatedAt}`,
    "",
    "## 1. Executive Summary",
    "",
    `- Near-threshold players (1–4 games short): **${executive.nearThresholdTotal}**`,
    `- With DOB (import → RANKED eligible): **${executive.dobReadyNearThreshold}**`,
    `- Without DOB (import → P12 shift only): **${executive.noDobNearThreshold}**`,
    `- Competitions with partial/missing coverage: **${executive.partialCompetitions}**`,
    `- Pending submission batches: **${executive.pendingBatches}**`,
    `- **IMPORT NOW** items: ${queue.IMPORT_NOW.length} · projected **+${growth.importNowRanked}** RANKED`,
    `- **IMPORT NEXT** items: ${queue.IMPORT_NEXT.length} · projected **+${growth.importNextRanked}** RANKED`,
    "",
    "## 2. Import Queue",
    "",
    ...section("A. IMPORT NOW", queue.IMPORT_NOW),
    ...section("B. IMPORT NEXT", queue.IMPORT_NEXT),
    ...section("C. IMPORT LATER", queue.IMPORT_LATER),
    "## 3. Expected Board Growth",
    "",
    `| Tier | Projected RANKED | Projected P7 reduction |`,
    `|---|---:|---:|`,
    `| IMPORT NOW | +${growth.importNowRanked} | −${growth.importNowP7} |`,
    `| IMPORT NEXT | +${growth.importNextRanked} | −${growth.importNextP7} |`,
    `| IMPORT LATER | +${growth.importLaterRanked} | −${growth.importLaterP7} |`,
    `| **Total (if all executed)** | **+${growth.totalRanked}** | **−${growth.totalP7}** |`,
    "",
    "**By board (IMPORT NOW + NEXT):**",
    `- U19 Boys: +${growth.byBoard?.u19Boys ?? 0}`,
    `- U19 Girls: +${growth.byBoard?.u19Girls ?? 0}`,
    `- U16 Boys: +${growth.byBoard?.u16Boys ?? 0}`,
    `- U16 Girls: +${growth.byBoard?.u16Girls ?? 0}`,
    `- U13 Boys: +${growth.byBoard?.u13Boys ?? 0}`,
    "",
    "## 4. Recommended Execution Order",
    "",
    ...order.map((line, i) => `${i + 1}. ${line}`)
  ].join("\n");
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: 1 },
    select: { id: true }
  });
  const formulaVersionId = formulaVersion?.id ?? null;

  const nearPlayers = await loadNearThresholdPlayers(formulaVersionId);
  const nearById = new Map(nearPlayers.map((p) => [p.playerId, p]));

  const playerNameToId = new Map<string, string>();
  const allPlayers = await prisma.player.findMany({
    where: { deletedAt: null },
    select: { id: true, displayName: true }
  });
  for (const p of allPlayers) {
    playerNameToId.set(normalizeName(p.displayName), p.id);
  }

  const playerLeagues = new Map<string, Set<string>>();
  const stats = await prisma.gameStat.findMany({
    where: { deletedAt: null, playerId: { in: nearPlayers.map((p) => p.playerId) } },
    select: {
      playerId: true,
      game: { select: { season: { select: { name: true, league: { select: { name: true, ageGroup: true } } } } } }
    }
  });
  for (const stat of stats) {
    const league = stat.game.season.league.name;
    const set = playerLeagues.get(stat.playerId) ?? new Set<string>();
    set.add(league);
    playerLeagues.set(stat.playerId, set);
  }

  const submissions = await prisma.submission.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      title: true,
      leagueName: true,
      status: true,
      rawText: true,
      parsedPreview: true,
      importedAt: true
    },
    orderBy: { createdAt: "asc" }
  });

  const leagues = await prisma.league.findMany({
    where: { deletedAt: null },
    include: {
      seasons: {
        where: { deletedAt: null },
        include: {
          games: {
            where: { deletedAt: null },
            select: { id: true, gameNumber: true, sourceName: true }
          }
        }
      }
    }
  });

  type SeasonKey = string;
  const dbGamesBySeason = new Map<SeasonKey, { league: string; season: string; ageGroup: AgeGroup; games: number; gameNumbers: Set<string> }>();

  for (const league of leagues) {
    for (const season of league.seasons) {
      const key = `${league.name}|${season.name}`;
      dbGamesBySeason.set(key, {
        league: league.name,
        season: season.name,
        ageGroup: league.ageGroup,
        games: season.games.length,
        gameNumbers: new Set(season.games.map((g) => g.gameNumber).filter(Boolean) as string[])
      });
    }
  }

  const submissionBySeason = new Map<
    string,
    Array<{
      id: string;
      title: string;
      status: SubmissionStatus;
      stage: StageKind;
      games: number;
      gameNumbers: string[];
      playerNames: string[];
      leagueName: string;
      seasonName: string;
    }>
  >();

  for (const sub of submissions) {
    const parsed = parseSubmission({ rawText: sub.rawText, parsedPreview: sub.parsedPreview });
    if (!parsed.ok) continue;
    const leagueName = parsed.leagueName || sub.leagueName || "";
    const seasonName = parsed.seasonName || "Unknown Season";
    const key = `${leagueName}|${seasonName}`;
    const bucket = submissionBySeason.get(key) ?? [];
    bucket.push({
      id: sub.id,
      title: sub.title,
      status: sub.status,
      stage: inferStage(sub.title),
      games: parsed.games,
      gameNumbers: parsed.gameNumbers,
      playerNames: parsed.playerNames,
      leagueName,
      seasonName
    });
    submissionBySeason.set(key, bucket);
  }

  const queueCandidates: Omit<QueueItem, "tier">[] = [];

  const phaseD = existsSync(PHASE_D_PATH)
    ? (JSON.parse(readFileSync(PHASE_D_PATH, "utf8")) as {
        coverageMatrix: CoverageRow[];
        familyAggregates: FamilyAggregate[];
        submissionFamilyIndex?: Record<string, { titles: string[] }>;
      })
    : null;

  function nearPlayersInLeague(leagueName: string) {
    const ids = new Set<string>();
    for (const player of nearPlayers) {
      if (playerLeagues.get(player.playerId)?.has(leagueName)) ids.add(player.playerId);
    }
    return ids;
  }

  function pushCandidate(item: Omit<QueueItem, "tier">) {
    queueCandidates.push(item);
  }

  function scorePlayers(playerIds: Set<string>, missingGames: number) {
    let projectedNewRanked = 0;
    let projectedP7Reduction = 0;
    let projectedP12Shift = 0;
    const names: string[] = [];

    for (const id of playerIds) {
      const player = nearById.get(id);
      if (!player) continue;
      names.push(player.name);
      projectedP7Reduction += 1;
      if (player.wouldRankWithImport && player.gamesShort <= missingGames) {
        projectedNewRanked += 1;
      } else if (!player.hasDob && player.gamesShort <= missingGames) {
        projectedP12Shift += 1;
      }
    }

    return { projectedNewRanked, projectedP7Reduction, projectedP12Shift, names };
  }

  function playersFromSubmissionNames(names: string[]) {
    const ids = new Set<string>();
    for (const name of names) {
      const id = playerNameToId.get(normalizeName(name));
      if (id && nearById.has(id)) ids.add(id);
    }
    return ids;
  }

  // Pending / not-imported submissions
  for (const sub of submissions) {
    if (sub.status === SubmissionStatus.IMPORTED || sub.status === SubmissionStatus.REJECTED) continue;
    const parsed = parseSubmission({ rawText: sub.rawText, parsedPreview: sub.parsedPreview });
    if (!parsed.ok || parsed.games === 0) continue;

    const playerIds = playersFromSubmissionNames(parsed.playerNames);
    const leagueName = parsed.leagueName || sub.leagueName || sub.title;
    const seasonName = parsed.seasonName || "Unknown Season";
    const stage = inferStage(sub.title);

    const scores = scorePlayers(playerIds, parsed.games);
    const ageGroup =
      leagues.find((l) => l.name === leagueName)?.ageGroup ??
      (leagueName.toLowerCase().includes("13") ? AgeGroup.U13 : leagueName.toLowerCase().includes("16") || leagueName.toLowerCase().includes("15") ? AgeGroup.U16 : AgeGroup.U19);

    queueCandidates.push({
      competition: leagueName,
      season: seasonName,
      ageGroup: ageGroup.replace("U", "U"),
      gender: inferGender(`${leagueName} ${sub.title}`),
      missingRoundsPhases: [sub.title, stage],
      affectedPlayers: scores.names.length,
      affectedPlayerNames: scores.names.slice(0, 15),
      projectedNewRanked: scores.projectedNewRanked,
      projectedP7Reduction: scores.projectedP7Reduction,
      projectedP12Shift: scores.projectedP12Shift,
      missingGames: parsed.games,
      effort: effortFor({ missingGames: parsed.games, status: sub.status, missingStages: [stage], hasLineage: false }),
      roiScore: scores.projectedNewRanked * 20 + scores.projectedP7Reduction * 3,
      sourceType: "pending_submission",
      submissionId: sub.id,
      submissionStatus: sub.status
    });
  }

  // Phase D coverage matrix — missing rounds, partial imports
  if (phaseD) {
    for (const row of phaseD.coverageMatrix) {
      const delta = row.submissionDbGameDelta ?? 0;
      const hasGap = row.missingStages.length > 0 || delta > 0 || row.coverageStatus === "partial";
      if (!hasGap) continue;

      const nearIds = nearPlayersInLeague(row.leagueName);
      const missingGamesEst = Math.max(delta, row.missingStages.length * 4, 1);
      const scores = scorePlayers(nearIds, missingGamesEst);

      const missingRoundsPhases: string[] = [];
      for (const stage of row.missingStages) {
        missingRoundsPhases.push(`missing ${stage}`);
      }
      if (delta > 0) missingRoundsPhases.push(`${delta} submission game(s) not in DB`);
      if (row.stagesInSubmissions.length) {
        missingRoundsPhases.push(`imported stages: ${row.stagesInSubmissions.join(", ")}`);
      }

      pushCandidate({
        competition: row.leagueName,
        season: row.seasonName,
        ageGroup: row.ageGroup,
        gender: inferGender(row.leagueName),
        missingRoundsPhases: [
          ...missingRoundsPhases,
          ...(row.missingStages.includes("playoffs")
            ? ["exact missing: 5th Stallion Cup 17U, Playoffs"]
            : []),
          ...(row.missingStages.includes("eliminations")
            ? ["exact missing: 5th Stallion Cup 17U, Eliminations"]
            : [])
        ],
        affectedPlayers: scores.names.length,
        affectedPlayerNames: scores.names.slice(0, 15),
        projectedNewRanked: scores.projectedNewRanked,
        projectedP7Reduction: scores.projectedP7Reduction,
        projectedP12Shift: scores.projectedP12Shift,
        missingGames: missingGamesEst,
        effort: effortFor({
          missingGames: missingGamesEst,
          missingStages: row.missingStages,
          hasLineage: row.submissionGames > 0
        }),
        roiScore:
          scores.projectedNewRanked * 20 +
          scores.projectedP7Reduction * 4 +
          (row.missingStages.includes("playoffs") ? 25 : 0),
        sourceType: row.missingStages.length ? "missing_stage" : "partial_coverage"
      });
    }

    for (const family of phaseD.familyAggregates) {
      if (family.submissionDbGameDelta <= 0 || family.coverageStatus === "complete") continue;

      const familyLeagueMap: Record<string, string> = {
        pybc_15u: "Philippine Youth Basketball Championship – 15U",
        pybc_13u: "Philippine Youth Basketball Championship – 13U",
        stallion_cup: "6th Stallion Cup Teens – Jumbo Plastic Conference 18u"
      };
      const leagueName = familyLeagueMap[family.family] ?? family.family;
      const nearIds = nearPlayersInLeague(leagueName);
      for (const row of phaseD.coverageMatrix) {
        if (row.leagueName.toLowerCase().includes(family.family.replace(/_/g, " ").split(" ")[0])) {
          for (const id of nearPlayersInLeague(row.leagueName)) nearIds.add(id);
        }
      }

      const titles = phaseD.submissionFamilyIndex?.[family.family]?.titles ?? [];
      const missingGames = family.submissionDbGameDelta;
      const scores = scorePlayers(nearIds, missingGames);

      pushCandidate({
        competition: leagueName,
        season: "Family rollup",
        ageGroup: family.family.includes("13") ? "U13" : family.family.includes("15") || family.family.includes("16") ? "U16" : "U19",
        gender: inferGender(leagueName),
        missingRoundsPhases: [
          `${missingGames} game(s) in submission inventory not in DB`,
          ...(titles.length ? [`exact batches: ${titles.join("; ")}`] : [])
        ],
        affectedPlayers: scores.names.length,
        affectedPlayerNames: scores.names.slice(0, 15),
        projectedNewRanked: scores.projectedNewRanked,
        projectedP7Reduction: scores.projectedP7Reduction,
        projectedP12Shift: scores.projectedP12Shift,
        missingGames,
        effort: missingGames <= 12 ? "low" : "medium",
        roiScore: scores.projectedNewRanked * 15 + scores.projectedP7Reduction * 3 + missingGames,
        sourceType: "partial_coverage"
      });
    }
  }

  // High-ROI league extensions (1 game short clusters)
  const leagueNearCounts = new Map<string, NearPlayer[]>();
  for (const player of nearPlayers) {
    for (const leagueName of playerLeagues.get(player.playerId) ?? []) {
      const list = leagueNearCounts.get(leagueName) ?? [];
      list.push(player);
      leagueNearCounts.set(leagueName, list);
    }
  }

  for (const [leagueName, players] of leagueNearCounts) {
    const league = leagues.find((l) => l.name === leagueName);
    if (!league) continue;
    const oneShort = players.filter((p) => p.gamesShort === 1);
    const twoShort = players.filter((p) => p.gamesShort === 2);
    if (oneShort.length < 3 && twoShort.length < 5) continue;

    const already = queueCandidates.some(
      (c) => c.competition === leagueName && c.missingRoundsPhases.some((p) => p.includes("missing"))
    );

    const ids = new Set(players.map((p) => p.playerId));
    const scores = scorePlayers(ids, 1);
    if (scores.names.length < 5) continue;

    pushCandidate({
      competition: leagueName,
      season: league.seasons[0]?.name ?? "Current season",
      ageGroup: league.ageGroup,
      gender: inferGender(leagueName),
      missingRoundsPhases: already
        ? ["remaining schedule / next round"]
        : ["remaining schedule / next round (no missing-stage flag)"],
      affectedPlayers: scores.names.length,
      affectedPlayerNames: scores.names.slice(0, 15),
      projectedNewRanked: oneShort.filter((p) => p.wouldRankWithImport).length,
      projectedP7Reduction: oneShort.length + twoShort.length,
      projectedP12Shift: oneShort.filter((p) => !p.hasDob).length,
      missingGames: 1,
      effort: "low",
      roiScore: oneShort.filter((p) => p.wouldRankWithImport).length * 30 + oneShort.length * 5,
      sourceType: "partial_coverage"
    });
  }

  // Per-season coverage gaps from imported submission lineage
  for (const [seasonKey, subs] of submissionBySeason) {
    const db = dbGamesBySeason.get(seasonKey);
    if (!db) continue;

    const importedSubs = subs.filter((s) => s.status === SubmissionStatus.IMPORTED);
    const allSubs = subs;
    if (!allSubs.length) continue;

    const submissionGames = allSubs.reduce((sum, s) => sum + s.games, 0);
    const importedSubmissionGames = importedSubs.reduce((sum, s) => sum + s.games, 0);
    const stagesPresent = new Set(allSubs.map((s) => s.stage));
    const expectedStages: StageKind[] = [];
    const familyKey = db.league.toLowerCase();
    if (familyKey.includes("stallion")) expectedStages.push("eliminations", "playoffs");
    if (familyKey.includes("13u") || familyKey.includes("pybc") && familyKey.includes("13")) {
      expectedStages.push("eliminations", "playoffs");
    }
    const missingStages = expectedStages.filter((s) => !stagesPresent.has(s));

    const missingGameNumbers: string[] = [];
    for (const sub of allSubs) {
      for (const gn of sub.gameNumbers) {
        if (!db.gameNumbers.has(gn)) missingGameNumbers.push(gn);
      }
    }
    const uniqueMissingGames = new Set(missingGameNumbers).size;
    const submissionDbDelta = Math.max(0, importedSubmissionGames - db.games);

    if (submissionDbDelta === 0 && missingStages.length === 0 && uniqueMissingGames === 0) continue;

    const nearInLeague = new Set<string>();
    for (const player of nearPlayers) {
      const leaguesPlayed = playerLeagues.get(player.playerId);
      if (leaguesPlayed?.has(db.league)) nearInLeague.add(player.playerId);
    }

    // Also match submission player names across all subs for this season
    for (const sub of allSubs) {
      for (const id of playersFromSubmissionNames(sub.playerNames)) {
        if (nearById.has(id)) nearInLeague.add(id);
      }
    }

    const missingGamesEst = Math.max(uniqueMissingGames, submissionDbDelta, missingStages.length * 4);
    const scores = scorePlayers(nearInLeague, missingGamesEst);

    const missingRoundsPhases: string[] = [];
    if (missingStages.length) missingRoundsPhases.push(...missingStages.map((s) => `missing ${s}`));
    if (uniqueMissingGames > 0) missingRoundsPhases.push(`${uniqueMissingGames} game number(s) not in DB`);
    if (submissionDbDelta > 0) missingRoundsPhases.push(`${submissionDbDelta} submission game(s) not imported`);

    const notImportedSubs = allSubs.filter((s) => s.status !== SubmissionStatus.IMPORTED);
    for (const sub of notImportedSubs) {
      missingRoundsPhases.push(`not imported: ${sub.title}`);
    }

    queueCandidates.push({
      competition: db.league,
      season: db.season,
      ageGroup: db.ageGroup,
      gender: inferGender(db.league),
      missingRoundsPhases: [...new Set(missingRoundsPhases)],
      affectedPlayers: scores.names.length,
      affectedPlayerNames: scores.names.slice(0, 15),
      projectedNewRanked: scores.projectedNewRanked,
      projectedP7Reduction: scores.projectedP7Reduction,
      projectedP12Shift: scores.projectedP12Shift,
      missingGames: missingGamesEst,
      effort: effortFor({
        missingGames: missingGamesEst,
        missingStages: missingStages.map(String),
        hasLineage: importedSubs.length > 0
      }),
      roiScore: scores.projectedNewRanked * 15 + scores.projectedP7Reduction * 2 + (missingGamesEst <= 5 ? 10 : 0),
      sourceType: missingStages.length ? "missing_stage" : submissionDbDelta > 0 ? "partial_coverage" : "game_gap"
    });
  }

  // League-level rollup for near-threshold players (extend existing competition)
  for (const league of leagues) {
    for (const season of league.seasons) {
      if (season.games.length === 0) continue;
      const nearInLeague = nearPlayers.filter((p) => playerLeagues.get(p.playerId)?.has(league.name));
      if (!nearInLeague.length) continue;

      const oneShort = nearInLeague.filter((p) => p.gamesShort === 1 && p.wouldRankWithImport);
      if (oneShort.length < 2) continue;

      const key = `${league.name}|${season.name}`;
      const already = queueCandidates.some(
        (c) => c.competition === league.name && c.season === season.name && c.projectedNewRanked >= oneShort.length
      );
      if (already) continue;

      const ids = new Set(oneShort.map((p) => p.playerId));
      const scores = scorePlayers(ids, 1);

      queueCandidates.push({
        competition: league.name,
        season: season.name,
        ageGroup: league.ageGroup,
        gender: inferGender(league.name),
        missingRoundsPhases: ["next available round / remaining schedule"],
        affectedPlayers: oneShort.length,
        affectedPlayerNames: oneShort.map((p) => p.name).slice(0, 15),
        projectedNewRanked: scores.projectedNewRanked,
        projectedP7Reduction: scores.projectedP7Reduction,
        projectedP12Shift: scores.projectedP12Shift,
        missingGames: 1,
        effort: "low",
        roiScore: scores.projectedNewRanked * 25,
        sourceType: "partial_coverage"
      });
    }
  }

  // Deduplicate by competition+season, merge missing rounds, keep highest ROI
  const deduped = new Map<string, Omit<QueueItem, "tier">>();
  for (const item of queueCandidates) {
    const key = `${item.competition}|${item.season}`;
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, item);
      continue;
    }
    const mergedPhases = [...new Set([...existing.missingRoundsPhases, ...item.missingRoundsPhases])];
    const pick = item.roiScore > existing.roiScore ? item : existing;
    deduped.set(key, {
      ...pick,
      missingRoundsPhases: mergedPhases,
      affectedPlayers: Math.max(existing.affectedPlayers, item.affectedPlayers),
      projectedNewRanked: Math.max(existing.projectedNewRanked, item.projectedNewRanked),
      projectedP7Reduction: Math.max(existing.projectedP7Reduction, item.projectedP7Reduction),
      projectedP12Shift: Math.max(existing.projectedP12Shift, item.projectedP12Shift),
      roiScore: Math.max(existing.roiScore, item.roiScore)
    });
  }

  const withTiers: QueueItem[] = [...deduped.values()]
    .map((item) => ({ ...item, tier: assignTier(item) }))
    .sort((a, b) => b.roiScore - a.roiScore);

  const importQueue = {
    IMPORT_NOW: withTiers.filter((i) => i.tier === "IMPORT_NOW"),
    IMPORT_NEXT: withTiers.filter((i) => i.tier === "IMPORT_NEXT"),
    IMPORT_LATER: withTiers.filter((i) => i.tier === "IMPORT_LATER")
  };

  const sumTier = (items: QueueItem[]) => ({
    ranked: items.reduce((s, i) => s + i.projectedNewRanked, 0),
    p7: items.reduce((s, i) => s + i.projectedP7Reduction, 0)
  });

  const now = sumTier(importQueue.IMPORT_NOW);
  const next = sumTier(importQueue.IMPORT_NEXT);
  const later = sumTier(importQueue.IMPORT_LATER);

  const boardGrowth = { u19Boys: 0, u19Girls: 0, u16Boys: 0, u16Girls: 0, u13Boys: 0 };
  for (const item of [...importQueue.IMPORT_NOW, ...importQueue.IMPORT_NEXT]) {
    for (const name of item.affectedPlayerNames) {
      const player = nearPlayers.find((p) => p.name === name);
      if (!player?.wouldRankWithImport) continue;
      if (player.board === "U19 Boys") boardGrowth.u19Boys += 1;
      else if (player.board === "U19 Girls") boardGrowth.u19Girls += 1;
      else if (player.board === "U16 Boys") boardGrowth.u16Boys += 1;
      else if (player.board === "U16 Girls") boardGrowth.u16Girls += 1;
      else if (player.board === "U13 Boys") boardGrowth.u13Boys += 1;
    }
  }

  const recommendedExecutionOrder = [
    ...importQueue.IMPORT_NOW.map(
      (i) =>
        `${i.competition} (${i.season}) — ${i.missingRoundsPhases.slice(0, 2).join("; ")} → +${i.projectedNewRanked} RANKED, −${i.projectedP7Reduction} P7`
    ),
    ...importQueue.IMPORT_NEXT.slice(0, 8).map(
      (i) =>
        `${i.competition} (${i.season}) — ${i.missingRoundsPhases[0] ?? "extend"} → +${i.projectedNewRanked} RANKED`
    )
  ];

  const payload = {
    generatedAt: new Date().toISOString(),
    executiveSummary: {
      nearThresholdTotal: nearPlayers.length,
      dobReadyNearThreshold: nearPlayers.filter((p) => p.wouldRankWithImport).length,
      noDobNearThreshold: nearPlayers.filter((p) => !p.hasDob).length,
      partialCompetitions: deduped.size,
      pendingBatches: submissions.filter(
        (s) => s.status !== SubmissionStatus.IMPORTED && s.status !== SubmissionStatus.REJECTED
      ).length,
      oneGameShortWithDob: nearPlayers.filter((p) => p.gamesShort === 1 && p.wouldRankWithImport).length
    },
    importQueue,
    expectedBoardGrowth: {
      importNowRanked: now.ranked,
      importNowP7: now.p7,
      importNextRanked: next.ranked,
      importNextP7: next.p7,
      importLaterRanked: later.ranked,
      importLaterP7: later.p7,
      totalRanked: now.ranked + next.ranked + later.ranked,
      totalP7: now.p7 + next.p7 + later.p7,
      byBoard: boardGrowth
    },
    recommendedExecutionOrder,
    allItems: withTiers
  };

  const jsonPath = join(OUT_DIR, "competition-import-execution-queue.json");
  const mdPath = join(OUT_DIR, "COMPETITION_IMPORT_EXECUTION_QUEUE.md");
  writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
  writeFileSync(mdPath, renderMarkdown(payload));

  console.log(
    JSON.stringify(
      {
        jsonPath,
        mdPath,
        IMPORT_NOW: importQueue.IMPORT_NOW.length,
        IMPORT_NEXT: importQueue.IMPORT_NEXT.length,
        IMPORT_LATER: importQueue.IMPORT_LATER.length,
        expectedRanked: payload.expectedBoardGrowth
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
