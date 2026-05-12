import { readFileSync } from "node:fs";
import path from "node:path";
import { AgeGroup, SeasonStatus, SubmissionType, VerificationStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const projectRoot = "D:\\OnCourt Rankings PH";

const batchFiles = [
  "scripts/data/uaap-s88-hs-boys-batch-01.json",
  "scripts/data/uaap-s88-hs-boys-batch-02.json",
  "scripts/data/uaap-s88-hs-boys-batch-03.json",
  "scripts/data/uaap-s88-hs-boys-batch-04.json",
  "scripts/data/uaap-s88-hs-boys-batch-05.json",
  "scripts/data/uaap-s88-hs-boys-batch-06.json",
  "scripts/data/uaap-s88-hs-girls-batch-01.json",
  "scripts/data/uaap-s88-hs-girls-batch-02.json"
] as const;

type SourceLeague = {
  name?: unknown;
  ageGroup?: unknown;
  organizerName?: unknown;
  city?: unknown;
  region?: unknown;
};

type SourceSeason = {
  id?: unknown;
  name?: unknown;
  seasonYear?: unknown;
  startsOn?: unknown;
  endsOn?: unknown;
  status?: unknown;
};

type SourceGame = {
  gameNumber?: unknown;
  gameDate?: unknown;
  homeTeamName?: unknown;
  awayTeamName?: unknown;
  homeScore?: unknown;
  awayScore?: unknown;
  city?: unknown;
  region?: unknown;
  sourceName?: unknown;
  sourceUrl?: unknown;
};

type SourceData = {
  league?: SourceLeague;
  season?: SourceSeason;
  games?: SourceGame[];
};

type ImportAction = "created" | "updated";

function requiredString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing or invalid ${label}.`);
  }

  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredNumber(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Missing or invalid ${label}.`);
  }

  return value;
}

function parseAgeGroup(value: unknown) {
  const ageGroup = requiredString(value, "league.ageGroup");

  if (!Object.values(AgeGroup).includes(ageGroup as AgeGroup)) {
    throw new Error(`Unsupported ageGroup: ${ageGroup}`);
  }

  return ageGroup as AgeGroup;
}

function parseDateAtUtcMidnight(value: unknown, label: string) {
  const date = requiredString(value, label);
  return new Date(`${date}T00:00:00.000Z`);
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

  return { relativePath, data };
}

function getSeasonDates(data: SourceData) {
  const gameDates = data.games!.map((game) => parseDateAtUtcMidnight(game.gameDate, "game.gameDate"));
  const sorted = [...gameDates].sort((left, right) => left.getTime() - right.getTime());

  return {
    startsOn: typeof data.season?.startsOn === "string" ? parseDateAtUtcMidnight(data.season.startsOn, "season.startsOn") : sorted[0],
    endsOn: typeof data.season?.endsOn === "string" ? parseDateAtUtcMidnight(data.season.endsOn, "season.endsOn") : sorted[sorted.length - 1]
  };
}

async function resolveOrCreateLeague(league: SourceLeague) {
  const name = requiredString(league.name, "league.name");
  const ageGroup = parseAgeGroup(league.ageGroup);
  const organizerName = requiredString(league.organizerName, "league.organizerName");
  const city = optionalString(league.city) ?? "Quezon City";
  const region = optionalString(league.region) ?? "NCR";
  const existing = await prisma.league.findFirst({
    where: {
      name,
      ageGroup,
      deletedAt: null
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.league.create({
    data: {
      name,
      ageGroup,
      organizerName,
      city,
      region
    }
  });
}

async function resolveOrCreateSeason(data: SourceData, leagueId: string) {
  const name = requiredString(data.season?.name, "season.name");
  const seasonYear = requiredNumber(data.season?.seasonYear, "season.seasonYear");
  const { startsOn, endsOn } = getSeasonDates(data);
  const existing = await prisma.season.findUnique({
    where: {
      leagueId_name: {
        leagueId,
        name
      }
    }
  });

  if (existing && existing.deletedAt === null) {
    return existing;
  }

  if (existing) {
    throw new Error(`Season ${name} for league ${leagueId} is soft-deleted.`);
  }

  return prisma.season.create({
    data: {
      leagueId,
      name,
      seasonYear,
      status: SeasonStatus.ACTIVE,
      startsOn,
      endsOn
    }
  });
}

async function resolveOrCreateTeam(name: string) {
  const matches = await prisma.team.findMany({
    where: {
      name,
      deletedAt: null
    }
  });

  if (matches.length > 1) {
    throw new Error(`Multiple active teams found for ${name}.`);
  }

  if (matches.length === 1) {
    return matches[0];
  }

  return prisma.team.create({
    data: {
      name,
      city: "Metro Manila",
      region: "NCR"
    }
  });
}

async function resolveOrCreateGame(data: SourceData, sourceGame: SourceGame, seasonId: string) {
  const gameNumber = requiredString(sourceGame.gameNumber, "game.gameNumber");
  const homeTeamName = requiredString(sourceGame.homeTeamName, "game.homeTeamName");
  const awayTeamName = requiredString(sourceGame.awayTeamName, "game.awayTeamName");
  const homeTeam = await resolveOrCreateTeam(homeTeamName);
  const awayTeam = await resolveOrCreateTeam(awayTeamName);
  const gameData = {
    seasonId,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    gameNumber,
    gameDate: parseDateAtUtcMidnight(sourceGame.gameDate, "game.gameDate"),
    city: optionalString(sourceGame.city) ?? "Metro Manila",
    region: optionalString(sourceGame.region) ?? "NCR",
    sourceName: optionalString(sourceGame.sourceName) ?? "UAAP Season 88 HS Basketball box score",
    sourceUrl: optionalString(sourceGame.sourceUrl),
    submissionType: SubmissionType.STAFF_MANUAL_ENTRY,
    verificationStatus: VerificationStatus.SUBMITTED,
    homeScore: requiredNumber(sourceGame.homeScore, "game.homeScore"),
    awayScore: requiredNumber(sourceGame.awayScore, "game.awayScore")
  };
  const matches = await prisma.game.findMany({
    where: {
      gameNumber,
      seasonId,
      deletedAt: null
    }
  });

  if (matches.length > 1) {
    throw new Error(`Multiple active games found for ${gameNumber} in season ${seasonId}.`);
  }

  if (matches.length === 1) {
    const updated = await prisma.game.update({
      where: {
        id: matches[0].id
      },
      data: gameData
    });

    return { action: "updated" as ImportAction, record: updated };
  }

  const created = await prisma.game.create({
    data: gameData
  });

  return { action: "created" as ImportAction, record: created };
}

async function main() {
  let gamesCreated = 0;
  let gamesUpdated = 0;
  let totalGamesProcessed = 0;

  for (const relativePath of batchFiles) {
    const { data } = loadBatch(relativePath);
    const league = await resolveOrCreateLeague(data.league!);
    const season = await resolveOrCreateSeason(data, league.id);

    for (const sourceGame of data.games!) {
      const result = await resolveOrCreateGame(data, sourceGame, season.id);
      totalGamesProcessed += 1;

      if (result.action === "created") {
        gamesCreated += 1;
      } else {
        gamesUpdated += 1;
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        gamesCreated,
        gamesUpdated,
        totalGamesProcessed
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
