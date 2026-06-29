import "server-only";

import { AgeGroup, RankingScope } from "@prisma/client";
import { slugify } from "./format";
import { getUaapSchoolDisplayName } from "./uaap-school-display";
import { formatClassYear, getMonthStart } from "./ranking-eligibility";
import { getActivePolicyVersionId } from "@/lib/ratings/active-formula";
import { selectPublicPlayerRating } from "@/lib/ratings/resolve-public-player-rating";
import { prisma } from "./prisma";

const formulaVersionNumber = 1;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type LoadedPlayer = NonNullable<Awaited<ReturnType<typeof loadPlayerById>>>;

export type PlayerProfileGame = {
  gameId: string;
  gameDate: string;
  leagueName: string;
  seasonName: string;
  teamName: string;
  opponentName: string;
  result: "W" | "L";
  teamScore: number;
  opponentScore: number;
  points: number;
  rebounds: number;
  assists: number;
  finalPerformanceScore: number | null;
};

export type PlayerProfileLeague = {
  leagueName: string;
  seasonName: string;
  tier: number;
  tierLabel: "Entry" | "Developmental" | "Competitive" | "Elite";
  gamesPlayed: number;
  avgPoints: number;
  avgAssists: number;
  avgRebounds: number;
};

export type PlayerProfile = {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  displayName: string;
  city: string;
  region: string;
  gender: "BOYS" | "GIRLS";
  position: string | null;
  heightCm: number | null;
  birthDate: string | null;
  birthYear: number | null;
  classYear: string | null;
  classYearOverride: number | null;
  schoolOverride: string | null;
  ageGroupOverride: "U13" | "U16" | "U19" | null;
  age: number | null;
  photoUrl: string | null;
  currentTeam: string;
  ageGroup: "U13" | "U16" | "U19";
  rating: number;
  observedRating: number;
  starRating: 1 | 2 | 3 | 4 | 5;
  verifiedGameCount: number;
  nationalRank: number | null;
  regionRank: number | null;
  positionRank: number | null;
  snapshotWeekOf: string | null;
  gamesPlayed: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  bestFourthStat: {
    label: string;
    value: number | string;
  };
  latestFiveGames: PlayerProfileGame[];
  leagues: PlayerProfileLeague[];
};

function tierLabel(tier: number): PlayerProfileLeague["tierLabel"] {
  if (tier >= 4) return "Elite";
  if (tier === 3) return "Competitive";
  if (tier === 2) return "Developmental";
  return "Entry";
}

function calculateAge(birthDate: Date | null) {
  if (!birthDate) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birthDate.getUTCDate())) age -= 1;
  return age;
}

function roundOne(value: number) {
  return Number(value.toFixed(1));
}

function playerNameParts(displayName: string, firstName: string, lastName: string) {
  if (firstName && lastName) return { firstName, lastName };

  const parts = displayName.trim().split(/\s+/);
  return {
    firstName: firstName || parts[0] || displayName,
    lastName: lastName || parts.slice(1).join(" ") || parts[0] || displayName
  };
}

async function loadPlayerById(id: string) {
  return prisma.player.findFirst({
    where: {
      id,
      deletedAt: null
    },
    include: {
      currentProgram: true,
      currentRatings: {
        where: { policyVersionId: getActivePolicyVersionId() }
      },
      rankingRows: {
        where: {
          snapshot: {
            scope: RankingScope.NATIONAL,

            formulaVersion: {
              versionNumber: formulaVersionNumber
            },
            city: null,
            region: null
          }
        },
        include: {
          snapshot: true
        }
      },
      gameStats: {
        where: {
          deletedAt: null,
          performanceScores: {
            some: {
              formulaVersion: { versionNumber: formulaVersionNumber },
              deletedAt: null
            }
          }
        },
        include: {
          team: { include: { program: true } },
          performanceScores: {
            where: {
              formulaVersion: { versionNumber: formulaVersionNumber },
              deletedAt: null
            },
            take: 1
          },
          game: {
            include: {
              homeTeam: true,
              awayTeam: true,
              season: {
                include: {
                  league: true
                }
              }
            }
          }
        },
        orderBy: {
          game: {
            gameDate: "desc"
          }
        }
      }
    }
  });
}

