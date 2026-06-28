import { NextResponse } from "next/server";
import { AgeGroup, SeasonStatus, SubmissionType, VerificationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPortalUser } from "@/lib/portal-auth";

interface PlayerStatInput {
  team: "home" | "away";
  name: string;
  jerseyNumber?: string;
  starter?: boolean;
  position?: string;
  points: number;
  offensiveRebounds?: number;
  defensiveRebounds?: number;
  rebounds?: number;
  assists?: number;
  minutes?: number;
  steals?: number;
  blocks?: number;
  turnovers?: number;
  foulsDrawn?: number;
  plusMinus?: number;
  fieldGoalsMade?: number;
  fieldGoalsAttempt?: number;
  twoMade?: number;
  twoAttempt?: number;
  threeMade?: number;
  threeAttempt?: number;
  freeThrowsMade?: number;
  freeThrowsAttempt?: number;
  fouls?: number;
}

interface GameSubmissionInput {
  username?: string;
  leagueName?: string;
  gameNumber?: string;
  date?: string;
  venueName?: string;
  city?: string;
  region?: string;
  referees?: string;
  homeTeam?: string;
  awayTeam?: string;
  homeScore?: number;
  awayScore?: number;
  homeQ1?: number;
  homeQ2?: number;
  homeQ3?: number;
  homeQ4?: number;
  awayQ1?: number;
  awayQ2?: number;
  awayQ3?: number;
  awayQ4?: number;
  sourceNotes?: string;
  players?: PlayerStatInput[];
}

function splitName(displayName: string) {
  const parts = displayName.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "New",
    lastName: parts.slice(1).join(" ") || "Player"
  };
}

export async function POST(request: Request) {
  const body = (await request.json()) as GameSubmissionInput;
  const players = body.players?.filter((player) => player.name.trim() && Number.isFinite(player.points)) ?? [];

  const user = await getPortalUser();

  if (!user) {
    return NextResponse.json({ ok: false, message: "Organizer account required." }, { status: 403 });
  }

  if (    
    !body.leagueName ||
    !body.date ||
    !body.homeTeam ||
    !body.awayTeam ||
    !Number.isFinite(body.homeScore) ||
    !Number.isFinite(body.awayScore) ||
    players.length === 0
  ) {
    return NextResponse.json({ ok: false, message: "Missing required game details or player points." }, { status: 400 });
  }

  const city = body.city?.trim() || "Pending city";
  const region = body.region?.trim() || "Pending region";
  const seasonYear = new Date(body.date).getFullYear();

  const result = await prisma.$transaction(async (tx) => {
    const league =
      (await tx.league.findFirst({
        where: {
          name: body.leagueName,
          ageGroup: AgeGroup.U16,
          deletedAt: null
        }
      })) ??
      (await tx.league.create({
        data: {
          name: body.leagueName!,
          ageGroup: AgeGroup.U16,
          organizerName: user.name,
          city,
          region,
          tier: 1,
          qualityScore: 0,
          adminNotes: "Created from organizer submitted game. Pending administrator review."
        }
      }));

    const season =
      (await tx.season.findFirst({
        where: {
          leagueId: league.id,
          seasonYear,
          deletedAt: null
        }
      })) ??
      (await tx.season.create({
        data: {
          leagueId: league.id,
          name: `${seasonYear} Season`,
          seasonYear,
          status: SeasonStatus.ACTIVE,
          startsOn: new Date(`${seasonYear}-01-01T00:00:00.000Z`)
        }
      }));

    const homeTeam =
      (await tx.team.findFirst({ where: { name: body.homeTeam, deletedAt: null } })) ??
      (await tx.team.create({ data: { name: body.homeTeam!, city, region } }));
    const awayTeam =
      (await tx.team.findFirst({ where: { name: body.awayTeam, deletedAt: null } })) ??
      (await tx.team.create({ data: { name: body.awayTeam!, city, region } }));

    const game = await tx.game.create({
      data: {
        seasonId: season.id,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        gameNumber: body.gameNumber,
        gameDate: new Date(`${body.date}T00:00:00.000Z`),
        venueName: body.venueName,
        city,
        region,
        referees: body.referees,
        homeScore: Number(body.homeScore),
        awayScore: Number(body.awayScore),
        homeQ1: body.homeQ1,
        homeQ2: body.homeQ2,
        homeQ3: body.homeQ3,
        homeQ4: body.homeQ4,
        awayQ1: body.awayQ1,
        awayQ2: body.awayQ2,
        awayQ3: body.awayQ3,
        awayQ4: body.awayQ4,
        sourceName: body.sourceNotes || "Organizer submitted stat sheet",
        submissionType: SubmissionType.POST_GAME_PORTAL,
        verificationStatus: VerificationStatus.SUBMITTED
      }
    });

    for (const playerInput of players) {
      const team = playerInput.team === "home" ? homeTeam : awayTeam;
      const displayName = playerInput.name.trim();
      const existingPlayer = await tx.player.findFirst({
        where: {
          displayName: {
            equals: displayName,
            mode: "insensitive"
          },
          deletedAt: null
        }
      });
      const name = splitName(displayName);
      const player =
        existingPlayer ??
        (await tx.player.create({
          data: {
            firstName: name.firstName,
            lastName: name.lastName,
            displayName,
            birthDate: new Date("2010-01-01T00:00:00.000Z"),
            city,
            region,
            position: playerInput.position?.trim() || "G"
          }
        }));

      await tx.playerTeamSeason.upsert({
        where: {
          playerId_seasonId: {
            playerId: player.id,
            seasonId: season.id
          }
        },
        update: {},
        create: {
          playerId: player.id,
          teamId: team.id,
          seasonId: season.id
        }
      });

      await tx.gameStat.create({
        data: {
          gameId: game.id,
          playerId: player.id,
          teamId: team.id,
          jerseyNumber: playerInput.jerseyNumber,
          starter: Boolean(playerInput.starter),
          minutes: playerInput.minutes,
          points: Number(playerInput.points),
          offensiveRebounds: playerInput.offensiveRebounds,
          defensiveRebounds: playerInput.defensiveRebounds,
          rebounds: Number(playerInput.rebounds ?? 0),
          assists: Number(playerInput.assists ?? 0),
          steals: playerInput.steals,
          blocks: playerInput.blocks,
          turnovers: playerInput.turnovers,
          fouls: playerInput.fouls,
          foulsDrawn: playerInput.foulsDrawn,
          plusMinus: playerInput.plusMinus,
          fieldGoalsMade: playerInput.fieldGoalsMade,
          fieldGoalsAttempt: playerInput.fieldGoalsAttempt,
          twoMade: playerInput.twoMade,
          twoAttempt: playerInput.twoAttempt,
          threeMade: playerInput.threeMade,
          threeAttempt: playerInput.threeAttempt,
          freeThrowsMade: playerInput.freeThrowsMade,
          freeThrowsAttempt: playerInput.freeThrowsAttempt
        }
      });
    }

    await tx.auditLog.create({
      data: {
        userId: user.id,
        entityType: "game",
        entityId: game.id,
        action: "SUBMIT_GAME_STATS",
        reason: "Organizer submitted game and player statistics for Peach Basket Rankings PH verification.",
        newData: {
          leagueName: body.leagueName,
          homeTeam: body.homeTeam,
          awayTeam: body.awayTeam,
          playerCount: players.length
        }
      }
    });

    return game;
  });

  return NextResponse.json({ ok: true, gameId: result.id });
}
