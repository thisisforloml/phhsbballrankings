import { SubmissionType, VerificationStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const leagueInput = {
  id: "d721a82a-f182-4a54-983a-01453650ec9e",
  name: "UAAP Season 88 HS Boys Basketball"
};

const seasonInput = {
  id: "77858fdc-9a0b-4b4a-8820-4ad0a105a8a9",
  name: "Season 88"
};

const teamNames = [
  "ATENEO",
  "ADU",
  "LA SALLE",
  "FEU",
  "NU",
  "UE",
  "UP",
  "UST"
] as const;

const gameInputs = [
  {
    gameNumber: "UAAP-S88-HSB-001",
    homeTeamName: "ATENEO",
    awayTeamName: "ADU",
    homeScore: 88,
    awayScore: 65,
    gameDate: "2026-02-21"
  },
  {
    gameNumber: "UAAP-S88-HSB-002",
    homeTeamName: "ATENEO",
    awayTeamName: "LA SALLE",
    homeScore: 80,
    awayScore: 65,
    gameDate: "2026-01-18"
  },
  {
    gameNumber: "UAAP-S88-HSB-003",
    homeTeamName: "ATENEO",
    awayTeamName: "FEU",
    homeScore: 89,
    awayScore: 90,
    gameDate: "2026-03-15"
  },
  {
    gameNumber: "UAAP-S88-HSB-004",
    homeTeamName: "ATENEO",
    awayTeamName: "FEU",
    homeScore: 86,
    awayScore: 82,
    gameDate: "2026-03-08"
  },
  {
    gameNumber: "UAAP-S88-HSB-005",
    homeTeamName: "ATENEO",
    awayTeamName: "NU",
    homeScore: 86,
    awayScore: 63,
    gameDate: "2026-01-22"
  },
  {
    gameNumber: "UAAP-S88-HSB-006",
    homeTeamName: "ATENEO",
    awayTeamName: "UE",
    homeScore: 67,
    awayScore: 58,
    gameDate: "2026-02-15"
  },
  {
    gameNumber: "UAAP-S88-HSB-007",
    homeTeamName: "ATENEO",
    awayTeamName: "UP",
    homeScore: 96,
    awayScore: 70,
    gameDate: "2026-02-01"
  },
  {
    gameNumber: "UAAP-S88-HSB-008",
    homeTeamName: "ATENEO",
    awayTeamName: "UST",
    homeScore: 100,
    awayScore: 88,
    gameDate: "2026-01-25"
  },
  {
    gameNumber: "UAAP-S88-HSB-009",
    homeTeamName: "ADU",
    awayTeamName: "ATENEO",
    homeScore: 77,
    awayScore: 73,
    gameDate: "2026-01-29"
  },
  {
    gameNumber: "UAAP-S88-HSB-010",
    homeTeamName: "ADU",
    awayTeamName: "LA SALLE",
    homeScore: 59,
    awayScore: 71,
    gameDate: "2026-02-25"
  }
] as const;

type TeamName = (typeof teamNames)[number];
type GameAction = "created" | "reused_updated";

async function assertLeagueAndSeason() {
  const league = await prisma.league.findFirst({
    where: {
      id: leagueInput.id,
      name: leagueInput.name,
      deletedAt: null
    }
  });

  if (!league) {
    throw new Error(
      `Expected active league not found: ${leagueInput.name} (${leagueInput.id})`
    );
  }

  const season = await prisma.season.findFirst({
    where: {
      id: seasonInput.id,
      name: seasonInput.name,
      leagueId: leagueInput.id,
      deletedAt: null
    }
  });

  if (!season) {
    throw new Error(
      `Expected active season not found: ${seasonInput.name} (${seasonInput.id})`
    );
  }
}

async function resolveTeams() {
  const teams = new Map<TeamName, { id: string; name: string }>();

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

  return teams;
}

async function resolveOrCreateGame(
  gameInput: (typeof gameInputs)[number],
  teams: Map<TeamName, { id: string; name: string }>
) {
  const homeTeam = teams.get(gameInput.homeTeamName);
  const awayTeam = teams.get(gameInput.awayTeamName);

  if (!homeTeam || !awayTeam) {
    throw new Error(
      `Missing team resolution for ${gameInput.homeTeamName} vs ${gameInput.awayTeamName}`
    );
  }

  const gameDate = new Date(`${gameInput.gameDate}T00:00:00.000Z`);
  const matches = await prisma.game.findMany({
    where: {
      seasonId: seasonInput.id,
      gameDate,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      deletedAt: null
    }
  });

  const gameData = {
    seasonId: seasonInput.id,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    gameNumber: gameInput.gameNumber,
    gameDate,
    city: "Metro Manila",
    region: "NCR",
    sourceName: "UAAP Season 88 HS Boys Basketball box score",
    submissionType: SubmissionType.STAFF_MANUAL_ENTRY,
    verificationStatus: VerificationStatus.SUBMITTED,
    homeScore: gameInput.homeScore,
    awayScore: gameInput.awayScore
  };

  if (matches.length > 1) {
    throw new Error(
      `Multiple active games found for ${gameInput.gameNumber}: ${gameInput.homeTeamName} vs ${gameInput.awayTeamName} on ${gameInput.gameDate}`
    );
  }

  if (matches.length === 1) {
    const updated = await prisma.game.update({
      where: {
        id: matches[0].id
      },
      data: gameData
    });

    return {
      action: "reused_updated" as GameAction,
      record: updated,
      homeTeamName: homeTeam.name,
      awayTeamName: awayTeam.name
    };
  }

  const created = await prisma.game.create({
    data: gameData
  });

  return {
    action: "created" as GameAction,
    record: created,
    homeTeamName: homeTeam.name,
    awayTeamName: awayTeam.name
  };
}

async function main() {
  await assertLeagueAndSeason();
  const teams = await resolveTeams();
  const games = [];

  for (const gameInput of gameInputs) {
    games.push(await resolveOrCreateGame(gameInput, teams));
  }

  const counts = games.reduce(
    (accumulator, game) => {
      if (game.action === "created") {
        accumulator.created += 1;
      } else {
        accumulator.reusedUpdated += 1;
      }

      return accumulator;
    },
    { created: 0, reusedUpdated: 0 }
  );

  console.log(
    JSON.stringify(
      {
        league: leagueInput,
        season: seasonInput,
        counts: {
          gamesCreated: counts.created,
          gamesReusedUpdated: counts.reusedUpdated
        },
        games: games.map((game) => ({
          action: game.action,
          id: game.record.id,
          gameNumber: game.record.gameNumber,
          homeTeam: game.homeTeamName,
          awayTeam: game.awayTeamName,
          score: {
            home: game.record.homeScore,
            away: game.record.awayScore
          },
          date: game.record.gameDate.toISOString().slice(0, 10),
          verificationStatus: game.record.verificationStatus
        }))
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
