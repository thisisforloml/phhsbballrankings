import { readFileSync } from "node:fs";
import path from "node:path";
import { PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const projectRoot = "D:\\OnCourt Rankings PH";

const batchFiles = [
  { path: "scripts/data/uaap-s88-hs-boys-batch-01.json", gender: PlayerGender.BOYS },
  { path: "scripts/data/uaap-s88-hs-boys-batch-02.json", gender: PlayerGender.BOYS },
  { path: "scripts/data/uaap-s88-hs-boys-batch-03.json", gender: PlayerGender.BOYS },
  { path: "scripts/data/uaap-s88-hs-boys-batch-04.json", gender: PlayerGender.BOYS },
  { path: "scripts/data/uaap-s88-hs-boys-batch-05.json", gender: PlayerGender.BOYS },
  { path: "scripts/data/uaap-s88-hs-boys-batch-06.json", gender: PlayerGender.BOYS },
  { path: "scripts/data/uaap-s88-hs-girls-batch-01.json", gender: PlayerGender.GIRLS },
  { path: "scripts/data/uaap-s88-hs-girls-batch-02.json", gender: PlayerGender.GIRLS }
] as const;

type SourceLeague = { name?: unknown; ageGroup?: unknown };
type SourceSeason = { name?: unknown };
type SourcePlayer = Record<string, unknown>;
type SourceGame = Record<string, unknown> & { players?: SourcePlayer[] };
type SourceData = { league?: SourceLeague; season?: SourceSeason; games?: SourceGame[] };
type SkippedRow = { file: string; gameNumber: string; playerName: string; teamName: string; reason: string };

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

function cleanPlayerName(name: unknown) {
  const raw = requiredString(name, "player.name");
  const cleaned = raw.replace(/^\*+/, "").trim();

  if (!cleaned) {
    throw new Error("Encountered an empty player name after cleaning.");
  }

  return cleaned;
}

function isStarter(name: unknown) {
  return typeof name === "string" && name.trim().startsWith("*");
}

function parseMinutes(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Number(value.toFixed(2));
  }

  const raw = requiredString(value, "MIN");
  const match = raw.match(/^(\d+):(\d{2})$/);

  if (!match) {
    throw new Error(`Invalid MIN format: ${raw}`);
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);

  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds > 59) {
    throw new Error(`Invalid MIN value: ${raw}`);
  }

  return Number((minutes + seconds / 60).toFixed(2));
}

function loadBatch(relativePath: string) {
  const fullPath = path.join(projectRoot, relativePath);
  const raw = readFileSync(fullPath, "utf8");
  const data = JSON.parse(raw) as SourceData;

  if (!data.league) {
    throw new Error(`${relativePath} is missing league.`);
  }

  if (!data.season) {
    throw new Error(`${relativePath} is missing season.`);
  }

  if (!Array.isArray(data.games)) {
    throw new Error(`${relativePath} is missing games array.`);
  }

  return data;
}

async function resolveSeason(data: SourceData) {
  const leagueName = requiredString(data.league?.name, "league.name");
  const ageGroup = requiredString(data.league?.ageGroup, "league.ageGroup");
  const seasonName = requiredString(data.season?.name, "season.name");
  const league = await prisma.league.findFirst({
    where: {
      name: leagueName,
      ageGroup: ageGroup as never,
      deletedAt: null
    }
  });

  if (!league) {
    throw new Error(`Expected active league not found: ${leagueName} ${ageGroup}`);
  }

  const season = await prisma.season.findUnique({
    where: {
      leagueId_name: {
        leagueId: league.id,
        name: seasonName
      }
    }
  });

  if (!season || season.deletedAt !== null) {
    throw new Error(`Expected active season not found: ${seasonName} for ${leagueName}`);
  }

  return season;
}

async function resolveGame(gameNumber: string, seasonId: string) {
  const matches = await prisma.game.findMany({
    where: { gameNumber, seasonId, deletedAt: null },
    include: {
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } }
    }
  });

  if (matches.length !== 1) {
    throw new Error(`Expected exactly one active game for ${gameNumber}; found ${matches.length}.`);
  }

  return matches[0];
}

async function resolvePlayer(displayName: string, gender: PlayerGender) {
  const matches = await prisma.player.findMany({
    where: { displayName, gender, deletedAt: null },
    select: { id: true, displayName: true }
  });

  if (matches.length !== 1) {
    throw new Error(`Expected exactly one active ${gender} player for ${displayName}; found ${matches.length}.`);
  }

  return matches[0];
}

