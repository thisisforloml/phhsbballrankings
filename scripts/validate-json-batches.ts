import { readFileSync, existsSync } from "node:fs";

const batchFiles = [
  {
    label: "boys batch 01",
    path: "D:\\Peach Basket\\scripts\\data\\uaap-s88-hs-boys-batch-01.json",
    expectedGames: 10
  },
  {
    label: "boys batch 02",
    path: "D:\\Peach Basket\\scripts\\data\\uaap-s88-hs-boys-batch-02.json",
    expectedGames: 10
  },
  {
    label: "boys batch 03",
    path: "D:\\Peach Basket\\scripts\\data\\uaap-s88-hs-boys-batch-03.json",
    expectedGames: 10
  },
  {
    label: "boys batch 04",
    path: "D:\\Peach Basket\\scripts\\data\\uaap-s88-hs-boys-batch-04.json",
    expectedGames: 10
  },
  {
    label: "boys batch 05",
    path: "D:\\Peach Basket\\scripts\\data\\uaap-s88-hs-boys-batch-05.json",
    expectedGames: 11
  },
  {
    label: "boys batch 06",
    path: "D:\\Peach Basket\\scripts\\data\\uaap-s88-hs-boys-batch-06.json",
    expectedGames: 11
  },
  {
    label: "girls batch 01",
    path: "D:\\Peach Basket\\scripts\\data\\uaap-s88-hs-girls-batch-01.json",
    expectedGames: 10
  },
  {
    label: "girls batch 02",
    path: "D:\\Peach Basket\\scripts\\data\\uaap-s88-hs-girls-batch-02.json",
    expectedGames: 4
  }
] as const;

const requiredGameFields = [
  "gameNumber",
  "gameDate",
  "game",
  "homeTeamName",
  "awayTeamName",
  "homeScore",
  "awayScore",
  "city",
  "region",
  "sourceName",
  "players"
] as const;

const requiredPlayerFields = [
  "name",
  "team",
  "MIN",
  "PTS",
  "FGM",
  "FGA",
  "3PM",
  "3PA",
  "FTM",
  "FTA",
  "OREB",
  "DREB",
  "TRB",
  "AST",
  "PF",
  "FD",
  "+/-"
] as const;

const corruptedEncodingMarkers = ["Ã", "Â", "�"] as const;

type Issue = {
  file: string;
  label: string;
  type: string;
  message: string;
  gameNumber?: string;
  playerName?: string;
  teamName?: string;
};

type SourcePlayer = Record<string, unknown>;
type SourceGame = Record<string, unknown> & {
  players?: SourcePlayer[];
};
type SourceData = {
  games?: SourceGame[];
};

type PerFileSummary = {
  label: string;
  path: string;
  exists: boolean;
  validJson: boolean;
  expectedGames: number;
  actualGames: number;
  gameCountMatches: boolean;
  totalPlayerRows: number;
  duplicateGameNumbersWithinFile: string[];
  issueCount: number;
  passed: boolean;
};

