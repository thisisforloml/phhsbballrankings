import { prisma } from "../src/lib/prisma";

const groups = [
  { aliases: ["A. Timbang"], canonical: "Allan Timbang" },
  { aliases: ["B. Garcia"], canonical: "Bill Garcia" },
  { aliases: ["C. Cabantog"], canonical: "Corian Cabantog" },
  { aliases: ["C. Cartel"], canonical: "Chad Cartel" },
  { aliases: ["C. Fongtong", "Craig Fogntong"], canonical: "Craig Fongtong" },
  { aliases: ["C. Gomez"], canonical: "Chrys Gomez" },
  { aliases: ["C. Tulabut"], canonical: "Chester Tulabut" },
  { aliases: ["D. Sison"], canonical: "Denver Sison" },
  { aliases: ["F. Flores"], canonical: "Francel Flores" },
  { aliases: ["J. Artango"], canonical: "Jarl Artango" },
  { aliases: ["J. Eiman"], canonical: "JP Eiman" },
  { aliases: ["K. Figueroa"], canonical: "Kurl Figueroa" },
  { aliases: ["K. Frogoso"], canonical: "Kevin Frogoso" },
  { aliases: ["L. Manding"], canonical: "Lebron Manding" },
  { aliases: ["M. Alcartado"], canonical: "Marco Alcartado" },
  { aliases: ["M. Diakite"], canonical: "Moussa Diakite" },
  { aliases: ["M. Jenodia"], canonical: "Mac Jenodia" },
  { aliases: ["M. Matias"], canonical: "Mot Matias" },
  { aliases: ["M. Matillano"], canonical: "Makoy Matillano" },
  { aliases: ["M. Natinga"], canonical: "Miekho Natinga" },
  { aliases: ["Mark jade Dulin"], canonical: "Mark Jade Dulin" },
  { aliases: ["N. Babad"], canonical: "Nazi Babad" },
  { aliases: ["N. Bautista"], canonical: "Noah Bautista" },
  { aliases: ["R. Celiz"], canonical: "Rob Celiz" },
  { aliases: ["R. Juan"], canonical: "Ronnie Juan" },
  { aliases: ["S. Bouzina"], canonical: "Sofiane Bouzina" },
  { aliases: ["S. Lucido"], canonical: "Shaun Lucido" },
  { aliases: ["S. Mann"], canonical: "Sal Mann" },
  { aliases: ["Q. Molina"], canonical: "Q Molina" },
  { aliases: ["Z. Gonzales"], canonical: "Zyron Gonzales" }
];

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function riskFor(records: PlayerReport[], sameGame: SameGameReport[]) {
  const existing = records.filter((record) => record.exists);
  const activeWithStats = existing.filter((record) => record.gameStatCount > 0);
  const genders = unique(existing.map((record) => record.gender).filter(Boolean));

  if (sameGame.length > 0) {
    return {
      level: "high",
      reason: "Suspected duplicate names appear in the same game, so an automatic merge could combine distinct players."
    };
  }

  if (genders.length > 1) {
    return {
      level: "high",
      reason: "Matching records span multiple genders."
    };
  }

  if (activeWithStats.length <= 1) {
    return {
      level: "low",
      reason: "Only one existing record in the group has GameStat rows."
    };
  }

  const leagueSeasonKeys = unique(activeWithStats.flatMap((record) => record.leaguesSeasonsPlayedIn.map((item) => `${item.leagueName}|${item.seasonName}`)));
  const teamNames = unique(activeWithStats.flatMap((record) => record.teamsPlayedFor));

  if (leagueSeasonKeys.length === 1 && teamNames.length <= 2) {
    return {
      level: "medium",
      reason: "Multiple records have stats in the same league-season context; review box-score dates and teams before merging."
    };
  }

  return {
    level: "medium",
    reason: "Multiple existing records have stats and need manual review before merge."
  };
}

type SameGameReport = {
  gameId: string;
  gameNumber: string | null;
  gameDate: string;
  namesInGame: string[];
};

type PlayerReport = {
  searchedName: string;
  exists: boolean;
  playerId: string | null;
  displayName: string | null;
  gender: string | null;
  city: string | null;
  region: string | null;
  gameStatCount: number;
  gamePerformanceScoreCount: number;
  playerRatingExists: boolean;
  rankingSnapshotRowCount: number;
  teamsPlayedFor: string[];
  leaguesSeasonsPlayedIn: Array<{ leagueName: string; seasonName: string }>;
};

