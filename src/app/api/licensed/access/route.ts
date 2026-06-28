import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function passwordHash(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

function pct(made?: number | null, attempt?: number | null) {
  if (!attempt) return null;
  return Number((((made ?? 0) / attempt) * 100).toFixed(1));
}

function efg(fgm?: number | null, threesMade?: number | null, fga?: number | null) {
  if (!fga) return null;
  return Number(((((fgm ?? 0) + 0.5 * (threesMade ?? 0)) / fga) * 100).toFixed(1));
}

function hasDetailedBoxScore(stat: {
  offensiveRebounds: number | null;
  defensiveRebounds: number | null;
  fieldGoalsAttempt: number | null;
  turnovers: number | null;
}) {
  return (
    stat.offensiveRebounds !== null ||
    stat.defensiveRebounds !== null ||
    stat.fieldGoalsAttempt !== null ||
    stat.turnovers !== null
  );
}

export async function POST(request: Request) {
  const body = (await request.json()) as { username?: string; password?: string };

  const user = await prisma.user.findFirst({
    where: {
      username: body.username,
      role: "ADMIN",
      deletedAt: null
    }
  });

  if (!user || user.username !== "DarwinOwner" || !body.password || user.passwordHash !== passwordHash(body.password)) {
    return NextResponse.json(
      { ok: false, message: "Licensed data access requires a Premium account." },
      { status: 403 }
    );
  }

  const players = await prisma.player.findMany({
    where: { deletedAt: null },
    include: {
      gameStats: {
        where: { deletedAt: null, game: { verificationStatus: "VERIFIED" } },
        include: {
          game: {
            include: {
              homeTeam: true,
              awayTeam: true,
              season: { include: { league: true } }
            }
          }
        },
        orderBy: { game: { gameDate: "desc" } }
      }
    },
    orderBy: { displayName: "asc" }
  });

  const payload = players
    .filter((player) => player.gameStats.length)
    .map((player) => {
      const detailedStats = player.gameStats.filter(hasDetailedBoxScore);
      const totals = player.gameStats.reduce(
        (acc, stat) => ({
          points: acc.points + stat.points,
          rebounds: acc.rebounds + (hasDetailedBoxScore(stat) ? stat.rebounds : 0),
          assists: acc.assists + (hasDetailedBoxScore(stat) ? stat.assists : 0),
          turnovers: acc.turnovers + (hasDetailedBoxScore(stat) ? (stat.turnovers ?? 0) : 0),
          fgm: acc.fgm + (hasDetailedBoxScore(stat) ? (stat.fieldGoalsMade ?? 0) : 0),
          fga: acc.fga + (hasDetailedBoxScore(stat) ? (stat.fieldGoalsAttempt ?? 0) : 0),
          threesMade: acc.threesMade + (hasDetailedBoxScore(stat) ? (stat.threeMade ?? 0) : 0),
          threesAttempt: acc.threesAttempt + (hasDetailedBoxScore(stat) ? (stat.threeAttempt ?? 0) : 0),
          ftm: acc.ftm + (hasDetailedBoxScore(stat) ? (stat.freeThrowsMade ?? 0) : 0),
          fta: acc.fta + (hasDetailedBoxScore(stat) ? (stat.freeThrowsAttempt ?? 0) : 0)
        }),
        { points: 0, rebounds: 0, assists: 0, turnovers: 0, fgm: 0, fga: 0, threesMade: 0, threesAttempt: 0, ftm: 0, fta: 0 }
      );
      const games = player.gameStats.length;
      const detailedGames = detailedStats.length;

      return {
        id: player.id,
        displayName: player.displayName,
        gender: player.gender,
        position: player.position,
        games,
        averages: {
          points: Number((totals.points / games).toFixed(1)),
          rebounds: detailedGames ? Number((totals.rebounds / detailedGames).toFixed(1)) : null,
          assists: detailedGames ? Number((totals.assists / detailedGames).toFixed(1)) : null
        },
        advanced: {
          fgPct: pct(totals.fgm, totals.fga),
          threePct: pct(totals.threesMade, totals.threesAttempt),
          ftPct: pct(totals.ftm, totals.fta),
          effectiveFgPct: efg(totals.fgm, totals.threesMade, totals.fga),
          assistToTurnover: totals.turnovers ? Number((totals.assists / totals.turnovers).toFixed(2)) : null
        },
        gamesByLeague: Object.values(
          player.gameStats.reduce<Record<string, { league: string; season: string; games: typeof player.gameStats }>>(
            (acc, stat) => {
              const key = `${stat.game.season.league.name}-${stat.game.season.name}`;
              acc[key] ??= { league: stat.game.season.league.name, season: stat.game.season.name, games: [] };
              acc[key].games.push(stat);
              return acc;
            },
            {}
          )
        ).map((group) => ({
          league: group.league,
          season: group.season,
          games: group.games.map((stat) => ({
            gameNumber: stat.game.gameNumber,
            date: stat.game.gameDate.toISOString(),
            matchup: `${stat.game.homeTeam.name} ${stat.game.homeScore} - ${stat.game.awayScore} ${stat.game.awayTeam.name}`,
            points: stat.points,
            rebounds: hasDetailedBoxScore(stat) ? stat.rebounds : null,
            assists: hasDetailedBoxScore(stat) ? stat.assists : null,
            turnovers: stat.turnovers,
            detailedStatsComplete: hasDetailedBoxScore(stat),
            shooting: {
              fieldGoals: `${stat.fieldGoalsMade ?? 0}/${stat.fieldGoalsAttempt ?? 0}`,
              threes: `${stat.threeMade ?? 0}/${stat.threeAttempt ?? 0}`,
              freeThrows: `${stat.freeThrowsMade ?? 0}/${stat.freeThrowsAttempt ?? 0}`,
              effectiveFgPct: efg(stat.fieldGoalsMade, stat.threeMade, stat.fieldGoalsAttempt)
            }
          }))
        }))
      };
    });

  return NextResponse.json({ ok: true, owner: user.name, players: payload });
}
