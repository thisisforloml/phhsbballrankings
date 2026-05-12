import { readFileSync } from "node:fs";
import { PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const dataFilePath = "D:\\OnCourt Rankings PH\\scripts\\data\\uaap-s88-hs-boys-10-games.json";
const seasonId = "77858fdc-9a0b-4b4a-8820-4ad0a105a8a9";

type SourcePlayer = {
  name?: unknown;
  team?: unknown;
  MIN?: unknown;
  PTS?: unknown;
  FGM?: unknown;
  FGA?: unknown;
  "3PM"?: unknown;
  "3PA"?: unknown;
  FTM?: unknown;
  FTA?: unknown;
  OREB?: unknown;
  DREB?: unknown;
  TRB?: unknown;
  AST?: unknown;
  STL?: unknown;
  BLK?: unknown;
  TOV?: unknown;
  PF?: unknown;
  FD?: unknown;
  "+/-"?: unknown;
};

type SourceGame = {
  gameNumber?: unknown;
  homeTeamName?: unknown;
  awayTeamName?: unknown;
  homeScore?: unknown;
  awayScore?: unknown;
  players?: SourcePlayer[];
};

type SourceData = {
  games?: SourceGame[];
};

type SkippedRow = {
  gameNumber: string;
  playerName: string;
  teamName: string;
  reason: string;
};

type ResolvedGame = Awaited<ReturnType<typeof resolveGame>>;
type ResolvedTeams = Awaited<ReturnType<typeof resolveGameTeams>>;

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

function isStarter(name: unknown) {
  return typeof name === "string" && name.trim().startsWith("*");
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

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseMinutes(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Number(value.toFixed(2));
  }

  if (typeof value !== "string") {
    throw new Error(`Invalid MIN value: ${String(value)}`);
  }

  const match = value.trim().match(/^(\d+):(\d{2})$/);

  if (!match) {
    throw new Error(`Invalid MIN format: ${value}`);
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);

  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds > 59) {
    throw new Error(`Invalid MIN value: ${value}`);
  }

  return Number((minutes + seconds / 60).toFixed(2));
}

function loadSourceData() {
  const raw = readFileSync(dataFilePath, "utf8");
  const data = JSON.parse(raw) as SourceData;

  if (!Array.isArray(data.games)) {
    throw new Error("Expected data.games to be an array.");
  }

  return data;
}