async function resolveTeam(teamName: string) {
  const matches = await prisma.team.findMany({
    where: { name: teamName, deletedAt: null },
    select: { id: true, name: true }
  });

  if (matches.length !== 1) {
    throw new Error(`Expected exactly one active team for ${teamName}; found ${matches.length}.`);
  }

  return matches[0];
}

function mapStatData(player: SourcePlayer, gameId: string, playerId: string, teamId: string) {
  const fieldGoalsMade = optionalNumber(player.FGM);
  const fieldGoalsAttempt = optionalNumber(player.FGA);
  const threeMade = optionalNumber(player["3PM"]);
  const threeAttempt = optionalNumber(player["3PA"]);

  return {
    gameId,
    playerId,
    teamId,
    jerseyNumber: null,
    starter: isStarter(player.name),
    minutes: parseMinutes(player.MIN),
    points: requiredNumber(player.PTS, "PTS"),
    offensiveRebounds: optionalNumber(player.OREB),
    defensiveRebounds: optionalNumber(player.DREB),
    rebounds: requiredNumber(player.TRB, "TRB"),
    assists: requiredNumber(player.AST, "AST"),
    steals: optionalNumber(player.STL),
    blocks: optionalNumber(player.BLK),
    turnovers: optionalNumber(player.TOV),
    fouls: optionalNumber(player.PF),
    foulsDrawn: optionalNumber(player.FD),
    plusMinus: optionalNumber(player["+/-"]),
    fieldGoalsMade,
    fieldGoalsAttempt,
    twoMade: fieldGoalsMade === null || threeMade === null ? null : fieldGoalsMade - threeMade,
    twoAttempt: fieldGoalsAttempt === null || threeAttempt === null ? null : fieldGoalsAttempt - threeAttempt,
    threeMade,
    threeAttempt,
    freeThrowsMade: optionalNumber(player.FTM),
    freeThrowsAttempt: optionalNumber(player.FTA)
  };
}

async function main() {
  const skippedRows: SkippedRow[] = [];
  const pointTotalChecks = [];
  let totalPlayerRowsProcessed = 0;
  let gameStatsCreated = 0;
  let gameStatsUpdated = 0;

  for (const batch of batchFiles) {
    const data = loadBatch(batch.path);
    const season = await resolveSeason(data);

    for (const sourceGame of data.games!) {
      const gameNumber = requiredString(sourceGame.gameNumber, "game.gameNumber");
      const homeTeamName = requiredString(sourceGame.homeTeamName, "game.homeTeamName");
      const awayTeamName = requiredString(sourceGame.awayTeamName, "game.awayTeamName");
      const homeScore = requiredNumber(sourceGame.homeScore, "game.homeScore");
      const awayScore = requiredNumber(sourceGame.awayScore, "game.awayScore");
      const game = await resolveGame(gameNumber, season.id);
      let summedHomePlayerPoints = 0;
      let summedAwayPlayerPoints = 0;

      for (const sourcePlayer of sourceGame.players ?? []) {
        totalPlayerRowsProcessed += 1;
        const playerName = cleanPlayerName(sourcePlayer.name);
        const teamName = requiredString(sourcePlayer.team, "player.team");

        try {
          if (teamName !== homeTeamName && teamName !== awayTeamName) {
            throw new Error(`Player team ${teamName} is not one of ${homeTeamName}/${awayTeamName}.`);
          }

          const team = await resolveTeam(teamName);
          const player = await resolvePlayer(playerName, batch.gender);
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
            await prisma.gameStat.update({
              where: { gameId_playerId: { gameId: game.id, playerId: player.id } },
              data: statData
            });
            gameStatsUpdated += 1;
          } else {
            await prisma.gameStat.create({ data: statData });
            gameStatsCreated += 1;
          }

          if (teamName === homeTeamName) {
            summedHomePlayerPoints += statData.points;
          } else {
            summedAwayPlayerPoints += statData.points;
          }
        } catch (error) {
          skippedRows.push({
            file: batch.path,
            gameNumber,
            playerName,
            teamName,
            reason: error instanceof Error ? error.message : String(error)
          });
        }
      }

      pointTotalChecks.push({
        file: batch.path,
        gameNumber,
        homeTeam: homeTeamName,
        awayTeam: awayTeamName,
        homeScore,
        awayScore,
        summedHomePlayerPoints,
        summedAwayPlayerPoints,
        pointsMatchHomeScore: summedHomePlayerPoints === homeScore,
        pointsMatchAwayScore: summedAwayPlayerPoints === awayScore
      });
    }
  }

  console.log(JSON.stringify({ totalPlayerRowsProcessed, gameStatsCreated, gameStatsUpdated, skippedRows, pointTotalChecks }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
