import { readFileSync } from "node:fs";
import { PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const dataFilePath = "D:\\OnCourt Rankings PH\\scripts\\data\\uaap-s88-hs-boys-10-games.json";

const playerDefaults = {
  gender: PlayerGender.BOYS,
  city: "Metro Manila",
  region: "NCR",
  birthDate: null,
  photoUrl: null,
  heightCm: null,
  position: null
};

type ImportAction = "created" | "reused";

type SourcePlayer = {
  name?: unknown;
};

type SourceGame = {
  players?: SourcePlayer[];
};

type SourceData = {
  games?: SourceGame[];
};

function cleanPlayerName(name: unknown) {
  if (typeof name !== "string") {
    throw new Error(`Invalid player name: ${String(name)}`);
  }

  const cleaned = name.replace(/^\*+/, "").trim();

  if (!cleaned) {
    throw new Error("Encountered an empty player name after cleaning.");
  }

  return cleaned;
}

function parseName(displayName: string) {
  const tokens = displayName.split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    throw new Error("Cannot parse empty displayName.");
  }

  if (tokens.length === 1) {
    return {
      firstName: tokens[0],
      lastName: tokens[0]
    };
  }

  return {
    firstName: tokens[0],
    lastName: tokens.slice(1).join(" ")
  };
}

function loadUniquePlayerNames() {
  const raw = readFileSync(dataFilePath, "utf8");
  const data = JSON.parse(raw) as SourceData;

  if (!Array.isArray(data.games)) {
    throw new Error("Expected data.games to be an array.");
  }

  const names = new Set<string>();

  for (const game of data.games) {
    if (!Array.isArray(game.players)) {
      throw new Error("Expected every game to include a players array.");
    }

    for (const player of game.players) {
      names.add(cleanPlayerName(player.name));
    }
  }

  return [...names].sort((left, right) => left.localeCompare(right));
}

async function resolveOrCreatePlayer(displayName: string) {
  const matches = await prisma.player.findMany({
    where: {
      displayName,
      gender: PlayerGender.BOYS,
      deletedAt: null
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  if (matches.length > 1) {
    throw new Error(`Multiple active BOYS players found for displayName: ${displayName}`);
  }

  if (matches.length === 1) {
    return {
      action: "reused" as ImportAction,
      record: matches[0]
    };
  }

  const parsedName = parseName(displayName);
  const created = await prisma.player.create({
    data: {
      ...parsedName,
      displayName,
      ...playerDefaults
    }
  });

  return {
    action: "created" as ImportAction,
    record: created
  };
}

async function main() {
  const uniquePlayerNames = loadUniquePlayerNames();
  const players = [];

  for (const displayName of uniquePlayerNames) {
    players.push(await resolveOrCreatePlayer(displayName));
  }

  const counts = players.reduce(
    (accumulator, player) => {
      if (player.action === "created") {
        accumulator.playersCreated += 1;
      } else {
        accumulator.playersReused += 1;
      }

      return accumulator;
    },
    { playersCreated: 0, playersReused: 0 }
  );

  console.log(
    JSON.stringify(
      {
        playersCreated: counts.playersCreated,
        playersReused: counts.playersReused,
        totalUniquePlayers: uniquePlayerNames.length,
        players: players.map((player) => ({
          action: player.action,
          id: player.record.id,
          displayName: player.record.displayName,
          firstName: player.record.firstName,
          lastName: player.record.lastName
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