async function buildPlayerReport(name: string): Promise<PlayerReport> {
  const players = await prisma.player.findMany({
    where: {
      displayName: name,
      deletedAt: null
    },
    include: {
      gameStats: {
        include: {
          team: true,
          game: {
            include: {
              season: {
                include: {
                  league: true
                }
              }
            }
          },
          performanceScore: true
        }
      },
      currentRatings: true,
      rankingRows: true
    }
  });

  if (players.length === 0) {
    return {
      searchedName: name,
      exists: false,
      playerId: null,
      displayName: null,
      gender: null,
      city: null,
      region: null,
      gameStatCount: 0,
      gamePerformanceScoreCount: 0,
      playerRatingExists: false,
      rankingSnapshotRowCount: 0,
      teamsPlayedFor: [],
      leaguesSeasonsPlayedIn: []
    };
  }

  if (players.length > 1) {
    return {
      searchedName: name,
      exists: true,
      playerId: players.map((player) => player.id).join(","),
      displayName: `${name} (${players.length} active exact-name records)`,
      gender: unique(players.map((player) => player.gender)).join(","),
      city: unique(players.map((player) => player.city)).join(","),
      region: unique(players.map((player) => player.region)).join(","),
      gameStatCount: players.reduce((sum, player) => sum + player.gameStats.length, 0),
      gamePerformanceScoreCount: players.reduce((sum, player) => sum + player.gameStats.filter((stat) => stat.performanceScore).length, 0),
      playerRatingExists: players.some((player) => player.currentRatings.length > 0),
      rankingSnapshotRowCount: players.reduce((sum, player) => sum + player.rankingRows.length, 0),
      teamsPlayedFor: unique(players.flatMap((player) => player.gameStats.map((stat) => stat.team.name))).sort(),
      leaguesSeasonsPlayedIn: unique(players.flatMap((player) => player.gameStats.map((stat) => `${stat.game.season.league.name}|${stat.game.season.name}`))).sort().map((value) => {
        const [leagueName, seasonName] = value.split("|");
        return { leagueName, seasonName };
      })
    };
  }

  const player = players[0];
  return {
    searchedName: name,
    exists: true,
    playerId: player.id,
    displayName: player.displayName,
    gender: player.gender,
    city: player.city,
    region: player.region,
    gameStatCount: player.gameStats.length,
    gamePerformanceScoreCount: player.gameStats.filter((stat) => stat.performanceScore).length,
    playerRatingExists: player.currentRatings.length > 0,
    rankingSnapshotRowCount: player.rankingRows.length,
    teamsPlayedFor: unique(player.gameStats.map((stat) => stat.team.name)).sort(),
    leaguesSeasonsPlayedIn: unique(player.gameStats.map((stat) => `${stat.game.season.league.name}|${stat.game.season.name}`)).sort().map((value) => {
      const [leagueName, seasonName] = value.split("|");
      return { leagueName, seasonName };
    })
  };
}

async function sameGameReports(names: string[]): Promise<SameGameReport[]> {
  const players = await prisma.player.findMany({
    where: {
      displayName: {
        in: names
      },
      deletedAt: null
    },
    select: {
      id: true,
      displayName: true
    }
  });

  if (players.length < 2) return [];

  const playerNameById = new Map(players.map((player) => [player.id, player.displayName]));
  const stats = await prisma.gameStat.findMany({
    where: {
      playerId: {
        in: players.map((player) => player.id)
      }
    },
    include: {
      game: true
    }
  });

  const byGame = new Map<string, typeof stats>();
  for (const stat of stats) {
    byGame.set(stat.gameId, [...(byGame.get(stat.gameId) ?? []), stat]);
  }

  return Array.from(byGame.values())
    .filter((gameStats) => unique(gameStats.map((stat) => stat.playerId)).length > 1)
    .map((gameStats) => ({
      gameId: gameStats[0].gameId,
      gameNumber: gameStats[0].game.gameNumber,
      gameDate: gameStats[0].game.gameDate.toISOString(),
      namesInGame: unique(gameStats.map((stat) => playerNameById.get(stat.playerId) ?? stat.playerId)).sort()
    }));
}

async function main() {
  const reports = [];

  for (const group of groups) {
    const names = [...group.aliases, group.canonical];
    const playerReports = await Promise.all(names.map((name) => buildPlayerReport(name)));
    const sameGame = await sameGameReports(names);
    const mergeRisk = riskFor(playerReports, sameGame);

    reports.push({
      suspectedNames: names,
      recommendedCanonicalPlayer: group.canonical,
      players: playerReports,
      suspectedDuplicateNamesEverAppearInSameGame: sameGame.length > 0,
      sameGameAppearances: sameGame,
      mergeRiskLevel: mergeRisk.level,
      reason: mergeRisk.reason
    });
  }

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalGroups: reports.length,
    groups: reports
  }, null, 2));
}

main()
  .catch((error) => {
    console.log(JSON.stringify({
      error: error instanceof Error ? error.message : String(error)
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });