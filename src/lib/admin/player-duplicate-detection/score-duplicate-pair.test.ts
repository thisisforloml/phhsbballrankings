import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDuplicateDetectionCorpus,
  collectIndexedCandidateIds,
} from "@/lib/admin/player-duplicate-detection/build-corpus";
import { confidenceBandForScore } from "@/lib/admin/player-duplicate-detection/confidence-band";
import { findDuplicateCandidatesForPlayer } from "@/lib/admin/player-duplicate-detection/find-duplicate-candidates";
import {
  passesDuplicatePrefilter,
  scoreDuplicatePair,
} from "@/lib/admin/player-duplicate-detection/score-duplicate-pair";
import type { DuplicatePlayerRecord } from "@/lib/admin/player-duplicate-detection/types";

function record(overrides: Partial<DuplicatePlayerRecord> & Pick<DuplicatePlayerRecord, "id" | "displayName">): DuplicatePlayerRecord {
  return {
    id: overrides.id,
    displayName: overrides.displayName,
    firstName: overrides.firstName ?? overrides.displayName.split(" ")[0] ?? "Test",
    lastName: overrides.lastName ?? (overrides.displayName.split(" ").slice(1).join(" ") || "Player"),
    gender: overrides.gender ?? "BOYS",
    birthDate: overrides.birthDate ?? null,
    heightCm: overrides.heightCm ?? null,
    photoUrl: overrides.photoUrl ?? null,
    currentProgramId: overrides.currentProgramId ?? null,
    currentProgramName: overrides.currentProgramName ?? null,
    parentGroupProgramId: overrides.parentGroupProgramId ?? null,
    parentGroupName: overrides.parentGroupName ?? null,
    aliases: overrides.aliases ?? [],
    externalIds: overrides.externalIds ?? [],
    teamIds: overrides.teamIds ?? new Set(),
    leagueIds: overrides.leagueIds ?? new Set(),
    seasonKeys: overrides.seasonKeys ?? new Set(),
    gameIds: overrides.gameIds ?? new Set(),
    dominantHand: overrides.dominantHand ?? null,
    portraitHash: overrides.portraitHash ?? null,
  };
}

describe("confidenceBandForScore", () => {
  it("maps score ranges to bands", () => {
    assert.equal(confidenceBandForScore(98), "Almost Certain");
    assert.equal(confidenceBandForScore(85), "Very Likely");
    assert.equal(confidenceBandForScore(70), "Possible");
    assert.equal(confidenceBandForScore(40), "Low Confidence");
  });
});

describe("scoreDuplicatePair", () => {
  it("scores exact identity matches as almost certain", () => {
    const birthDate = new Date("2010-01-15T00:00:00.000Z");
    const target = record({
      id: "a",
      displayName: "Juan Dela Cruz",
      birthDate,
      heightCm: 180,
      currentProgramId: "prog-1",
      currentProgramName: "School A",
    });
    const candidate = record({
      id: "b",
      displayName: "Juan Dela Cruz",
      birthDate,
      heightCm: 180,
      currentProgramId: "prog-1",
      currentProgramName: "School A",
    });

    const scored = scoreDuplicatePair(target, candidate);
    assert.ok(scored);
    assert.ok(scored.confidence >= 95);
    assert.ok(scored.signals.some((signal) => signal.label === "Exact display name"));
    assert.ok(scored.signals.some((signal) => signal.label === "Same birthdate"));
  });

  it("excludes different genders", () => {
    const target = record({ id: "a", displayName: "Alex Santos", gender: "BOYS" });
    const candidate = record({ id: "b", displayName: "Alex Santos", gender: "GIRLS" });
    assert.equal(scoreDuplicatePair(target, candidate), null);
  });

  it("adds conflicting birthdate signal", () => {
    const target = record({
      id: "a",
      displayName: "Alex Santos",
      birthDate: new Date("2010-01-01T00:00:00.000Z"),
    });
    const candidate = record({
      id: "b",
      displayName: "Alex Santos",
      birthDate: new Date("2011-01-01T00:00:00.000Z"),
    });

    const scored = scoreDuplicatePair(target, candidate);
    assert.ok(scored);
    assert.ok(scored.signals.some((signal) => signal.kind === "conflict" && signal.label === "Different birthdate"));
  });
});

describe("duplicate detection index", () => {
  it("prefilters by surname and scores only indexed candidates", () => {
    const players = [
      record({ id: "a", displayName: "Juan Dela Cruz", lastName: "Dela Cruz" }),
      record({ id: "b", displayName: "Juan DC", lastName: "Dela Cruz" }),
      record({ id: "c", displayName: "Maria Lopez", lastName: "Lopez" }),
    ];
    const corpus = buildDuplicateDetectionCorpus(players);
    const target = corpus.playersById.get("a");
    assert.ok(target);

    const indexed = collectIndexedCandidateIds(target, corpus.index);
    assert.ok(indexed.has("b"));
    assert.ok(!indexed.has("c"));
    assert.ok(passesDuplicatePrefilter(target, corpus.playersById.get("b")!));

    const report = findDuplicateCandidatesForPlayer("a", corpus);
    assert.ok(report.candidates.some((candidate) => candidate.player.playerId === "b"));
    assert.ok(!report.candidates.some((candidate) => candidate.player.playerId === "c"));
  });

  it("keeps low-confidence candidates visible", () => {
    const players = [
      record({ id: "a", displayName: "Chris Gomez", lastName: "Gomez", currentProgramId: "prog-1" }),
      record({ id: "b", displayName: "Chrys Gomez", lastName: "Gomez", currentProgramId: "prog-1" }),
    ];
    const corpus = buildDuplicateDetectionCorpus(players);
    const report = findDuplicateCandidatesForPlayer("a", corpus);
    assert.ok(report.candidates.length > 0);
    assert.ok(report.candidates.every((candidate) => candidate.confidence >= 0));
  });
});
