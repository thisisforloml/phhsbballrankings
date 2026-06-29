import "server-only";

import type { AgeGroup, PlayerGender } from "@prisma/client";
import { slugify } from "@/lib/format";
import { normalizeCompetitionDisplayName } from "@/lib/competition-naming";
import { formatPublicRank } from "@/lib/public-rank-display";
import { getEffectiveClassYear } from "@/lib/ranking-eligibility";
import { getActivePolicyVersionId } from "@/lib/ratings/player-rating-query";
import { selectPublicPlayerRating } from "@/lib/ratings/resolve-public-player-rating";
import {
  buildCompetitionParticipationFromStats,
  formatPrimaryCompetitionLine
} from "@/lib/player-competition-context";
import { getPublicBoardRows } from "@/lib/public-board-ranks";
import { formatProgramTypeLabel, resolvePrimaryRankingAffiliation } from "@/lib/player-display-affiliation";
import { getTeamDisplayName } from "@/lib/uaap-school-display";
import { prisma } from "@/lib/prisma";
import { getLatestNationalRankings, type RankingAgeGroup } from "@/lib/rankings";

export type PublicSearchResult =
  | {
      type: "Player";
      id: string;
      title: string;
      href: string;
      subtitle: string;
      meta: string;
      rankLabel: string | null;
      rating: number | null;
      photoUrl: string | null;
      primaryCompetitionLine: string | null;
    }
  | {
      type: "Team";
      id: string;
      title: string;
      href: string;
      subtitle: string;
      meta: string;
    }
  | {
      type: "League";
      id: string;
      title: string;
      href: string;
      subtitle: string;
      meta: string;
    };

export type PublicSearchResponse = {
  query: string;
  results: PublicSearchResult[];
};

const maxQueryLength = 80;

function cleanQuery(query: string) {
  return query.trim().replace(/\s+/g, " ").slice(0, maxQueryLength);
}

function displayGender(gender: PlayerGender) {
  return gender === "GIRLS" ? "Girls" : "Boys";
}

function ageGroupLabel(ageGroup: AgeGroup | string | null | undefined) {
  return ageGroup ? String(ageGroup) : "Age group pending";
}

function containsSearchValue(values: Array<string | null | undefined>, needle: string) {
  return values.some((value) => value?.toLowerCase().includes(needle));
}

async function getPublicRankLookup() {
  const rankings = await getLatestNationalRankings();
  const byPlayer = new Map<string, {
    rank: number;
    ageGroup: RankingAgeGroup;
    gender: "Boys" | "Girls";
    rating: number;
  }>();

  for (const scope of Object.values(rankings.snapshotsByAge)) {
    for (const snapshot of [scope.boys, scope.girls]) {
      getPublicBoardRows(snapshot).forEach((row, index) => {
        const boardRank = index + 1;
        const existing = byPlayer.get(row.playerId);
        if (!existing || boardRank < existing.rank) {
          byPlayer.set(row.playerId, {
            rank: boardRank,
            ageGroup: snapshot.ageGroup,
            gender: snapshot.gender,
            rating: row.rating
          });
        }
      });
    }
  }

  return byPlayer;
}

async function searchPlayers(query: string): Promise<PublicSearchResult[]> {
  const [players, rankLookup] = await Promise.all([
    prisma.player.findMany({
      where: {
        deletedAt: null,
        OR: [
          { displayName: { contains: query, mode: "insensitive" } },
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
          { city: { contains: query, mode: "insensitive" } },
          { region: { contains: query, mode: "insensitive" } },
          { position: { contains: query, mode: "insensitive" } },
          { currentProgram: { fullName: { contains: query, mode: "insensitive" } } },
          { currentProgram: { abbreviation: { contains: query, mode: "insensitive" } } }
        ]
      },
      select: {
        id: true,
        displayName: true,
        gender: true,
        position: true,
        city: true,
        region: true,
        photoUrl: true,
        birthDate: true,
        classYearOverride: true,
        ageGroupOverride: true,
        schoolOverride: true,
        currentProgram: { select: { fullName: true, abbreviation: true, type: true } },
        currentRatings: {
          where: { policyVersionId: getActivePolicyVersionId() },
          select: { ageGroup: true, adjustedRating: true, verifiedGameCount: true, policyVersionId: true, ratingBasis: true, observedRating: true, starRating: true }
        },
        gameStats: {
          where: { deletedAt: null },
          select: {
            team: { select: { name: true, program: { select: { fullName: true, abbreviation: true, type: true } } } },
            game: {
              select: {
                gameDate: true,
                season: {
                  select: {
                    name: true,
                    league: { select: { id: true, name: true, tier: true, ageGroup: true } }
                  }
                }
              }
            }
          },
          orderBy: { game: { gameDate: "desc" } },
          take: 40
        }
      },
      orderBy: [{ displayName: "asc" }],
      take: 12
    }),
    getPublicRankLookup()
  ]);

  return players.slice(0, 6).map((player) => {
    const publicRank = rankLookup.get(player.id);
    const bestRating = selectPublicPlayerRating(player);
    const ageGroup = publicRank?.ageGroup ?? player.ageGroupOverride ?? bestRating?.ageGroup ?? null;
    const school = resolvePrimaryRankingAffiliation({
      schoolOverride: player.schoolOverride,
      currentProgram: player.currentProgram,
      gameStats: player.gameStats
    });
    const effectiveClassYear = getEffectiveClassYear(player.birthDate, player.classYearOverride);
    const classMeta = effectiveClassYear ? `Class of ${effectiveClassYear}` : "Class pending";
    const rankLabel = publicRank
      ? `${formatPublicRank(publicRank.rank)} ${publicRank.ageGroup} ${publicRank.gender} National Rank`
      : null;
    const participation = buildCompetitionParticipationFromStats(player.gameStats);
    const primaryCompetitionLine = participation.primary ? formatPrimaryCompetitionLine(participation.primary) : null;

    return {
      type: "Player",
      id: player.id,
      title: player.displayName,
      href: effectiveClassYear ? `/rankings?age=U19&gender=${player.gender === "GIRLS" ? "Girls" : "Boys"}&classYear=${effectiveClassYear}` : `/players/${slugify(player.displayName)}`,
      subtitle: [player.position, school, primaryCompetitionLine].filter(Boolean).join(" | "),
      meta: `${displayGender(player.gender)} ${ageGroupLabel(ageGroup)} | ${classMeta} | ${player.city}, ${player.region}`,
      rankLabel,
      rating: publicRank?.rating ?? (bestRating ? Number(bestRating.adjustedRating) : null),
      photoUrl: player.photoUrl,
      primaryCompetitionLine
    };
  });
}

