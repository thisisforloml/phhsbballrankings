import { AgeGroup, SeasonStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const leagueInput = {
  name: "UAAP Season 88 HS Boys Basketball",
  ageGroup: AgeGroup.U18,
  organizerName: "UAAP",
  city: "Quezon City",
  region: "NCR"
};

const seasonInput = {
  name: "Season 88",
  seasonYear: 2026,
  startsOn: new Date("2026-01-18T00:00:00.000Z"),
  endsOn: new Date("2026-03-15T00:00:00.000Z"),
  status: SeasonStatus.ACTIVE
};

const teamInputs = [
  "ATENEO",
  "ADU",
  "LA SALLE",
  "FEU",
  "NU",
  "UE",
  "UP",
  "UST"
].map((name) => ({
  name,
  city: "Metro Manila",
  region: "NCR"
}));

type ImportAction = "created" | "reused";

async function resolveOrCreateLeague() {
  const league = await prisma.league.findFirst({
    where: {
      name: leagueInput.name,
      ageGroup: leagueInput.ageGroup,
      deletedAt: null
    }
  });

  if (league) {
    return { action: "reused" as ImportAction, record: league };
  }

  const created = await prisma.league.create({
    data: leagueInput
  });

  return { action: "created" as ImportAction, record: created };
}

async function resolveOrCreateSeason(leagueId: string) {
  const season = await prisma.season.findUnique({
    where: {
      leagueId_name: {
        leagueId,
        name: seasonInput.name
      }
    }
  });

  if (season && season.deletedAt === null) {
    return { action: "reused" as ImportAction, record: season };
  }

  if (season) {
    throw new Error(
      `Season "${seasonInput.name}" exists for this league but is soft-deleted. Resolve manually before importing.`
    );
  }

  const created = await prisma.season.create({
    data: {
      ...seasonInput,
      leagueId
    }
  });

  return { action: "created" as ImportAction, record: created };
}

async function resolveOrCreateTeam(teamInput: (typeof teamInputs)[number]) {
  const matches = await prisma.team.findMany({
    where: {
      name: teamInput.name,
      deletedAt: null
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  if (matches.length === 1) {
    return { action: "reused" as ImportAction, record: matches[0] };
  }

  if (matches.length > 1) {
    throw new Error(
      `Multiple active teams found for "${teamInput.name}". Resolve duplicates before importing.`
    );
  }

  const created = await prisma.team.create({
    data: teamInput
  });

  return { action: "created" as ImportAction, record: created };
}

async function main() {
  const summary = {
    league: null as Awaited<ReturnType<typeof resolveOrCreateLeague>> | null,
    season: null as Awaited<ReturnType<typeof resolveOrCreateSeason>> | null,
    teams: [] as Array<Awaited<ReturnType<typeof resolveOrCreateTeam>>>
  };

  summary.league = await resolveOrCreateLeague();
  summary.season = await resolveOrCreateSeason(summary.league.record.id);

  for (const teamInput of teamInputs) {
    summary.teams.push(await resolveOrCreateTeam(teamInput));
  }

  const teamCounts = summary.teams.reduce(
    (counts, team) => {
      counts[team.action] += 1;
      return counts;
    },
    { created: 0, reused: 0 }
  );

  console.log(
    JSON.stringify(
      {
        league: {
          action: summary.league.action,
          id: summary.league.record.id,
          name: summary.league.record.name
        },
        season: {
          action: summary.season.action,
          id: summary.season.record.id,
          name: summary.season.record.name,
          seasonYear: summary.season.record.seasonYear,
          status: summary.season.record.status
        },
        teams: summary.teams.map((team) => ({
          action: team.action,
          id: team.record.id,
          name: team.record.name,
          city: team.record.city,
          region: team.record.region
        })),
        counts: {
          teams: teamCounts
        }
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