function hasOwn(object: object, field: string) {
  return Object.prototype.hasOwnProperty.call(object, field);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function addIssue(issues: Issue[], file: (typeof batchFiles)[number], type: string, message: string, extra: Partial<Issue> = {}) {
  issues.push({
    file: file.path,
    label: file.label,
    type,
    message,
    ...extra
  });
}

function findCorruptedMarkers(raw: string) {
  return corruptedEncodingMarkers.filter((marker) => raw.includes(marker));
}

function validateGameFields(file: (typeof batchFiles)[number], game: SourceGame, gameIndex: number, issues: Issue[]) {
  for (const field of requiredGameFields) {
    if (!hasOwn(game, field)) {
      addIssue(issues, file, "missingGameField", `games[${gameIndex}] is missing ${field}.`, {
        gameNumber: stringValue(game.gameNumber)
      });
    }
  }

  if (hasOwn(game, "players") && !Array.isArray(game.players)) {
    addIssue(issues, file, "invalidPlayersField", `games[${gameIndex}].players must be an array.`, {
      gameNumber: stringValue(game.gameNumber)
    });
  }
}

function validatePlayerFields(
  file: (typeof batchFiles)[number],
  game: SourceGame,
  player: SourcePlayer,
  gameIndex: number,
  playerIndex: number,
  issues: Issue[]
) {
  for (const field of requiredPlayerFields) {
    if (!hasOwn(player, field)) {
      addIssue(issues, file, "missingPlayerField", `games[${gameIndex}].players[${playerIndex}] is missing ${field}.`, {
        gameNumber: stringValue(game.gameNumber),
        playerName: stringValue(player.name),
        teamName: stringValue(player.team)
      });
    }
  }
}

function validatePlayerTeam(
  file: (typeof batchFiles)[number],
  game: SourceGame,
  player: SourcePlayer,
  issues: Issue[]
) {
  const teamName = stringValue(player.team);
  const homeTeamName = stringValue(game.homeTeamName);
  const awayTeamName = stringValue(game.awayTeamName);

  if (teamName && teamName !== homeTeamName && teamName !== awayTeamName) {
    addIssue(issues, file, "playerTeamMismatch", "Player team is not one of the game's homeTeamName or awayTeamName.", {
      gameNumber: stringValue(game.gameNumber),
      playerName: stringValue(player.name),
      teamName
    });
  }
}

function validatePointTotals(file: (typeof batchFiles)[number], game: SourceGame, players: SourcePlayer[], issues: Issue[]) {
  const homeTeamName = stringValue(game.homeTeamName);
  const awayTeamName = stringValue(game.awayTeamName);
  const homeScore = numberValue(game.homeScore);
  const awayScore = numberValue(game.awayScore);
  let summedHomePlayerPoints = 0;
  let summedAwayPlayerPoints = 0;

  for (const player of players) {
    const points = numberValue(player.PTS);
    const teamName = stringValue(player.team);

    if (points === null) {
      continue;
    }

    if (teamName === homeTeamName) {
      summedHomePlayerPoints += points;
    } else if (teamName === awayTeamName) {
      summedAwayPlayerPoints += points;
    }
  }

  if (homeScore !== null && summedHomePlayerPoints !== homeScore) {
    addIssue(issues, file, "homePointTotalMismatch", `Summed home player PTS ${summedHomePlayerPoints} does not equal homeScore ${homeScore}.`, {
      gameNumber: stringValue(game.gameNumber),
      teamName: homeTeamName
    });
  }

  if (awayScore !== null && summedAwayPlayerPoints !== awayScore) {
    addIssue(issues, file, "awayPointTotalMismatch", `Summed away player PTS ${summedAwayPlayerPoints} does not equal awayScore ${awayScore}.`, {
      gameNumber: stringValue(game.gameNumber),
      teamName: awayTeamName
    });
  }
}

function validateFile(file: (typeof batchFiles)[number], globalGameNumbers: Map<string, string[]>) {
  const issues: Issue[] = [];
  const duplicateGameNumbersWithinFile: string[] = [];
  let exists = false;
  let validJson = false;
  let actualGames = 0;
  let totalPlayerRows = 0;

  if (!existsSync(file.path)) {
    addIssue(issues, file, "fileMissing", "File does not exist.");
    return {
      summary: {
        label: file.label,
        path: file.path,
        exists,
        validJson,
        expectedGames: file.expectedGames,
        actualGames,
        gameCountMatches: false,
        totalPlayerRows,
        duplicateGameNumbersWithinFile,
        issueCount: issues.length,
        passed: false
      } satisfies PerFileSummary,
      issues
    };
  }

  exists = true;
  const raw = readFileSync(file.path, "utf8");
  const corruptedMarkers = findCorruptedMarkers(raw);

  for (const marker of corruptedMarkers) {
    addIssue(issues, file, "corruptedEncodingMarker", `File contains corrupted encoding marker: ${marker}`);
  }

  let data: SourceData;

  try {
    data = JSON.parse(raw) as SourceData;
    validJson = true;
  } catch (error) {
    addIssue(issues, file, "invalidJson", error instanceof Error ? error.message : String(error));
    return {
      summary: {
        label: file.label,
        path: file.path,
        exists,
        validJson,
        expectedGames: file.expectedGames,
        actualGames,
        gameCountMatches: false,
        totalPlayerRows,
        duplicateGameNumbersWithinFile,
        issueCount: issues.length,
        passed: false
      } satisfies PerFileSummary,
      issues
    };
  }

  const games = Array.isArray(data.games) ? data.games : [];
  actualGames = games.length;

  if (!Array.isArray(data.games)) {
    addIssue(issues, file, "missingGamesArray", "Top-level games must be an array.");
  }

  if (actualGames !== file.expectedGames) {
    addIssue(issues, file, "gameCountMismatch", `Expected ${file.expectedGames} games but found ${actualGames}.`);
  }

  const gameNumbersInFile = new Map<string, number>();

  for (let gameIndex = 0; gameIndex < games.length; gameIndex += 1) {
    const game = games[gameIndex];
    const gameNumber = stringValue(game.gameNumber);
    validateGameFields(file, game, gameIndex, issues);

    if (gameNumber) {
      gameNumbersInFile.set(gameNumber, (gameNumbersInFile.get(gameNumber) ?? 0) + 1);
      const globalEntries = globalGameNumbers.get(gameNumber) ?? [];
      globalEntries.push(file.label);
      globalGameNumbers.set(gameNumber, globalEntries);
    }

    const players = Array.isArray(game.players) ? game.players : [];
    totalPlayerRows += players.length;

    for (let playerIndex = 0; playerIndex < players.length; playerIndex += 1) {
      const player = players[playerIndex];
      validatePlayerFields(file, game, player, gameIndex, playerIndex, issues);
      validatePlayerTeam(file, game, player, issues);
    }

    validatePointTotals(file, game, players, issues);
  }

  for (const [gameNumber, count] of gameNumbersInFile.entries()) {
    if (count > 1) {
      duplicateGameNumbersWithinFile.push(gameNumber);
      addIssue(issues, file, "duplicateGameNumberWithinFile", `Game number appears ${count} times in this file.`, {
        gameNumber
      });
    }
  }

  return {
    summary: {
      label: file.label,
      path: file.path,
      exists,
      validJson,
      expectedGames: file.expectedGames,
      actualGames,
      gameCountMatches: actualGames === file.expectedGames,
      totalPlayerRows,
      duplicateGameNumbersWithinFile,
      issueCount: issues.length,
      passed: issues.length === 0
    } satisfies PerFileSummary,
    issues
  };
}

function main() {
  const globalGameNumbers = new Map<string, string[]>();
  const perFileResults = batchFiles.map((file) => validateFile(file, globalGameNumbers));
  const allIssues = perFileResults.flatMap((result) => result.issues);
  const duplicateGameNumbersAcrossFiles = [...globalGameNumbers.entries()]
    .filter(([, labels]) => labels.length > 1)
    .map(([gameNumber, labels]) => ({
      gameNumber,
      files: labels
    }));

  for (const duplicate of duplicateGameNumbersAcrossFiles) {
    allIssues.push({
      file: "all",
      label: "all files",
      type: "duplicateGameNumberAcrossFiles",
      message: `Game number appears in multiple files: ${duplicate.files.join(", ")}`,
      gameNumber: duplicate.gameNumber
    });
  }

  const perFileSummary = perFileResults.map((result) => result.summary);
  const totalGames = perFileSummary.reduce((sum, file) => sum + file.actualGames, 0);
  const totalPlayerRows = perFileSummary.reduce((sum, file) => sum + file.totalPlayerRows, 0);
  const filesPassed = perFileSummary.filter((file) => file.passed).length;
  const filesFailed = perFileSummary.length - filesPassed;

  console.log(
    JSON.stringify(
      {
        totalFiles: batchFiles.length,
        totalGames,
        totalPlayerRows,
        filesPassed,
        filesFailed,
        perFileSummary,
        allIssues,
        validationPassed: allIssues.length === 0
      },
      null,
      2
    )
  );
}

main();