async function searchTeams(query: string): Promise<PublicSearchResult[]> {
  const teams = await prisma.team.findMany({
    where: {
      deletedAt: null,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { city: { contains: query, mode: "insensitive" } },
        { region: { contains: query, mode: "insensitive" } },
        { program: { fullName: { contains: query, mode: "insensitive" } } },
        { program: { abbreviation: { contains: query, mode: "insensitive" } } }
      ],
      AND: [
        {
          OR: [
            { homeGames: { some: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } } },
            { awayGames: { some: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } } },
            { gameStats: { some: { deletedAt: null, game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } } } }
          ]
        }
      ]
    },
    select: {
      id: true,
      name: true,
      city: true,
      region: true,
      program: { select: { fullName: true, abbreviation: true, type: true } },
      homeGames: {
        where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } },
        select: { season: { select: { name: true, league: { select: { name: true, ageGroup: true } } } } },
        orderBy: [{ gameDate: "desc" }],
        take: 1
      },
      awayGames: {
        where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } },
        select: { season: { select: { name: true, league: { select: { name: true, ageGroup: true } } } } },
        orderBy: [{ gameDate: "desc" }],
        take: 1
      }
    },
    orderBy: [{ name: "asc" }],
    take: 8
  });

  const seen = new Set<string>();
  const results: PublicSearchResult[] = [];

  for (const team of teams) {
    const displayName = getTeamDisplayName(team.name);
    const programName = team.program?.fullName || team.program?.abbreviation || displayName;
    const programTypeLabel = formatProgramTypeLabel(team.program?.type);
    const latestContext = team.homeGames[0]?.season ?? team.awayGames[0]?.season ?? null;
    const dedupeKey = `${programName}:${displayName}`.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    results.push({
      type: "Team",
      id: team.id,
      title: displayName,
      href: `/teams/${team.id}`,
      subtitle: programName === displayName ? `${programTypeLabel} | ${team.city}, ${team.region}` : `${programTypeLabel} | ${programName}`,
      meta: latestContext
        ? `${normalizeCompetitionDisplayName(latestContext.league.name)} | ${latestContext.league.ageGroup}`
        : `${team.city}, ${team.region}`
    });
  }

  return results.slice(0, 5);
}

async function searchLeagues(query: string): Promise<PublicSearchResult[]> {
  const needle = query.toLowerCase();
  const leagues = await prisma.league.findMany({
    where: {
      deletedAt: null,
      seasons: { some: { deletedAt: null, games: { some: { deletedAt: null } } } }
    },
    select: {
      id: true,
      name: true,
      ageGroup: true,
      organizerName: true,
      city: true,
      region: true,
      tier: true,
      seasons: {
        where: { deletedAt: null },
        select: { games: { where: { deletedAt: null }, select: { id: true } } }
      }
    },
    orderBy: [{ name: "asc" }],
    take: 120
  });

  const grouped = new Map<string, PublicSearchResult>();

  for (const league of leagues) {
    const displayName = normalizeCompetitionDisplayName(league.name) || league.name;
    if (!containsSearchValue([displayName, league.name, league.organizerName, league.city, league.region, String(league.ageGroup)], needle)) {
      continue;
    }

    const groupKey = `${displayName}:${league.ageGroup}`.toLowerCase();
    if (grouped.has(groupKey)) continue;
    const gameCount = league.seasons.reduce((total, season) => total + season.games.length, 0);

    grouped.set(groupKey, {
      type: "League",
      id: league.id,
      title: displayName,
      href: `/leagues/${league.id}`,
      subtitle: [league.organizerName, league.city ?? league.region ?? "Philippines"].filter(Boolean).join(" | "),
      meta: `${league.ageGroup} | ${gameCount} official game${gameCount === 1 ? "" : "s"}`
    });
  }

  return [...grouped.values()].slice(0, 5);
}

export async function searchPublicSite(rawQuery: string): Promise<PublicSearchResponse> {
  const query = cleanQuery(rawQuery);
  if (query.length < 2) return { query, results: [] };

  const [players, teams, leagues] = await Promise.all([
    searchPlayers(query),
    searchTeams(query),
    searchLeagues(query)
  ]);

  return {
    query,
    results: [...players, ...teams, ...leagues].slice(0, 16)
  };
}
