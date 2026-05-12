import { readFileSync } from "node:fs";
import { PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const dataFilePath = "D:\\OnCourt Rankings PH\\scripts\\data\\uaap-s88-hs-boys-10-games.json";
const seasonId = "77858fdc-9a0b-4b4a-8820-4ad0a105a8a9";

type SourcePlayer = {
  name?: unknown;
  team?: unknown;
  PTS?: unknown;
};

type SourceGame = {
  gameNumber?: unknown;
  homeTeamName?: unknown;
  awayTeamName?: unknown;
  players?: SourcePlayer[];
};

type SourceData = {
  games?: SourceGame[];
};

function cleanPlayerName(name: unknown) {
  if (typeof name !== "string") {
    throw new Error(`Invalid player name: ${String(name)}`);
  }

  const cleaned = name.replace(/^\*+/, "").trim();

  if (!cleaned) {
    throw new Error("Encountered an empty player name after cleaning.");
  }

  return cleaned;
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing or invalid ${label}.`);
  }

  return value.trim();
}

function requiredNumber(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Missing or invalid ${label}.`);
  }

  return value;
}

function loadSourceData() {
  const raw = readFileSync(dataFilePath, "utf8");
  const data = JSON.parse(raw) as SourceData;

  if (!Array.isArray(data.games)) {
    throw new Error("Expected data.games to be an array.");
  }

  return data;
}

