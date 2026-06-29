import { readFileSync } from "node:fs";
import path from "node:path";
import { PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

/**
 * Legacy batch player import. Resolves players by exact displayName + gender only.
 * Does NOT use PlayerAlias resolution — use official submission import for new data.
 */

const projectRoot = "D:\\Peach Basket";

const batchFiles = [
  { path: "scripts/data/uaap-s88-hs-boys-batch-01.json", gender: PlayerGender.BOYS },
  { path: "scripts/data/uaap-s88-hs-boys-batch-02.json", gender: PlayerGender.BOYS },
  { path: "scripts/data/uaap-s88-hs-boys-batch-03.json", gender: PlayerGender.BOYS },
  { path: "scripts/data/uaap-s88-hs-boys-batch-04.json", gender: PlayerGender.BOYS },
  { path: "scripts/data/uaap-s88-hs-boys-batch-05.json", gender: PlayerGender.BOYS },
  { path: "scripts/data/uaap-s88-hs-boys-batch-06.json", gender: PlayerGender.BOYS },
  { path: "scripts/data/uaap-s88-hs-girls-batch-01.json", gender: PlayerGender.GIRLS },
  { path: "scripts/data/uaap-s88-hs-girls-batch-02.json", gender: PlayerGender.GIRLS }
] as const;

type SourcePlayer = {
  name?: unknown;
};

type SourceGame = {
  players?: SourcePlayer[];
};

type SourceData = {
  games?: SourceGame[];
};

type ImportAction = "created" | "reused";

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

function loadBatch(relativePath: string) {
  const fullPath = path.join(projectRoot, relativePath);
  const raw = readFileSync(fullPath, "utf8");
  const data = JSON.parse(raw) as SourceData;

  if (!Array.isArray(data.games)) {
    throw new Error(`${relativePath} is missing games array.`);
  }

  return data;
}

function loadUniquePlayers() {
  const players = new Map<string, { displayName: string; gender: PlayerGender }>();

  for (const batch of batchFiles) {
    const data = loadBatch(batch.path);

    for (const game of data.games!) {
      if (!Array.isArray(game.players)) {
        throw new Error(`${batch.path} contains a game without players array.`);
      }

      for (const player of game.players) {
        const displayName = cleanPlayerName(player.name);
        const key = `${batch.gender}:${displayName}`;
        players.set(key, { displayName, gender: batch.gender });
      }
    }
  }

  return [...players.values()].sort((left, right) => `${left.gender}:${left.displayName}`.localeCompare(`${right.gender}:${right.displayName}`));
}

async function resolveOrCreatePlayer(displayName: string, gender: PlayerGender) {
  const matches = await prisma.player.findMany({
    where: {
      displayName,
      gender,
      deletedAt: null
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  if (matches.length > 1) {
    throw new Error(`Multiple active ${gender} players found for displayName: ${displayName}`);
  }

  if (matches.length === 1) {
    return { action: "reused" as ImportAction, record: matches[0] };
  }

  const parsedName = parseName(displayName);
  const created = await prisma.player.create({
    data: {
      ...parsedName,
      displayName,
      gender,
      city: "Metro Manila",
      region: "NCR",
      birthDate: null,
      photoUrl: null,
      heightCm: null,
      position: null
    }
  });

  return { action: "created" as ImportAction, record: created };
}

async function main() {
  const uniquePlayers = loadUniquePlayers();
  let playersCreated = 0;
  let playersReused = 0;

  for (const player of uniquePlayers) {
    const result = await resolveOrCreatePlayer(player.displayName, player.gender);

    if (result.action === "created") {
      playersCreated += 1;
    } else {
      playersReused += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        playersCreated,
        playersReused,
        totalUniquePlayers: uniquePlayers.length
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