async function resolvePlayerIdBySlug(slug: string) {
  if (uuidPattern.test(slug)) {
    const exactPlayer = await prisma.player.findFirst({
      where: {
        id: slug,
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    if (exactPlayer) return exactPlayer.id;
  }

  const candidates = await prisma.player.findMany({
    where: {
      deletedAt: null
    },
    select: {
      id: true,
      displayName: true
    }
  });
  const matches = candidates.filter((player) => slugify(player.displayName) === slug);

  return matches.length === 1 ? matches[0].id : null;
}

function latestSnapshotRow(player: LoadedPlayer, ageGroup: AgeGroup) {
  const matchingRows = player.rankingRows.filter((row) => row.snapshot.gender === player.gender && row.snapshot.ageGroup === ageGroup && row.snapshot.weekOf.getTime() === getMonthStart(row.snapshot.weekOf).getTime());
  matchingRows.sort((left, right) => right.snapshot.weekOf.getTime() - left.snapshot.weekOf.getTime());
  return matchingRows[0] ?? null;
}

function normalizePosition(position: string | null) {
  return position?.trim().toUpperCase().replace(/[^A-Z0-9/ -]/g, "").replace(/\s+/g, " ") || null;
}

function selectProfileRating(player: LoadedPlayer) {
  return selectPublicPlayerRating(player);
}

function bestFourthStat(values: { spg: number; bpg: number; rating: number }) {
  if (values.spg > 0) return { label: "SPG", value: values.spg };
  if (values.bpg > 0) return { label: "BPG", value: values.bpg };
  return { label: "Rating", value: values.rating.toFixed(1) };
}

async function deriveSnapshotRanks(player: LoadedPlayer, ageGroup: AgeGroup, snapshotWeekOf: Date | null) {
  if (!snapshotWeekOf) return { regionRank: null, positionRank: null };

  const snapshot = await prisma.rankingSnapshot.findFirst({
    where: {
      scope: RankingScope.NATIONAL,
      ageGroup,
      gender: player.gender,
      formulaVersion: { versionNumber: formulaVersionNumber },
      city: null,
      region: null,
      weekOf: snapshotWeekOf
    },
    include: {
      rows: {
        include: { player: { select: { id: true, region: true, position: true, deletedAt: true } } },
        orderBy: { rank: "asc" }
      }
    }
  });

  if (!snapshot) return { regionRank: null, positionRank: null };
  const region = player.region?.trim().toLowerCase();
  const position = normalizePosition(player.position);

  const regionRows = region ? snapshot.rows.filter((row) => row.player.deletedAt === null && row.player.region?.trim().toLowerCase() === region) : [];
  const positionRows = position ? snapshot.rows.filter((row) => row.player.deletedAt === null && normalizePosition(row.player.position) === position) : [];

  return {
    regionRank: regionRows.findIndex((row) => row.playerId === player.id) >= 0 ? regionRows.findIndex((row) => row.playerId === player.id) + 1 : null,
    positionRank: positionRows.findIndex((row) => row.playerId === player.id) >= 0 ? positionRows.findIndex((row) => row.playerId === player.id) + 1 : null
  };
}

function mapGameStat(stat: LoadedPlayer["gameStats"][number]): PlayerProfileGame {
  const isHome = stat.teamId === stat.game.homeTeamId;
  const teamScore = isHome ? stat.game.homeScore : stat.game.awayScore;
  const opponentScore = isHome ? stat.game.awayScore : stat.game.homeScore;
  const opponentName = getUaapSchoolDisplayName(isHome ? stat.game.awayTeam.name : stat.game.homeTeam.name);
  const scoreRow = stat.performanceScores[0];
  const finalPerformanceScore = scoreRow?.finalPerformanceScore ?? scoreRow?.performanceScore ?? null;

  return {
    gameId: stat.gameId,
    gameDate: stat.game.gameDate.toISOString(),
    leagueName: stat.game.season.league.name,
    seasonName: stat.game.season.name,
    teamName: getUaapSchoolDisplayName(stat.team.name),
    opponentName,
    result: teamScore > opponentScore ? "W" : "L",
    teamScore,
    opponentScore,
    points: stat.points,
    rebounds: stat.rebounds,
    assists: stat.assists,
    finalPerformanceScore: finalPerformanceScore === null ? null : Number(finalPerformanceScore)
  };
}

function buildLeagueHistory(games: PlayerProfileGame[], stats: LoadedPlayer["gameStats"]): PlayerProfileLeague[] {
  const grouped = new Map<string, { leagueName: string; seasonName: string; tier: number; points: number; assists: number; rebounds: number; games: number }>();

  for (const stat of stats) {
    const league = stat.game.season.league;
    const key = `${league.id}:${stat.game.seasonId}`;
    const existing = grouped.get(key) ?? {
      leagueName: league.name,
      seasonName: stat.game.season.name,
      tier: league.tier,
      points: 0,
      assists: 0,
      rebounds: 0,
      games: 0
    };

    existing.points += stat.points;
    existing.assists += stat.assists;
    existing.rebounds += stat.rebounds;
    existing.games += 1;
    grouped.set(key, existing);
  }

  return [...grouped.values()].map((item) => ({
    leagueName: item.leagueName,
    seasonName: item.seasonName,
    tier: item.tier,
    tierLabel: tierLabel(item.tier),
    gamesPlayed: item.games,
    avgPoints: item.games ? roundOne(item.points / item.games) : 0,
    avgAssists: item.games ? roundOne(item.assists / item.games) : 0,
    avgRebounds: item.games ? roundOne(item.rebounds / item.games) : 0
  }));
}

export async function getPlayerProfileBySlug(slug: string): Promise<PlayerProfile | null> {
  const playerId = await resolvePlayerIdBySlug(slug);
  if (!playerId) return null;

  const player = await loadPlayerById(playerId);
  if (!player) return null;

  const rating = selectProfileRating(player);
  const profileAgeGroup = rating?.ageGroup ?? player.gameStats[0]?.game.season.league.ageGroup ?? AgeGroup.U19;
  const displayAgeGroup = (player.ageGroupOverride || profileAgeGroup) as AgeGroup;
  const snapshotRow = latestSnapshotRow(player, profileAgeGroup);
  const derivedRanks = await deriveSnapshotRanks(player, profileAgeGroup, snapshotRow?.snapshot.weekOf ?? null);
  const games = player.gameStats.map(mapGameStat);
  const gamesPlayed = games.length;
  const totals = player.gameStats.reduce(
    (sum, stat) => ({
      points: sum.points + stat.points,
      rebounds: sum.rebounds + stat.rebounds,
      assists: sum.assists + stat.assists
    }),
    { points: 0, rebounds: 0, assists: 0 }
  );
  const defensiveTotals = player.gameStats.reduce(
    (sum, stat) => ({
      steals: sum.steals + (stat.steals ?? 0),
      blocks: sum.blocks + (stat.blocks ?? 0)
    }),
    { steals: 0, blocks: 0 }
  );
  const mostRecentStat = player.gameStats[0] ?? null;
  const names = playerNameParts(player.displayName, player.firstName, player.lastName);
  const ratingValue = Number(rating?.adjustedRating ?? 0);
  const spg = gamesPlayed ? roundOne(defensiveTotals.steals / gamesPlayed) : 0;
  const bpg = gamesPlayed ? roundOne(defensiveTotals.blocks / gamesPlayed) : 0;

  return {
    id: player.id,
    slug: slugify(player.displayName),
    firstName: names.firstName,
    lastName: names.lastName,
    displayName: player.displayName,
    city: player.city,
    region: player.region,
    gender: player.gender,
    position: player.position,
    heightCm: player.heightCm,
    birthDate: player.birthDate ? player.birthDate.toISOString() : null,
    birthYear: player.birthDate ? player.birthDate.getUTCFullYear() : null,
    classYear: player.classYearOverride ? `Class of ${player.classYearOverride}` : formatClassYear(player.birthDate),
    classYearOverride: player.classYearOverride,
    schoolOverride: player.schoolOverride,
    ageGroupOverride: (player.ageGroupOverride as PlayerProfile["ageGroupOverride"]) ?? null,
    age: calculateAge(player.birthDate),
    photoUrl: player.photoUrl,
    currentTeam: player.currentProgram?.fullName || player.schoolOverride?.trim() || mostRecentStat?.team.program?.fullName || getUaapSchoolDisplayName(mostRecentStat?.team.name),
    ageGroup: displayAgeGroup,
    rating: ratingValue,
    observedRating: Number(rating?.observedRating ?? rating?.adjustedRating ?? 0),
    starRating: (rating?.starRating ?? 1) as PlayerProfile["starRating"],
    verifiedGameCount: rating?.verifiedGameCount ?? gamesPlayed,
    nationalRank: snapshotRow?.rank ?? null,
    regionRank: derivedRanks.regionRank,
    positionRank: derivedRanks.positionRank,
    snapshotWeekOf: snapshotRow?.snapshot.weekOf.toISOString() ?? null,
    gamesPlayed,
    ppg: gamesPlayed ? roundOne(totals.points / gamesPlayed) : 0,
    rpg: gamesPlayed ? roundOne(totals.rebounds / gamesPlayed) : 0,
    apg: gamesPlayed ? roundOne(totals.assists / gamesPlayed) : 0,
    spg,
    bpg,
    bestFourthStat: bestFourthStat({ spg, bpg, rating: ratingValue }),
    latestFiveGames: games.slice(0, 5),
    leagues: buildLeagueHistory(games, player.gameStats)
  };
}