async function findMatchingGame(gameNumber: string) {
  return prisma.game.findMany({
    where: {
      gameNumber,
      seasonId,
      deletedAt: null
    },
    include: {
      homeTeam: {
        select: {
          id: true,
          name: true
        }
      },
      awayTeam: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
}

async function findMatchingPlayer(displayName: string) {
  return prisma.player.findMany({
    where: {
      displayName,
      gender: PlayerGender.BOYS,
      deletedAt: null
    },
    select: {
      id: true,
      displayName: true,
      gender: true
    }
  });
}

async function findMatchingTeam(teamName: string) {
  return prisma.team.findMany({
    where: {
      name: teamName,
      deletedAt: null
    },
    select: {
      id: true,
      name: true
    }
  });
}

async function findDuplicateActivePlayers(displayNames: string[]) {
  const duplicates = [];

  for (const displayName of displayNames) {
    const matches = await findMatchingPlayer(displayName);

    if (matches.length > 1) {
      duplicates.push({
        displayName,
        gender: PlayerGender.BOYS,
        count: matches.length,
        ids: matches.map((player) => player.id)
      });
    }
  }

  return duplicates;
}

async function findDuplicateActiveTeams(teamNames: string[]) {
  const duplicates = [];

  for (const teamName of teamNames) {
    const matches = await findMatchingTeam(teamName);

    if (matches.length > 1) {
      duplicates.push({
        name: teamName,
        count: matches.length,
        ids: matches.map((team) => team.id)
      });
    }
  }

  return duplicates;
}

async function main() {
  const data = loadSourceData();
  const missingGames = [];
  const missingPlayers = [];
  const missingGameStats = [];
  const teamMismatches = [];
  const pointTotalChecks = [];
  const gameIds = new Set<string>();
  const sourceNames = new Set<string>();
  const sourceTeamNames = new Set<string>();
  let totalPlayerRowsInJson = 0;
  let gamesMatched = 0;
  let playersMatched = 0;
  let gameStatsMatched = 0;

  for (const sourceGame of data.games!) {
    const gameNumber = requiredString(sourceGame.gameNumber, "gameNumber");
    const homeTeamName = requiredString(sourceGame.homeTeamName, "homeTeamName");
    const awayTeamName = requiredString(sourceGame.awayTeamName, "awayTeamName");
    const players = Array.isArray(sourceGame.players) ? sourceGame.players : [];
    sourceTeamNames.add(homeTeamName);
    sourceTeamNames.add(awayTeamName);

    if (!Array.isArray(sourceGame.players)) {
      missingGames.push({
        gameNumber,
        reason: "Source game is missing players array."
      });
      continue;
    }

    const gameMatches = await findMatchingGame(gameNumber);

    if (gameMatches.length !== 1) {
      missingGames.push({
        gameNumber,
        matchesFound: gameMatches.length,
        reason: "Expected exactly one active Game by gameNumber + seasonId."
      });
      totalPlayerRowsInJson += players.length;
      continue;
    }

    const game = gameMatches[0];
    gamesMatched += 1;
    gameIds.add(game.id);
    let summedHomePlayerPoints = 0;
    let summedAwayPlayerPoints = 0;

    for (const sourcePlayer of players) {
      totalPlayerRowsInJson += 1;
      const displayName = cleanPlayerName(sourcePlayer.name);
      const teamName = requiredString(sourcePlayer.team, "player.team");
      const points = requiredNumber(sourcePlayer.PTS, "PTS");
      sourceNames.add(displayName);
      sourceTeamNames.add(teamName);

      const playerMatches = await findMatchingPlayer(displayName);

      if (playerMatches.length !== 1) {
        missingPlayers.push({
          gameNumber,
          displayName,
          matchesFound: playerMatches.length,
          reason: "Expected exactly one active BOYS Player by displayName + gender."
        });
        continue;
      }

      const player = playerMatches[0];
      playersMatched += 1;
      const gameStat = await prisma.gameStat.findUnique({
        where: {
          gameId_playerId: {
            gameId: game.id,
            playerId: player.id
          }
        }
      });

      if (!gameStat) {
        missingGameStats.push({
          gameNumber,
          displayName,
          gameId: game.id,
          playerId: player.id,
          reason: "Expected exactly one GameStat by gameId + playerId."
        });
        continue;
      }

      gameStatsMatched += 1;
      const expectedTeamId = teamName === homeTeamName ? game.homeTeamId : teamName === awayTeamName ? game.awayTeamId : null;

      if (!expectedTeamId) {
        teamMismatches.push({
          gameNumber,
          displayName,
          sourceTeam: teamName,
          reason: "Source player team is not one of the source game teams."
        });
      } else if (gameStat.teamId !== expectedTeamId) {
        teamMismatches.push({
          gameNumber,
          displayName,
          sourceTeam: teamName,
          expectedTeamId,
          actualTeamId: gameStat.teamId,
          reason: "GameStat teamId does not match source player team."
        });
      }

      if (teamName === homeTeamName) {
        summedHomePlayerPoints += points;
      } else if (teamName === awayTeamName) {
        summedAwayPlayerPoints += points;
      }
    }

    pointTotalChecks.push({
      gameNumber,
      homeTeam: game.homeTeam.name,
      awayTeam: game.awayTeam.name,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      summedHomePlayerPoints,
      summedAwayPlayerPoints,
      pointsMatchHomeScore: summedHomePlayerPoints === game.homeScore,
      pointsMatchAwayScore: summedAwayPlayerPoints === game.awayScore
    });
  }

  const totalGameStatRowsForGames = await prisma.gameStat.count({
    where: {
      gameId: {
        in: [...gameIds]
      },
      deletedAt: null
    }
  });
  const duplicateActivePlayers = await findDuplicateActivePlayers([...sourceNames].sort((left, right) => left.localeCompare(right)));
  const duplicateActiveTeams = await findDuplicateActiveTeams([...sourceTeamNames].sort((left, right) => left.localeCompare(right)));
  const gameStatRowCountMatchesJson = totalGameStatRowsForGames === totalPlayerRowsInJson;
  const validationPassed =
    missingGames.length === 0 &&
    missingPlayers.length === 0 &&
    missingGameStats.length === 0 &&
    teamMismatches.length === 0 &&
    pointTotalChecks.every((check) => check.pointsMatchHomeScore && check.pointsMatchAwayScore) &&
    gameStatRowCountMatchesJson &&
    duplicateActivePlayers.length === 0 &&
    duplicateActiveTeams.length === 0;

  console.log(
    JSON.stringify(
      {
        totalGamesInJson: data.games!.length,
        totalPlayerRowsInJson,
        gamesMatched,
        playersMatched,
        gameStatsMatched,
        totalGameStatRowsForGames,
        gameStatRowCountMatchesJson,
        missingGames,
        missingPlayers,
        missingGameStats,
        teamMismatches,
        pointTotalChecks,
        duplicateActivePlayers,
        duplicateActiveTeams,
        validationPassed
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
