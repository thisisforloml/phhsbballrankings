import assert from "node:assert/strict";
import test from "node:test";

import {
  findPlayerMappingDecision,
  readPlayerMappingDecisionMap,
  serializePlayerMappingDecisions,
} from "./submission-player-mapping-decisions";

test("saved player mappings resolve with both imported and mapped team labels", () => {
  const validationSummary = {
    importPlayerMappingDecisions: serializePlayerMappingDecisions([
      {
        importedName: "Juan Dela Cruz",
        cleanedName: "Juan Dela Cruz",
        teamLabel: "Sample School U19 Boys",
        mappedTeamName: "Sample School Juniors",
        action: "mapped_existing" as const,
        playerId: "player-1",
        playerName: "Juan P. Dela Cruz",
      },
    ]),
  };

  const decisions = readPlayerMappingDecisionMap(validationSummary);
  assert.equal(
    findPlayerMappingDecision(decisions, "Sample School U19 Boys", "Juan Dela Cruz")?.playerId,
    "player-1",
  );
  assert.equal(
    findPlayerMappingDecision(decisions, "Sample School Juniors", "Juan Dela Cruz")?.playerId,
    "player-1",
  );
});

test("create-on-import remains an explicit stored decision", () => {
  const validationSummary = {
    importPlayerMappingDecisions: serializePlayerMappingDecisions([
      {
        importedName: "New Player",
        cleanedName: "New Player",
        teamLabel: "Sample U16 Boys",
        mappedTeamName: null,
        action: "create_on_import" as const,
      },
    ]),
  };

  const decision = findPlayerMappingDecision(
    readPlayerMappingDecisionMap(validationSummary),
    "Sample U16 Boys",
    "New Player",
  );
  assert.equal(decision?.action, "create_on_import");
  assert.equal(decision?.playerId, null);
});
