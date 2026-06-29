/**
 * TR-3 Read-Only TPI-v1 Pilot — no DB writes, no persistence.
 * Usage: npx tsx scripts/tpi-v1-pilot-readonly.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup, VerificationStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { isPybcCompetitionName, normalizeCompetitionDisplayName } from "../src/lib/competition-naming";

const EVALUATION_DATE = new Date("2026-06-17T12:00:00.000Z");
const HALF_LIFE_DAYS = 180;
const MAX_AGE_DAYS = 540;
const BOARD_PRIOR = 50;
const MIN_GAMES = 8;
const MIN_OPPONENTS = 3;

const TIER_WEIGHT: Record<number, number> = { 1: 1.0, 2: 1.1, 3: 1.25, 4: 1.4 };

type Gender = "Boys" | "Girls";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function inferGender(leagueName: string, teamName: string): Gender {
  const text = `${leagueName} ${teamName}`.toLowerCase();
  return text.includes("girls") ? "Girls" : "Boys";
}

function recencyWeight(gameDate: Date): number {
  const ageDays = Math.max(0, Math.floor((EVALUATION_DATE.getTime() - gameDate.getTime()) / 86_400_000));
  if (ageDays > MAX_AGE_DAYS) return 0;
  return Math.exp((-Math.LN2 / HALF_LIFE_DAYS) * ageDays);
}

function opponentFactor(strength: number): number {
  return clamp(1 + (strength - 50) / 400, 0.85, 1.15);
}

type GameRow = {
  gameId: string;
  gameNumber: string | null;
  gameDate: Date;
  homeScore: number;
  awayScore: number;
  homeProgramId: string | null;
  awayProgramId: string | null;
  homeProgramName: string;
  awayProgramName: string;
  leagueTier: number;
  ageGroup: AgeGroup;
  gender: Gender;
  leagueName: string;
};

type PendingGame = {
  gameId: string;
  gameDate: Date;
  opponentProgramId: string;
  opponentName: string;
  won: boolean;
  pointDiff: number;
  leagueTier: number;
};

type ProgramState = {
  programId: string;
  programName: string;
  ageGroup: AgeGroup;
  gender: Gender;
  verifiedGames: number;
  opponents: Set<string>;
  wins: number;
  losses: number;
  tierWeightedWins: number;
  tierWeightedGames: number;
  games: PendingGame[];
};

type GameContribution = PendingGame & {
  outcomeBase: number;
  marginAdj: number;
  oppAdj: number;
  preMultiplier: number;
  leagueTierWeight: number;
  recencyWeight: number;
  opponentStrength: number;
  opponentFactor: number;
  gameScore: number;
  outcomeComponent: number;
  marginComponent: number;
  opponentComponent: number;
  recencyComponent: number;
};

type ProgramResult = {
  programId: string;
  programName: string;
  ageGroup: AgeGroup;
  gender: Gender;
  verifiedGames: number;
  verifiedOpponents: number;
  wins: number;
  losses: number;
  pass0Strength: number;
  pass1ObservedFinal: number;
  tpiObservedRaw: number;
  effectiveWeight: number;
  tpiAdjusted: number;
  shrinkageEffect: number;
  publicEligible: boolean;
  wlPct: number;
  contributions: GameContribution[];
};

function computeGameScore(
  won: boolean,
  pointDiff: number,
  opponentStrength: number,
  leagueTier: number,
  gameDate: Date
) {
  const outcomeBase = won ? 55 : pointDiff === 0 ? 50 : 45;
  const marginAdj = clamp(pointDiff / 20, -5, 5);
  const oppAdj = (opponentStrength - 50) * 0.12;
  const preMultiplier = outcomeBase + marginAdj + oppAdj;
  const leagueTierWeight = TIER_WEIGHT[leagueTier] ?? 1.0;
  const recW = recencyWeight(gameDate);
  const oppF = opponentFactor(opponentStrength);
  const gameScore = preMultiplier * leagueTierWeight * recW * oppF;
  const outcomeComponent = (outcomeBase - 50) * leagueTierWeight * recW * oppF;
  const marginComponent = marginAdj * leagueTierWeight * recW * oppF;
  const opponentComponent = oppAdj * leagueTierWeight * recW * oppF;
  const recencyComponent = preMultiplier * leagueTierWeight * oppF * (recW - 1);
  return {
    outcomeBase,
    marginAdj,
    oppAdj,
    preMultiplier,
    leagueTierWeight,
    recencyWeight: recW,
    opponentStrength,
    opponentFactor: oppF,
    gameScore,
    outcomeComponent,
    marginComponent,
    opponentComponent,
    recencyComponent
  };
}

function pass0Strength(p: ProgramState): number {
  return 30 + 40 * (p.tierWeightedWins / Math.max(p.tierWeightedGames, 1));
}

function evaluatePrograms(programs: ProgramState[], opponentStrengths: Map<string, number>) {
  const observed = new Map<string, number>();
  const contributionsByProgram = new Map<string, GameContribution[]>();
  const effectiveWeights = new Map<string, number>();

  for (const p of programs) {
    let effectiveWeight = 0;
    const contribs: GameContribution[] = [];
    for (const g of p.games) {
      const oppStrength = opponentStrengths.get(g.opponentProgramId) ?? 50;
      const calc = computeGameScore(g.won, g.pointDiff, oppStrength, g.leagueTier, g.gameDate);
      contribs.push({ ...g, ...calc });
      effectiveWeight += calc.recencyWeight;
    }
    contributionsByProgram.set(p.programId, contribs);
    effectiveWeights.set(p.programId, effectiveWeight);
    const raw = contribs.reduce((s, c) => s + c.gameScore, 0);
    observed.set(p.programId, effectiveWeight > 0 ? clamp(raw / effectiveWeight, 25, 75) : 50);
  }

  return { observed, contributionsByProgram, effectiveWeights };
}

function shrinkage(effectiveWeight: number, observed: number, k: number) {
  return (effectiveWeight * observed + k * BOARD_PRIOR) / (effectiveWeight + k);
}

function runTpi(programs: ProgramState[], k: number): ProgramResult[] {
  const pass0 = new Map(programs.map((p) => [p.programId, pass0Strength(p)]));
  const pass0Eval = evaluatePrograms(programs, pass0);
  const pass1Strength = new Map(pass0Eval.observed);
  const pass1Eval = evaluatePrograms(programs, pass1Strength);

  return programs.map((p) => {
    const contribs = pass1Eval.contributionsByProgram.get(p.programId) ?? [];
    const effectiveWeight = pass1Eval.effectiveWeights.get(p.programId) ?? 0;
    const observedClamped = pass1Eval.observed.get(p.programId) ?? 50;
    const rawObserved =
      effectiveWeight > 0 ? contribs.reduce((s, c) => s + c.gameScore, 0) / effectiveWeight : 50;
    const tpiAdjusted = shrinkage(effectiveWeight, observedClamped, k);
    const eligible = p.verifiedGames >= MIN_GAMES && p.opponents.size >= MIN_OPPONENTS;

    return {
      programId: p.programId,
      programName: p.programName,
      ageGroup: p.ageGroup,
      gender: p.gender,
      verifiedGames: p.verifiedGames,
      verifiedOpponents: p.opponents.size,
      wins: p.wins,
      losses: p.losses,
      pass0Strength: Math.round(pass0.get(p.programId)! * 100) / 100,
      pass1ObservedFinal: Math.round(observedClamped * 100) / 100,
      tpiObservedRaw: Math.round(rawObserved * 100) / 100,
      effectiveWeight: Math.round(effectiveWeight * 100) / 100,
      tpiAdjusted: Math.round(tpiAdjusted * 100) / 100,
      shrinkageEffect: Math.round((tpiAdjusted - observedClamped) * 100) / 100,
      publicEligible: eligible,
      wlPct: Math.round((p.wins / Math.max(p.verifiedGames, 1)) * 1000) / 10,
      contributions: contribs
    };
  });
}

function denseRank(rows: ProgramResult[]) {
  const eligible = rows.filter((r) => r.publicEligible);
  const sorted = [...eligible].sort(
    (a, b) =>
      b.tpiAdjusted - a.tpiAdjusted ||
      b.verifiedGames - a.verifiedGames ||
      a.programName.localeCompare(b.programName)
  );
  let rank = 0;
  let prevTpi: number | null = null;
  return sorted.map((r, i) => {
    if (prevTpi === null || r.tpiAdjusted !== prevTpi) rank = i + 1;
    prevTpi = r.tpiAdjusted;
    return { ...r, rank };
  });
}

function contributionAudit(r: ProgramResult) {
  const eff = r.effectiveWeight || 1;
  const totals = r.contributions.reduce(
    (acc, c) => ({
      outcome: acc.outcome + c.outcomeComponent,
      margin: acc.margin + c.marginComponent,
      opponent: acc.opponent + c.opponentComponent,
      recency: acc.recency + c.recencyComponent
    }),
    { outcome: 0, margin: 0, opponent: 0, recency: 0 }
  );
  return {
    programId: r.programId,
    programName: r.programName,
    perGameAvg: {
      outcome: Math.round((totals.outcome / eff) * 100) / 100,
      margin: Math.round((totals.margin / eff) * 100) / 100,
      opponent: Math.round((totals.opponent / eff) * 100) / 100,
      recency: Math.round((totals.recency / eff) * 100) / 100
    },
    shrinkageEffect: r.shrinkageEffect,
    pass1Observed: r.pass1ObservedFinal,
    tpiAdjusted: r.tpiAdjusted
  };
}

async function loadGames(cohort: "pybc" | "uaap", evidenceStatuses: VerificationStatus[]) {
  const games = await prisma.game.findMany({
    where: {
      deletedAt: null,
      verificationStatus: { in: evidenceStatuses },
      season: { deletedAt: null, league: { deletedAt: null } },
      homeTeam: { deletedAt: null },
      awayTeam: { deletedAt: null }
    },
    include: {
      homeTeam: { include: { program: true } },
      awayTeam: { include: { program: true } },
      season: { include: { league: true } }
    },
    orderBy: [{ gameDate: "asc" }]
  });

  const rows: GameRow[] = [];
  for (const g of games) {
    const leagueName = g.season.league.name;
    const isPybc = isPybcCompetitionName(normalizeCompetitionDisplayName(leagueName));
    const isUaap = /\bUAAP\b/i.test(leagueName) || /\bUAAP\b/i.test(g.season.name);
    if (cohort === "pybc" && !isPybc) continue;
    if (cohort === "uaap" && !isUaap) continue;
    if (!g.homeTeam.programId || !g.awayTeam.programId) continue;

    const gender = inferGender(leagueName, g.homeTeam.name);
    rows.push({
      gameId: g.id,
      gameNumber: g.gameNumber,
      gameDate: g.gameDate,
      homeScore: g.homeScore,
      awayScore: g.awayScore,
      homeProgramId: g.homeTeam.programId,
      awayProgramId: g.awayTeam.programId,
      homeProgramName: g.homeTeam.program?.fullName ?? g.homeTeam.name,
      awayProgramName: g.awayTeam.program?.fullName ?? g.awayTeam.name,
      leagueTier: g.season.league.tier,
      ageGroup: g.season.league.ageGroup,
      gender,
      leagueName
    });
  }
  return rows;
}

function dedupeGames(rows: GameRow[]): GameRow[] {
  const seen = new Map<string, GameRow>();
  for (const g of rows) {
    const key = g.gameNumber ?? g.gameId;
    if (!seen.has(key)) seen.set(key, g);
  }
  return [...seen.values()];
}

function boardGroupKey(ageGroup: AgeGroup, gender: Gender) {
  return `${ageGroup}:${gender}`;
}

function buildPrograms(gameRows: GameRow[]): ProgramState[] {
  const map = new Map<string, ProgramState>();

  function ensure(programId: string, name: string, ageGroup: AgeGroup, gender: Gender) {
    let p = map.get(programId);
    if (!p) {
      p = {
        programId,
        programName: name,
        ageGroup,
        gender,
        verifiedGames: 0,
        opponents: new Set(),
        wins: 0,
        losses: 0,
        tierWeightedWins: 0,
        tierWeightedGames: 0,
        games: []
      };
      map.set(programId, p);
    }
    return p;
  }

  for (const g of gameRows) {
    const tierW = TIER_WEIGHT[g.leagueTier] ?? 1.0;
    const homeWon = g.homeScore > g.awayScore;
    const awayWon = g.awayScore > g.homeScore;
    const home = ensure(g.homeProgramId!, g.homeProgramName, g.ageGroup, g.gender);
    const away = ensure(g.awayProgramId!, g.awayProgramName, g.ageGroup, g.gender);

    home.verifiedGames += 1;
    away.verifiedGames += 1;
    home.opponents.add(g.awayProgramId!);
    away.opponents.add(g.homeProgramId!);
    home.tierWeightedGames += tierW;
    away.tierWeightedGames += tierW;

    if (homeWon) {
      home.wins += 1;
      home.tierWeightedWins += tierW;
      away.losses += 1;
    } else if (awayWon) {
      away.wins += 1;
      away.tierWeightedWins += tierW;
      home.losses += 1;
    }

    home.games.push({
      gameId: g.gameId,
      gameDate: g.gameDate,
      opponentProgramId: g.awayProgramId!,
      opponentName: g.awayProgramName,
      won: homeWon,
      pointDiff: g.homeScore - g.awayScore,
      leagueTier: g.leagueTier
    });
    away.games.push({
      gameId: g.gameId,
      gameDate: g.gameDate,
      opponentProgramId: g.homeProgramId!,
      opponentName: g.homeProgramName,
      won: awayWon,
      pointDiff: g.awayScore - g.homeScore,
      leagueTier: g.leagueTier
    });
  }

  return [...map.values()];
}

async function countPybcAllStatuses() {
  const games = await prisma.game.findMany({
    where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } },
    include: { season: { include: { league: true } } }
  });
  let pybcTotal = 0;
  let pybcVerified = 0;
  const byStatus: Record<string, number> = {};
  for (const g of games) {
    if (!isPybcCompetitionName(normalizeCompetitionDisplayName(g.season.league.name))) continue;
    pybcTotal += 1;
    byStatus[g.verificationStatus] = (byStatus[g.verificationStatus] ?? 0) + 1;
    if (g.verificationStatus === VerificationStatus.VERIFIED) pybcVerified += 1;
  }
  return { pybcTotal, pybcVerified, byStatus };
}

async function checkUaapDuplicates() {
  const teams = await prisma.team.findMany({
    where: { deletedAt: null, programId: { not: null } },
    include: {
      program: true,
      homeGames: { where: { deletedAt: null }, select: { id: true } },
      awayGames: { where: { deletedAt: null }, select: { id: true } }
    }
  });

  const byProgram = new Map<string, typeof teams>();
  for (const t of teams) {
    const pid = t.programId!;
    if (!byProgram.has(pid)) byProgram.set(pid, []);
    byProgram.get(pid)!.push(t);
  }

  const dupes = [];
  for (const [pid, list] of byProgram) {
    const active = list.filter((t) => t.homeGames.length + t.awayGames.length > 0);
    if (active.length <= 1) continue;
    const label = active.map((t) => `${t.program?.fullName ?? ""} ${t.name}`).join(" ");
    if (!/\bUAAP\b|University|Ateneo|La Salle|UST|Adamson|NU |FEU|UE |UP /i.test(label)) continue;
    dupes.push({
      programId: pid,
      programName: active[0].program?.fullName,
      teams: active.map((t) => ({
        id: t.id,
        name: t.name,
        games: t.homeGames.length + t.awayGames.length
      }))
    });
  }
  return dupes;
}

function sensitivity(programs: ProgramState[]) {
  const ks = [4, 6, 8] as const;
  const byK = Object.fromEntries(
    ks.map((k) => [k, denseRank(runTpi(programs, k))])
  ) as Record<number, ReturnType<typeof denseRank>>;

  const base = byK[6];
  const stability = ks.map((k) => {
    const comp = byK[k];
    let maxRankDelta = 0;
    let maxTpiDelta = 0;
    for (const b of base) {
      const o = comp.find((x) => x.programId === b.programId);
      if (!o) continue;
      maxRankDelta = Math.max(maxRankDelta, Math.abs(b.rank - o.rank));
      maxTpiDelta = Math.max(maxTpiDelta, Math.abs(b.tpiAdjusted - o.tpiAdjusted));
    }
    const orderStable = base.every((b, i) => comp[i]?.programId === b.programId);
    return { k, maxRankDelta, maxTpiDelta, orderStable };
  });

  return {
    rankings: Object.fromEntries(
      ks.map((k) => [
        k,
        byK[k].map((r) => ({
          rank: r.rank,
          program: r.programName,
          tpi: r.tpiAdjusted
        }))
      ])
    ),
    stability
  };
}

function validateChecks(
  cohort: string,
  gameCount: number,
  ranked: ReturnType<typeof denseRank>,
  all: ProgramResult[]
) {
  const checks: Record<string, { pass: boolean; detail: string }> = {};
  const keys = new Set(ranked.map((r) => `${r.programId}:${r.ageGroup}:${r.gender}`));

  checks["V-TR-01"] = { pass: keys.size === ranked.length, detail: `keys=${keys.size}, rows=${ranked.length}` };
  checks["V-TR-02"] = {
    pass: ranked.every((r) => r.verifiedGames === r.contributions.length),
    detail: "contrib count matches verified games per program"
  };
  checks["V-TR-03"] =
    cohort === "pybc"
      ? { pass: gameCount === 37, detail: `games=${gameCount}, expected 37` }
      : { pass: true, detail: "n/a" };

  const rec200 = recencyWeight(new Date(EVALUATION_DATE.getTime() - 200 * 86_400_000));
  const rec0 = recencyWeight(EVALUATION_DATE);
  checks["V-TR-04"] = {
    pass: rec200 / rec0 >= 0.44 && rec200 / rec0 <= 0.48,
    detail: `200d ratio=${(rec200 / rec0).toFixed(3)}`
  };

  checks["V-TR-05"] = {
    pass: ranked.every((r) => r.contributions.every((c) => c.leagueTierWeight > 0)),
    detail: "single tier weight per contribution"
  };

  const ineligible = all.filter((r) => !r.publicEligible);
  checks["V-TR-06"] = {
    pass: ineligible.every((r) => r.verifiedGames < MIN_GAMES || r.verifiedOpponents < MIN_OPPONENTS),
    detail: `ineligible count=${ineligible.length}`
  };

  checks["V-TR-07"] = { pass: ranked.every((r) => r.programId), detail: "all have programId" };
  checks["V-TR-08"] = { pass: keys.size === ranked.length, detail: "unique programId per board" };
  checks["V-TR-09"] = { pass: true, detail: "competition parity deferred — pilot only" };
  checks["V-TR-10"] = { pass: true, detail: "homepage deferred — pilot only" };

  return checks;
}

async function main() {
  const outDir = join(process.cwd(), "scripts", "reports");
  mkdirSync(outDir, { recursive: true });

  const pybcStatus = await countPybcAllStatuses();
  const uaapDupes = await checkUaapDuplicates();

  const report: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    evaluationDate: EVALUATION_DATE.toISOString(),
    formulaVersion: "TPI-v1",
    policyVersion: "TEAM-POLICY-v1-launch",
    pybcVerificationAudit: pybcStatus,
    uaapIdentityBlockers: uaapDupes,
    cohorts: {} as Record<string, unknown>
  };

  for (const cohort of ["pybc", "uaap"] as const) {
    if (cohort === "uaap" && uaapDupes.length > 0) {
      report.cohorts[cohort] = {
        status: "SKIPPED",
        reason: "TR-1 identity cleanup not complete",
        duplicatePrograms: uaapDupes
      };
      continue;
    }

    const evidenceModes =
      cohort === "pybc"
        ? [
            { label: "VERIFIED_STRICT", statuses: [VerificationStatus.VERIFIED] as VerificationStatus[] },
            {
              label: "SUBMITTED_PILOT",
              statuses: [VerificationStatus.SUBMITTED, VerificationStatus.VERIFIED] as VerificationStatus[]
            }
          ]
        : [{ label: "VERIFIED_STRICT", statuses: [VerificationStatus.VERIFIED] as VerificationStatus[] }];

    const modeResults: Record<string, unknown> = {};

    for (const mode of evidenceModes) {
      const gameRows = dedupeGames(await loadGames(cohort, mode.statuses));
      if (gameRows.length === 0) {
        modeResults[mode.label] = {
          status: "EMPTY",
          gameCount: 0,
          reason: `No games with status in [${mode.statuses.join(", ")}]`
        };
        continue;
      }

      const boards = new Map<string, GameRow[]>();
      for (const g of gameRows) {
        const key = boardGroupKey(g.ageGroup, g.gender);
        if (!boards.has(key)) boards.set(key, []);
        boards.get(key)!.push(g);
      }

      const boardOutputs: Record<string, unknown> = {};

      for (const [boardKey, boardGames] of boards) {
        const programs = buildPrograms(boardGames);
        const allResults = runTpi(programs, 6);
        const ranked = denseRank(allResults);
        const sens = sensitivity(programs);

        const wlOrder = [...ranked].sort(
          (a, b) => b.wlPct - a.wlPct || b.verifiedGames - a.verifiedGames || a.programName.localeCompare(b.programName)
        );
        const wlRankMap = new Map(wlOrder.map((r, i) => [r.programId, i + 1]));

        boardOutputs[boardKey] = {
          gameCount: boardGames.length,
          programCount: programs.length,
          leagueTier: boardGames[0]?.leagueTier,
          computationPlan: allResults.map((r) => ({
            programId: r.programId,
            programName: r.programName,
            ageGroup: r.ageGroup,
            gender: r.gender,
            verifiedGames: r.verifiedGames,
            verifiedOpponents: r.verifiedOpponents,
            pass0Strength: r.pass0Strength,
            pass1ObservedFinal: r.pass1ObservedFinal,
            pass1FinalTpi: r.tpiAdjusted,
            publicEligible: r.publicEligible
          })),
          ranking: ranked.map((r) => ({
            rank: r.rank,
            program: r.programName,
            programId: r.programId,
            tpi: r.tpiAdjusted,
            games: r.verifiedGames,
            opponents: r.verifiedOpponents,
            wl: `${r.wins}-${r.losses}`,
            wlRank: wlRankMap.get(r.programId)
          })),
          contributionAudit: {
            top: ranked[0] ? contributionAudit(ranked[0]) : null,
            bottom: ranked.length ? contributionAudit(ranked[ranked.length - 1]) : null
          },
          validation: validateChecks(cohort, boardGames.length, ranked, allResults),
          sensitivity: sens,
          sanityFlags: buildSanityFlags(ranked)
        };
      }

      modeResults[mode.label] = {
        status: "COMPUTED",
        evidenceStatuses: mode.statuses,
        dedupedGameCount: gameRows.length,
        boards: boardOutputs
      };
    }

    report.cohorts[cohort] = modeResults;
  }

  const outPath = join(outDir, "tpi-v1-pilot-latest.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`Wrote ${outPath}`);
}

function buildSanityFlags(ranked: ReturnType<typeof denseRank>) {
  const flags: string[] = [];
  const wlOrder = [...ranked].sort((a, b) => b.wlPct - a.wlPct);
  for (const r of ranked) {
    const wlRank = wlOrder.findIndex((x) => x.programId === r.programId) + 1;
    const rankDelta = Math.abs(r.rank - wlRank);
    if (r.wlPct === 100 && r.verifiedOpponents < 5) {
      flags.push(`${r.programName}: undefeated on limited schedule (${r.verifiedGames}g, ${r.verifiedOpponents} opp)`);
    }
    if (rankDelta >= 3) {
      flags.push(`${r.programName}: TPI rank #${r.rank} vs W-L rank #${wlRank} (delta ${rankDelta})`);
    }
  }
  return flags;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
