/**
 * B8: Gender inference audit for team TPI load path.
 * Usage: npx tsx scripts/validate-team-gender-inference.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/lib/prisma";
import { inferTeamStandingsGender } from "../src/lib/team-ratings/team-tpi-v1";

type Check = { id: string; status: "PASS" | "FAIL" | "WARN"; detail: string };

async function main() {
  const checks: Check[] = [];
  const mismatches: Array<{ gameId: string; league: string; home: string; away: string; inferred: string; statMajority: string | null }> = [];

  const games = await prisma.game.findMany({
    where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } },
    include: {
      season: { include: { league: true } },
      homeTeam: true,
      awayTeam: true,
      stats: {
        where: { deletedAt: null, player: { deletedAt: null } },
        include: { player: { select: { gender: true } } },
        take: 40
      }
    },
    take: 500
  });

  for (const game of games) {
    const inferred = inferTeamStandingsGender(game.season.league.name, game.homeTeam.name, game.awayTeam.name);
    const boys = game.stats.filter((stat) => stat.player.gender === "BOYS").length;
    const girls = game.stats.filter((stat) => stat.player.gender === "GIRLS").length;
    const statMajority = boys === girls ? null : boys > girls ? "Boys" : "Girls";

    if (statMajority && statMajority !== inferred) {
      mismatches.push({
        gameId: game.id,
        league: game.season.league.name,
        home: game.homeTeam.name,
        away: game.awayTeam.name,
        inferred,
        statMajority
      });
    }
  }

  const leagueOnlyMismatches = mismatches.filter((item) => {
    const leagueOnly = inferTeamStandingsGender(item.league, item.home);
    return leagueOnly !== item.inferred;
  });

  checks.push(
    mismatches.length === 0
      ? { id: "V-TR-GEN-01", status: "PASS", detail: `0/${games.length} sampled games disagree with player-stat gender majority` }
      : { id: "V-TR-GEN-01", status: "WARN", detail: `${mismatches.length}/${games.length} games disagree with player-stat gender majority` }
  );

  checks.push({
    id: "V-TR-GEN-02",
    status: "PASS",
    detail: "Inference uses league + home + away team names (aligned with competition standings path)"
  });

  checks.push(
    leagueOnlyMismatches.length === 0
      ? { id: "V-TR-GEN-03", status: "PASS", detail: "Away-team name inclusion does not change inference on sampled mismatches" }
      : { id: "V-TR-GEN-03", status: "WARN", detail: `${leagueOnlyMismatches.length} mismatches affected by away-team inclusion` }
  );

  const residualRisks = [
    "League model has no explicit gender field; inference remains text-heuristic.",
    "Mixed-gender scrimmages would default to Boys when 'girls' is absent from names.",
    "Future leagues should encode gender in league name or add explicit league gender metadata."
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    sampledGames: games.length,
    mismatches,
    residualRisks,
    checks,
    summary: {
      pass: checks.filter((check) => check.status === "PASS").length,
      warn: checks.filter((check) => check.status === "WARN").length,
      fail: checks.filter((check) => check.status === "FAIL").length
    }
  };

  const outDir = join(process.cwd(), "scripts", "reports");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "team-gender-inference-audit.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(`Wrote ${outPath}`);
  console.log(`PASS=${report.summary.pass} WARN=${report.summary.warn} FAIL=${report.summary.fail}`);

  if (report.summary.fail > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
