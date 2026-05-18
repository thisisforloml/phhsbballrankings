import "server-only";

import fs from "node:fs";
import path from "node:path";

export const validatedUaapBatchFiles = [
  "scripts/data/uaap-s88-hs-boys-batch-01.json",
  "scripts/data/uaap-s88-hs-boys-batch-02.json",
  "scripts/data/uaap-s88-hs-boys-batch-03.json",
  "scripts/data/uaap-s88-hs-boys-batch-04.json",
  "scripts/data/uaap-s88-hs-boys-batch-05.json",
  "scripts/data/uaap-s88-hs-boys-batch-06.json",
  "scripts/data/uaap-s88-hs-girls-batch-01.json",
  "scripts/data/uaap-s88-hs-girls-batch-02.json"
];

type SourcePlayer = {
  name: string;
  team: string;
  PTS: number;
};

type SourceGame = {
  gameNumber: string;
  gameDate: string;
  game: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  city: string;
  region: string;
  sourceName: string;
  players: SourcePlayer[];
};

type SourceBatch = {
  league: {
    name: string;
    ageGroup: "U19";
    organizerName: string;
    city: string;
    region: string;
  };
  season: {
    id?: string;
    name: string;
    seasonYear: number;
  };
  games: SourceGame[];
};

export type ValidatedUaapGame = SourceGame & {
  leagueName: string;
  ageGroup: "U19";
  seasonName: string;
  batchFile: string;
  gender: "Boys" | "Girls";
};

let cachedGames: ValidatedUaapGame[] | null = null;

function inferGender(leagueName: string): "Boys" | "Girls" {
  return leagueName.toLowerCase().includes("girls") ? "Girls" : "Boys";
}

export function loadValidatedUaapGames(): ValidatedUaapGame[] {
  if (cachedGames) return cachedGames;

  cachedGames = validatedUaapBatchFiles.flatMap((file) => {
    const batch = JSON.parse(fs.readFileSync(path.join(process.cwd(), file), "utf8")) as SourceBatch;
    return batch.games.map((game) => ({
      ...game,
      leagueName: batch.league.name,
      ageGroup: batch.league.ageGroup,
      seasonName: batch.season.name,
      batchFile: file,
      gender: inferGender(batch.league.name)
    }));
  });

  return cachedGames;
}

export function getValidatedUaapGameNumbers(): Set<string> {
  return new Set(loadValidatedUaapGames().map((game) => game.gameNumber));
}