async function resolveGame(gameNumber: string) {
  const matches = await prisma.game.findMany({
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

  if (matches.length === 0) {
    throw new Error(`Expected active game not found for gameNumber: ${gameNumber}`);
  }

  if (matches.length > 1) {
    throw new Error(`Multiple active games found for gameNumber: ${gameNumber}`);
  }

  return matches[0];
}

async function resolveGameTeams(sourceGame: SourceGame) {
  const homeTeamName = requiredString(sourceGame.homeTeamName, "homeTeamName");
  const awayTeamName = requiredString(sourceGame.awayTeamName, "awayTeamName");
  const teamNames = [homeTeamName, awayTeamName];
  const teams = new Map<string, { id: string; name: string }>();

  for (const teamName of teamNames) {
    const matches = await prisma.team.findMany({
      where: {
        name: teamName,
        deletedAt: null
      },
      select: {
        id: true,
        name: true
      }
    });

    if (matches.length === 0) {
      throw new Error(`Expected active team not found: ${teamName}`);
    }

    if (matches.length > 1) {
      throw new Error(`Multiple active teams found for: ${teamName}`);
    }

    teams.set(teamName, matches[0]);
  }

  return {
    homeTeamName,
    awayTeamName,
    homeTeam: teams.get(homeTeamName)!,
    awayTeam: teams.get(awayTeamName)!
  };
}

async function resolvePlayer(displayName: string) {
  const matches = await prisma.player.findMany({
    where: {
      displayName,
      gender: PlayerGender.BOYS,
      deletedAt: null
    },
    select: {
      id: true,
      displayName: true
    }
  });

  if (matches.length === 0) {
    throw new Error(`Expected active BOYS player not found: ${displayName}`);
  }

  if (matches.length > 1) {
    throw new Error(`Multiple active BOYS players found for displayName: ${displayName}`);
  }

  return matches[0];
}

function mapStatData(sourcePlayer: SourcePlayer, gameId: string, playerId: string, teamId: string) {
  const points = requiredNumber(sourcePlayer.PTS, "PTS");
  const rebounds = requiredNumber(sourcePlayer.TRB, "TRB");
  const assists = requiredNumber(sourcePlayer.AST, "AST");
  const fieldGoalsMade = optionalNumber(sourcePlayer.FGM);
  const fieldGoalsAttempt = optionalNumber(sourcePlayer.FGA);
  const threeMade = optionalNumber(sourcePlayer["3PM"]);
  const threeAttempt = optionalNumber(sourcePlayer["3PA"]);

  return {
    gameId,
    playerId,
    teamId,
    jerseyNumber: null,
    starter: isStarter(sourcePlayer.name),
    minutes: parseMinutes(sourcePlayer.MIN),
    points,
    offensiveRebounds: optionalNumber(sourcePlayer.OREB),
    defensiveRebounds: optionalNumber(sourcePlayer.DREB),
    rebounds,
    assists,
    steals: optionalNumber(sourcePlayer.STL),
    blocks: optionalNumber(sourcePlayer.BLK),
    turnovers: optionalNumber(sourcePlayer.TOV),
    fouls: optionalNumber(sourcePlayer.PF),
    foulsDrawn: optionalNumber(sourcePlayer.FD),
    plusMinus: optionalNumber(sourcePlayer["+/-"]),
    fieldGoalsMade,
    fieldGoalsAttempt,
    twoMade: fieldGoalsMade === null || threeMade === null ? null : fieldGoalsMade - threeMade,
    twoAttempt: fieldGoalsAttempt === null || threeAttempt === null ? null : fieldGoalsAttempt - threeAttempt,
    threeMade,
    threeAttempt,
    freeThrowsMade: optionalNumber(sourcePlayer.FTM),
    freeThrowsAttempt: optionalNumber(sourcePlayer.FTA)
  };
}

async function processPlayerRow(
  sourceGame: SourceGame,
  sourcePlayer: SourcePlayer,
  game: NonNullable<ResolvedGame>,
  teams: ResolvedTeams,
  skippedRows: SkippedRow[]
) {
  const gameNumber = requiredString(sourceGame.gameNumber, "gameNumber");
  const rawPlayerName = typeof sourcePlayer.name === "string" ? sourcePlayer.name : String(sourcePlayer.name);
  const playerName = cleanPlayerName(sourcePlayer.name);
  const teamName = typeof sourcePlayer.team === "string" ? sourcePlayer.team.trim() : "";

  try {
    if (!teamName) {
      throw new Error("Missing or invalid player team.");
    }

    const team = teamName === teams.homeTeamName ? teams.homeTeam : teamName === teams.awayTeamName ? teams.awayTeam : null;

    if (!team) {
      throw new Error(`Player team ${teamName} is not one of the game teams.`);
    }

    if (team.id !== game.homeTeamId && team.id !== game.awayTeamId) {
      throw new Error(`Resolved team ${teamName} does not match the stored game teams.`);
    }

    const player = await resolvePlayer(playerName);
    const statData = mapStatData(sourcePlayer, game.id, player.id, team.id);
    const existing = await prisma.gameStat.findUnique({
      where: {
        gameId_playerId: {
          gameId: game.id,
          playerId: player.id
        }
      }
    });

    if (existing) {
      const updated = await prisma.gameStat.update({
        where: {
          gameId_playerId: {
            gameId: game.id,
            playerId: player.id
          }
        },
        data: statData
      });

      return { action: "updated" as const, record: updated, teamName };
    }

    const created = await prisma.gameStat.create({
      data: statData
    });

    return { action: "created" as const, record: created, teamName };
  } catch (error) {
    skippedRows.push({
      gameNumber,
      playerName: rawPlayerName,
      teamName,
      reason: error instanceof Error ? error.message : String(error)
    });

    return null;
  }
}

async function main() {
  const data = loadSourceData();
  const skippedRows: SkippedRow[] = [];
  const perGameStatPointTotals = [];
  let totalPlayerRowsProcessed = 0;
  let gameStatsCreated = 0;
  let gameStatsUpdated = 0;

  for (const sourceGame of data.games!) {
    const gameNumber = requiredString(sourceGame.gameNumber, "gameNumber");
    const homeScore = requiredNumber(sourceGame.homeScore, "homeScore");
    const awayScore = requiredNumber(sourceGame.awayScore, "awayScore");
    const players = Array.isArray(sourceGame.players) ? sourceGame.players : [];
    const game = await resolveGame(gameNumber);
    const teams = await resolveGameTeams(sourceGame);
    let summedHomePlayerPoints = 0;
    let summedAwayPlayerPoints = 0;

    if (!Array.isArray(sourceGame.players)) {
      throw new Error(`Expected players array for gameNumber: ${gameNumber}`);
    }

    for (const sourcePlayer of players) {
      totalPlayerRowsProcessed += 1;
      const result = await processPlayerRow(sourceGame, sourcePlayer, game, teams, skippedRows);

      if (!result) {
        continue;
      }

      if (result.action === "created") {
        gameStatsCreated += 1;
      } else {
        gameStatsUpdated += 1;
      }

      if (result.teamName === teams.homeTeamName) {
        summedHomePlayerPoints += result.record.points;
      } else if (result.teamName === teams.awayTeamName) {
        summedAwayPlayerPoints += result.record.points;
      }
    }

    perGameStatPointTotals.push({
      gameNumber,
      homeTeam: teams.homeTeamName,
      awayTeam: teams.awayTeamName,
      homeScore,
      awayScore,
      summedHomePlayerPoints,
      summedAwayPlayerPoints,
      pointsMatchHomeScore: summedHomePlayerPoints === homeScore,
      pointsMatchAwayScore: summedAwayPlayerPoints === awayScore
    });
  }

  console.log(
    JSON.stringify(
      {
        totalGamesProcessed: data.games!.length,
        totalPlayerRowsProcessed,
        gameStatsCreated,
        gameStatsUpdated,
        skippedRows,
        perGameStatPointTotals
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
