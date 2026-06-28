import { AgeGroup } from "@prisma/client";
import { slugify } from "./format";
import { buildEligibilityInput, evaluateEligibility, isPublicBoardVisible } from "./eligibility";
import { prisma } from "./prisma";
import type { LeagueParticipation, PlayerSummary } from "./types";

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

function isPlayerPublicBoardEligible(player: {
  id: string;
  gender: string;
  birthDate: Date | null;
  firstRankingEligibilityAt: Date | null;
  classYearOverride: number | null;
  ageGroupOverride: string | null;
  currentRatings: Array<{ ageGroup: AgeGroup; verifiedGameCount: number }>;
}) {
  const rating = player.currentRatings[0];
  if (!rating) return false;

  const evaluatedBoard = (rating.ageGroup as PlayerSummary["ageGroup"]) ?? "U19";

  const verdict = evaluateEligibility(
    buildEligibilityInput({
      playerId: player.id,
      gender: player.gender as "BOYS" | "GIRLS",
      birthDate: player.birthDate,
      firstRankingEligibilityAt: player.firstRankingEligibilityAt,
      classYearOverride: player.classYearOverride,
      ageGroupOverride: player.ageGroupOverride,
      ratingAgeGroup: evaluatedBoard,
      verifiedGameCount: rating.verifiedGameCount,
      evaluatedBoard,
      formulaVersionId: null
    })
  );

  return isPublicBoardVisible(verdict);
}

export async function getPlayerSummaries(): Promise<PlayerSummary[]> {
  try {
    const dbPlayers = await prisma.player.findMany({
      where: { deletedAt: null },
      include: {
        currentRatings: true,
        rosterSeasons: {
          where: { deletedAt: null },
          include: {
            team: true,
            season: { include: { league: true } }
          },
          orderBy: { createdAt: "desc" }
        },
        gameStats: {
          where: {
            deletedAt: null,
            game: { verificationStatus: "VERIFIED" }
          },
          include: {
            game: {
              include: {
                season: { include: { league: true } }
              }
            }
          },
          orderBy: { game: { gameDate: "desc" } }
        }
      },
      orderBy: { displayName: "asc" }
    });

    const summaries = dbPlayers.map((player) => {
      const rating = player.currentRatings[0];
      const stats = player.gameStats;
      const detailedStats = stats.filter(hasDetailedBoxScore);
      const games = rating?.verifiedGameCount ?? stats.length;
      const totals = stats.reduce(
        (acc, stat) => ({
          points: acc.points + stat.points,
          rebounds: acc.rebounds + (hasDetailedBoxScore(stat) ? stat.rebounds : 0),
          assists: acc.assists + (hasDetailedBoxScore(stat) ? stat.assists : 0)
        }),
        { points: 0, rebounds: 0, assists: 0 }
      );
      const detailedGames = detailedStats.length;
      const latestRoster = player.rosterSeasons[0];
      const leagues = Array.from(
        new Map(
          player.rosterSeasons.map((item) => {
            const league = item.season.league;
            return [
              league.id,
              {
                name: league.name,
                tier: league.tier,
                tierLabel:
                  league.tier >= 4
                    ? "Elite"
                    : league.tier === 3
                      ? "Competitive"
                      : league.tier === 2
                        ? "Developmental"
                        : "Entry"
              } as const
            ];
          })
        ).values()
      );

      const normalizedAgeGroup = String(rating?.ageGroup ?? "U16")
        .replace("18", "19")
        .replace("22", "19") as PlayerSummary["ageGroup"];
      const publicBoardEligible = isPlayerPublicBoardEligible(player);

      return {
        id: player.id,
        slug: slugify(player.displayName),
        displayName: player.displayName,
        gender: player.gender,
        photoUrl: player.photoUrl,
        position: player.position,
        heightCm: player.heightCm,
        ageGroup: normalizedAgeGroup,
        city: player.city,
        region: player.region,
        team: latestRoster?.team.name ?? "Unassigned",
        games,
        rating: Number(rating?.adjustedRating ?? 0),
        stars: (rating?.starRating ?? 1) as PlayerSummary["stars"],
        trend: 0,
        ppg: games ? Number((totals.points / games).toFixed(1)) : 0,
        rpg: detailedGames ? Number((totals.rebounds / detailedGames).toFixed(1)) : 0,
        apg: detailedGames ? Number((totals.assists / detailedGames).toFixed(1)) : 0,
        leagues: leagues.length
          ? leagues
          : ([{ name: "Pending verified league", tier: 1, tierLabel: "Entry" }] satisfies LeagueParticipation[]),
        lastFive: stats.slice(0, 5).map((stat) => ({
          league: stat.game.season.league.name,
          statLine: hasDetailedBoxScore(stat)
            ? `${stat.points} pts, ${stat.assists} ast, ${stat.rebounds} reb`
            : `${stat.points} pts, detailed stats pending`,
          date: stat.game.gameDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
          })
        })),
        publicBoardEligible
      };
    });

    return summaries.map((player) => ({
      ...player,
      regionRanking: player.publicBoardEligible
        ? summaries
            .filter((candidate) => candidate.region === player.region && candidate.publicBoardEligible)
            .sort((a, b) => b.rating - a.rating)
            .findIndex((candidate) => candidate.id === player.id) + 1
        : null,
      positionRanking: player.publicBoardEligible
        ? summaries
            .filter((candidate) => candidate.position === player.position && candidate.publicBoardEligible)
            .sort((a, b) => b.rating - a.rating)
            .findIndex((candidate) => candidate.id === player.id) + 1
        : null
    }));
  } catch {
    return [];
  }
}

export async function getEligibleRankings(): Promise<PlayerSummary[]> {
  const players = await getPlayerSummaries();
  return players.filter((player) => player.publicBoardEligible).sort((a, b) => b.rating - a.rating);
}

export async function getPlayerBySlug(slug: string): Promise<PlayerSummary | undefined> {
  const players = await getPlayerSummaries();
  return players.find((player) => player.slug === slug);
}
