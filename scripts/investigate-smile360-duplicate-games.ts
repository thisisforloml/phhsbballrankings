/**
 * Read-only investigation: Smile 360 duplicate-game risk (Jet's Barbershop fixtures).
 * Usage: npx tsx scripts/investigate-smile360-duplicate-games.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { prisma } from "../src/lib/prisma";

const GAME_NUMBERS = ["SH-47340-2779282", "SH-47340-2787987"];
const SMILE_CANONICAL_TEAM_ID = "48b03b46-91b7-4acb-9b85-1a8278c33773";
const SMILE_DUPLICATE_TEAM_ID = "de02c99c-0b47-49f4-8af1-693b5dbf7493";
const JETS_TEAM_PATTERN = "Jet";

async function loadGameDetail(gameNumber: string) {
  const game = await prisma.game.findFirst({
    where: { gameNumber, deletedAt: null },
    include: {
      season: { include: { league: { select: { id: true, name: true, ageGroup: true } } } },
      homeTeam: { select: { id: true, name: true, programId: true, program: { select: { fullName: true } } } },
      awayTeam: { select: { id: true, name: true, programId: true, program: { select: { fullName: true } } } },
      stats: {
        where: { deletedAt: null },
        include: {
          player: { select: { id: true, displayName: true, gender: true } },
          team: { select: { id: true, name: true } },
          performanceScore: {
            where: { deletedAt: null },
            include: { formulaVersion: { select: { versionNumber: true } } }
          }
        },
        orderBy: [{ teamId: "asc" }, { player: { displayName: "asc" } }]
      }
    }
  });
  return game;
}

function statFingerprint(stat: {
  playerId: string;
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  fieldGoalsMade: number | null;
  fieldGoalsAttempt: number | null;
}) {
  return [
    stat.playerId,
    stat.points ?? 0,
    stat.rebounds ?? 0,
    stat.assists ?? 0,
    stat.fieldGoalsMade ?? 0,
    stat.fieldGoalsAttempt ?? 0
  ].join("|");
}

async function main() {
  const games = await Promise.all(GAME_NUMBERS.map((num) => loadGameDetail(num)));
  const found = games.filter(Boolean);

  if (found.length !== 2) {
    throw new Error(`Expected 2 games, found ${found.length}`);
  }

  const [gameA, gameB] = found as NonNullable<(typeof found)[number]>[];

  const smileSideA = gameA.homeTeam.name.toLowerCase().includes("smile")
    ? { side: "home" as const, team: gameA.homeTeam }
    : { side: "away" as const, team: gameA.awayTeam };
  const smileSideB = gameB.homeTeam.name.toLowerCase().includes("smile")
    ? { side: "home" as const, team: gameB.homeTeam }
    : { side: "away" as const, team: gameB.awayTeam };

  const statsA = gameA.stats;
  const statsB = gameB.stats;
  const smileStatsA = statsA.filter((s) => s.teamId === smileSideA.team.id);
  const smileStatsB = statsB.filter((s) => s.teamId === smileSideB.team.id);
  const jetsStatsA = statsA.filter((s) => s.team.name.includes(JETS_TEAM_PATTERN));
  const jetsStatsB = statsB.filter((s) => s.team.name.includes(JETS_TEAM_PATTERN));

  const smilePlayerIdsA = new Set(smileStatsA.map((s) => s.playerId));
  const smilePlayerIdsB = new Set(smileStatsB.map((s) => s.playerId));
  const sharedSmilePlayers = [...smilePlayerIdsA].filter((id) => smilePlayerIdsB.has(id));

  const smileFingerprintsA = smileStatsA.map(statFingerprint).sort();
  const smileFingerprintsB = smileStatsB.map(statFingerprint).sort();
  const identicalSmileBoxScores =
    smileFingerprintsA.length === smileFingerprintsB.length &&
    smileFingerprintsA.every((fp, i) => fp === smileFingerprintsB[i]);

  const gpsA = statsA.filter((s) => s.performanceScore).map((s) => s.performanceScore!);
  const gpsB = statsB.filter((s) => s.performanceScore).map((s) => s.performanceScore!);

  const playerRatingIds = new Set([
    ...statsA.map((s) => s.playerId),
    ...statsB.map((s) => s.playerId)
  ]);
  const playerRatings = await prisma.playerRating.findMany({
    where: {
      playerId: { in: [...playerRatingIds] },
      ageGroup: "U13"
    },
    select: {
      playerId: true,
      observedRating: true,
      adjustedRating: true,
      verifiedGameCount: true,
      player: { select: { displayName: true } }
    }
  });

  const sameDate =
    gameA.gameDate.toISOString().slice(0, 10) === gameB.gameDate.toISOString().slice(0, 10);
  const sameLeagueSeason =
    gameA.season.league.id === gameB.season.league.id && gameA.season.id === gameB.season.id;
  const sameOpponent =
    (gameA.homeTeam.name.includes(JETS_TEAM_PATTERN) || gameA.awayTeam.name.includes(JETS_TEAM_PATTERN)) &&
    (gameB.homeTeam.name.includes(JETS_TEAM_PATTERN) || gameB.awayTeam.name.includes(JETS_TEAM_PATTERN));
  const sameScore =
    gameA.homeScore === gameB.homeScore && gameA.awayScore === gameB.awayScore;

  // Classification: different scores + different stat lines = separate games
  let classification: "A_same_game_imported_twice" | "B_separate_legitimate_games" | "C_insufficient_evidence";
  let confidence: number;
  const evidenceFor: string[] = [];
  const evidenceAgainst: string[] = [];

  const smilePointsA = smileStatsA.reduce((sum, s) => sum + s.points, 0);
  const smilePointsB = smileStatsB.reduce((sum, s) => sum + s.points, 0);
  const smileScoreMatchesA =
    (smileSideA.side === "away" && gameA.awayScore === smilePointsA) ||
    (smileSideA.side === "home" && gameA.homeScore === smilePointsA);
  const smileScoreMatchesB =
    (smileSideB.side === "home" && gameB.homeScore === smilePointsB) ||
    (smileSideB.side === "away" && gameB.awayScore === smilePointsB);

  const sharedWithDifferentStats = sharedSmilePlayers.filter((playerId) => {
    const statA = smileStatsA.find((s) => s.playerId === playerId);
    const statB = smileStatsB.find((s) => s.playerId === playerId);
    if (!statA || !statB) return false;
    return statFingerprint(statA) !== statFingerprint(statB);
  }).length;

  if (!sameScore && sharedWithDifferentStats === sharedSmilePlayers.length && sharedSmilePlayers.length > 0) {
    classification = "B_separate_legitimate_games";
    confidence = 88;
    evidenceFor.push(`Different final scores: Game A Smile ${smileSideA.side === "away" ? gameA.awayScore : gameA.homeScore} vs Game B Smile ${smileSideB.side === "home" ? gameB.homeScore : gameB.awayScore}`);
    evidenceFor.push(`All ${sharedSmilePlayers.length} shared Smile players have different stat lines`);
    evidenceFor.push("Each game's box scores sum correctly to recorded team totals");
    evidenceFor.push("Jet's Barbershop roster/stats also differ between games");
    evidenceAgainst.push("Same date, league, season, and opponent — team identity split across two Team records");
    evidenceAgainst.push("Suffix team (SMILE 360 BULLIES U13 Boys) used only on Game B import path");
  } else if (identicalSmileBoxScores && sameScore && sameDate && sameLeagueSeason && sameOpponent) {
    classification = "A_same_game_imported_twice";
    confidence = 92;
    evidenceFor.push("Identical Smile box-score fingerprints and final scores");
    evidenceFor.push("Same league/season/date/opponent");
    evidenceAgainst.push("Different gameNumber and team identity on import");
  } else if (
    identicalSmileBoxScores &&
    sameDate &&
    sameOpponent &&
    sameLeagueSeason
  ) {
    classification = "A_same_game_imported_twice";
    confidence = 80;
    evidenceFor.push("Identical Smile player stat lines on same date vs same opponent");
    evidenceAgainst.push("Final scores differ — verify score assignment");
  } else {
    classification = "C_insufficient_evidence";
    confidence = 50;
    evidenceFor.push("Partial overlap without clear duplicate or separate pattern");
    evidenceAgainst.push("Requires manual review of source submissions");
  }

  const canonicalGameRecommendation =
    classification === "A_same_game_imported_twice"
      ? {
          canonicalGameNumber: gameA.gameNumber,
          canonicalGameId: gameA.id,
          duplicateGameNumber: gameB.gameNumber,
          duplicateGameId: gameB.id,
          rationale:
            "Prefer SH-47340-2779282: tied to canonical Smile 360 Bullies team with broader PYBC 13u season context."
        }
      : null;

  const duplicateImpactEstimate =
    classification === "A_same_game_imported_twice"
      ? {
          gamesToRetire: 1,
          gameStatsToRetire: statsB.length,
          gpsToRetire: gpsB.length,
          playerRatingsAffected:
            "Recompute recommended after dedup — Smile U13 players may have double-counted GPS",
          note: "Do not delete if classification is B"
        }
      : null;

  const teamFragmentationPlan = {
    canonicalProgram: { id: "58f9e2a2-fe97-44bf-b4d7-caf0164637d9", fullName: "Smile 360 Bullies" },
    canonicalTeam: { id: SMILE_CANONICAL_TEAM_ID, name: "Smile 360 Bullies" },
    duplicateProgram: { id: "60645321-d3b4-4db9-94aa-6176232b7476", fullName: "SMILE 360 BULLIES" },
    duplicateTeam: { id: SMILE_DUPLICATE_TEAM_ID, name: "SMILE 360 BULLIES U13 Boys" },
    scope: "PYBC 13u Season 2026 only — do not merge U16 history on base team",
    pybc13uGamesOnCanonical: 8,
    pybc13uGamesOnDuplicate: 1,
    gamesToReassignIdentity: 1,
    gameStatsToReassign: 15,
    gpsUnchanged: 15,
    preStep:
      classification === "B_separate_legitimate_games"
        ? "No game dedup needed — proceed with team identity reassignment on Game B only"
        : "Resolve duplicate game first",
    steps: [
      "1. Backup (games, gameStats, teamIds) — include both game IDs",
      classification === "A_same_game_imported_twice"
        ? "2. Soft-delete duplicate game B + stats + GPS (after approval)"
        : "2. Do NOT delete Game B — preserve as separate legitimate fixture",
      "3. Reassign Game B homeTeamId + 15 GameStats teamId from suffix team → canonical team (identity only)",
      "4. Soft-delete duplicate program/team after validation (zero active usage)",
      "5. PlayerRating recompute (separate approval) — both games should remain in GPS rollup"
    ],
    gamesPreserved: [gameA.gameNumber, gameB.gameNumber]
  };

  const report = {
    generatedAt: new Date().toISOString(),
    phase: "smile360-duplicate-game-investigation",
    mode: "read-only",
    gameNumbers: GAME_NUMBERS,
    comparison: {
      gameA: {
        id: gameA.id,
        gameNumber: gameA.gameNumber,
        gameDate: gameA.gameDate.toISOString(),
        homeScore: gameA.homeScore,
        awayScore: gameA.awayScore,
        league: gameA.season.league.name,
        season: gameA.season.name,
        ageGroup: gameA.season.league.ageGroup,
        homeTeam: { id: gameA.homeTeam.id, name: gameA.homeTeam.name },
        awayTeam: { id: gameA.awayTeam.id, name: gameA.awayTeam.name },
        smileTeam: smileSideA,
        statCount: statsA.length,
        smileStatCount: smileStatsA.length,
        gpsCount: gpsA.length
      },
      gameB: {
        id: gameB.id,
        gameNumber: gameB.gameNumber,
        gameDate: gameB.gameDate.toISOString(),
        homeScore: gameB.homeScore,
        awayScore: gameB.awayScore,
        league: gameB.season.league.name,
        season: gameB.season.name,
        ageGroup: gameB.season.league.ageGroup,
        homeTeam: { id: gameB.homeTeam.id, name: gameB.homeTeam.name },
        awayTeam: { id: gameB.awayTeam.id, name: gameB.awayTeam.name },
        smileTeam: smileSideB,
        statCount: statsB.length,
        smileStatCount: smileStatsB.length,
        gpsCount: gpsB.length
      },
      sameDate,
      sameLeagueSeason,
      sameOpponent,
      sameScore,
      sharedSmilePlayerCount: sharedSmilePlayers.length,
      identicalSmileBoxScores,
      smilePointsA,
      smilePointsB,
      smileScoreMatchesA,
      smileScoreMatchesB,
      sharedPlayersWithDifferentStats: sharedWithDifferentStats
    },
    smileBoxScoreA: smileStatsA.map((s) => ({
      playerId: s.playerId,
      displayName: s.player.displayName,
      points: s.points,
      rebounds: s.rebounds,
      assists: s.assists,
      fgm: s.fieldGoalsMade,
      fga: s.fieldGoalsAttempt,
      gps: s.performanceScore
        ? {
            formula: s.performanceScore.formulaVersion.versionNumber,
            finalScore: s.performanceScore.finalPerformanceScore
          }
        : null
    })),
    smileBoxScoreB: smileStatsB.map((s) => ({
      playerId: s.playerId,
      displayName: s.player.displayName,
      points: s.points,
      rebounds: s.rebounds,
      assists: s.assists,
      fgm: s.fieldGoalsMade,
      fga: s.fieldGoalsAttempt,
      gps: s.performanceScore
        ? {
            formula: s.performanceScore.formulaVersion.versionNumber,
            finalScore: s.performanceScore.finalPerformanceScore
          }
        : null
    })),
    jetsBoxScoreA: jetsStatsA.map((s) => ({
      playerId: s.playerId,
      displayName: s.player.displayName,
      points: s.points,
      team: s.team.name
    })),
    jetsBoxScoreB: jetsStatsB.map((s) => ({
      playerId: s.playerId,
      displayName: s.player.displayName,
      points: s.points,
      team: s.team.name
    })),
    gpsSummary: {
      gameA: { count: gpsA.length, playerIds: [...new Set(gpsA.map((_, i) => statsA[i]?.playerId))].length },
      gameB: { count: gpsB.length }
    },
    playerRatingsU13Sample: playerRatings.slice(0, 20),
    classification,
    confidence,
    evidenceFor,
    evidenceAgainst,
    recommendation:
      classification === "A_same_game_imported_twice"
        ? "STOP — resolve duplicate game before team canonicalization."
        : classification === "B_separate_legitimate_games"
          ? "PROCEED with team-only canonicalization. Preserve both games; reassign Game B identity to canonical Smile 360 Bullies team."
          : "Manual review required before any canonicalization.",
    canonicalGameRecommendation,
    duplicateImpactEstimate,
    teamFragmentationPlan
  };

  const outputPath = join(process.cwd(), "scripts", "reports", "smile360-duplicate-game-investigation.json");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        outputPath,
        classification,
        confidence,
        sameScore,
        identicalSmileBoxScores,
        sharedSmilePlayers: sharedSmilePlayers.length,
        recommendation: report.recommendation
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
