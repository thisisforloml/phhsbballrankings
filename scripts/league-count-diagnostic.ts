import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const reportPath = path.join(process.cwd(), "scripts", "reports", "league-count-diagnostic.json");
const batchFiles = [
  "scripts/data/uaap-s88-hs-boys-batch-01.json",
  "scripts/data/uaap-s88-hs-boys-batch-02.json",
  "scripts/data/uaap-s88-hs-boys-batch-03.json",
  "scripts/data/uaap-s88-hs-boys-batch-04.json",
  "scripts/data/uaap-s88-hs-boys-batch-05.json",
  "scripts/data/uaap-s88-hs-boys-batch-06.json",
  "scripts/data/uaap-s88-hs-girls-batch-01.json",
  "scripts/data/uaap-s88-hs-girls-batch-02.json"
];

const approvedAliases = new Map<string, string>([
  ["ATENEO", "Ateneo de Manila University"],
  ["ADMU", "Ateneo de Manila University"],
  ["ATENEO JRS", "Ateneo de Manila University"],
  ["LA SALLE", "De La Salle Santiago Zobel"],
  ["DLSZ", "De La Salle Santiago Zobel"],
  ["DLSU", "De La Salle Santiago Zobel"],
  ["DE LA SALLE JRS", "De La Salle Santiago Zobel"],
  ["UE", "University of the East"],
  ["UE JRS", "University of the East"],
  ["NU", "National University Nazareth School"],
  ["NUNS", "National University Nazareth School"],
  ["NU JRS", "National University Nazareth School"],
  ["UST", "University of Santo Tomas"],
  ["UST JRS", "University of Santo Tomas"],
  ["UP", "University of the Philippines Integrated School"],
  ["UPIS", "University of the Philippines Integrated School"],
  ["UPIS JRS", "University of the Philippines Integrated School"],
  ["ADU", "Adamson University"],
  ["ADU JRS", "Adamson University"],
  ["FEU", "Far Eastern University"],
  ["FEU JRS", "Far Eastern University"]
]);

type SourceBatch = {
  league: { name: string };
  season: { name: string };
  games: Array<{
    gameNumber: string;
    homeTeamName: string;
    awayTeamName: string;
  }>;
};

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function schoolName(value: string) {
  return approvedAliases.get(normalize(value)) ?? value;
}

function duplicates(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value, count]) => ({ value, count }));
}

async function main() {
  const validatedByLeague = new Map<string, { gameNumbers: Set<string>; teams: Set<string> }>();

  for (const file of batchFiles) {
    const batch = JSON.parse(fs.readFileSync(path.join(process.cwd(), file), "utf8")) as SourceBatch;
    const bucket = validatedByLeague.get(batch.league.name) ?? { gameNumbers: new Set<string>(), teams: new Set<string>() };
    for (const game of batch.games) {
      bucket.gameNumbers.add(game.gameNumber);
      bucket.teams.add(schoolName(game.homeTeamName));
      bucket.teams.add(schoolName(game.awayTeamName));
    }
    validatedByLeague.set(batch.league.name, bucket);
  }

  const leagues = await prisma.league.findMany({
    where: {
      deletedAt: null,
      name: {
        in: ["UAAP Season 88 HS Boys Basketball", "UAAP Season 88 HS Girls Basketball"]
      }
    },
    include: {
      seasons: {
        where: { deletedAt: null },
        include: {
          games: {
            where: { deletedAt: null },
            include: {
              homeTeam: { select: { id: true, name: true } },
              awayTeam: { select: { id: true, name: true } },
              stats: {
                where: { deletedAt: null },
                include: { team: { select: { id: true, name: true } } }
              }
            },
            orderBy: { gameDate: "asc" }
          }
        }
      }
    },
    orderBy: { name: "asc" }
  });

  const report = leagues.map((league) => {
    const validated = validatedByLeague.get(league.name);
    const games = league.seasons.flatMap((season) => season.games.map((game) => ({ ...game, seasonName: season.name, seasonId: season.id })));
    const gameNumbers = games.map((game) => game.gameNumber ?? "");
    const validatedGameNumbers = validated?.gameNumbers ?? new Set<string>();
    const homeAwayTeams = new Map<string, string>();
    const statTeams = new Map<string, string>();

    for (const game of games) {
      homeAwayTeams.set(game.homeTeam.id, game.homeTeam.name);
      homeAwayTeams.set(game.awayTeam.id, game.awayTeam.name);
      for (const stat of game.stats) statTeams.set(stat.team.id, stat.team.name);
    }

    const gamesNotInValidatedBatches = games
      .filter((game) => !game.gameNumber || !validatedGameNumbers.has(game.gameNumber))
      .map((game) => ({
        id: game.id,
        gameNumber: game.gameNumber,
        game: `${game.homeTeam.name} ${game.homeScore} - ${game.awayScore} ${game.awayTeam.name}`,
        gameDate: game.gameDate.toISOString()
      }));

    const allTeamNames = new Set([...homeAwayTeams.values(), ...statTeams.values()]);
    const teamsNotInApprovedUaapSchoolList = [...allTeamNames]
      .filter((name) => !approvedAliases.has(normalize(name)))
      .sort();

    return {
      leagueId: league.id,
      leagueName: league.name,
      ageGroup: league.ageGroup,
      seasons: league.seasons.map((season) => ({ id: season.id, name: season.name })),
      totalGamesInDb: games.length,
      validatedGameCount: validatedGameNumbers.size,
      totalTeamsFromGames: homeAwayTeams.size,
      validatedTeamCount: validated?.teams.size ?? 0,
      distinctHomeAwayTeams: [...homeAwayTeams.entries()].map(([id, name]) => ({ id, name, publicDisplayName: schoolName(name) })),
      distinctGameStatTeams: [...statTeams.entries()].map(([id, name]) => ({ id, name, publicDisplayName: schoolName(name) })),
      gameNumbers,
      duplicateGameNumbers: duplicates(gameNumbers),
      gamesNotIncludedInValidated8JsonBatchFiles: gamesNotInValidatedBatches,
      teamsNotInApprovedUaapSchoolList,
      likelyReasonForInflatedCount: gamesNotInValidatedBatches.length
        ? "The public pages were counting all active DB games and teams for the league, including old/test or non-validated games not present in the 8 approved JSON batch files."
        : "No inflated-count source found from non-validated games."
    };
  });

  const output = {
    generatedAt: new Date().toISOString(),
    report
  };

  fs.writeFileSync(reportPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({ reportPath, leaguesChecked: report.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
