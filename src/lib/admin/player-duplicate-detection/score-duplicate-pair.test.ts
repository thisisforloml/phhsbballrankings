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
    assert.equal(confidenceBandForScore(93), "Almost Certain");
    assert.equal(confidenceBandForScore(76), "Very Likely");
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

  it("treats an added middle name as a strong identity match", () => {
    const scored = scoreDuplicatePair(
      record({ id: "a", displayName: "Patrick Pasinos", currentProgramId: "program-a" }),
      record({ id: "b", displayName: "Patrick Laurence Pasinos", currentProgramId: "program-a" }),
    );
    assert.ok(scored);
    assert.ok(scored.confidence >= 75);
    assert.ok(scored.signals.some((signal) => signal.label.includes("middle name")));
  });

  it("rejects pairs that share only a surname", () => {
    const left = record({ id: "a", displayName: "Gabo Yoro", currentProgramId: "program-a" });
    const right = record({ id: "b", displayName: "Migo Yoro", currentProgramId: "program-a" });
    assert.equal(passesDuplicatePrefilter(left, right), false);
    assert.equal(scoreDuplicatePair(left, right), null);
  });

  it("keeps a small last-name spelling difference when the first name matches", () => {
    const scored = scoreDuplicatePair(
      record({ id: "a", displayName: "Dean Paras" }),
      record({ id: "b", displayName: "Dean Parasa" }),
    );
    assert.ok(scored);
    assert.ok(scored.confidence >= 60);
    assert.ok(scored.signals.some((signal) => signal.label.includes("spelling variant")));
  });

  it("normalizes diacritics before comparing names", () => {
    const scored = scoreDuplicatePair(
      record({ id: "a", displayName: "Iñigo Garcia" }),
      record({ id: "b", displayName: "Inigo Garcia" }),
    );
    assert.ok(scored);
    assert.ok(scored.confidence >= 75);
  });

  it("does not treat compound surnames as shared middle-name evidence", () => {
    const scored = scoreDuplicatePair(
      record({ id: "a", displayName: "Prince Edizon Dela Cruz", currentProgramId: "program-a" }),
      record({ id: "b", displayName: "Prince Kean Jhamez Dela Cruz", currentProgramId: "program-a" }),
    );
    assert.ok(scored);
    assert.ok(scored.confidence < 60);
    assert.ok(scored.signals.some((signal) => signal.label === "Different additional names"));
  });

  it("treats two non-exact records in one official game as conflicting players", () => {
    const scored = scoreDuplicatePair(
      record({ id: "a", displayName: "Dwyne Enriquez", gameIds: new Set(["game-1"]) }),
      record({ id: "b", displayName: "Dwayne Enriquez", gameIds: new Set(["game-1"]) }),
    );
    assert.ok(scored);
    assert.ok(scored.confidence < 60);
    assert.ok(
      scored.signals.some((signal) => signal.label === "Both appear in the same official game"),
    );
  });
});

describe("duplicate detection index", () => {
  it("prefilters by first/last identity and scores only indexed candidates", () => {
    const players = [
      record({ id: "a", displayName: "Juan Dela Cruz", lastName: "Dela Cruz" }),
      record({ id: "b", displayName: "Juan Mateo Dela Cruz", lastName: "Dela Cruz" }),
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

  it("does not surface context-only matches", () => {
    const players = [
      record({ id: "a", displayName: "Gabo Yoro", lastName: "Yoro", currentProgramId: "prog-1" }),
      record({ id: "b", displayName: "Migo Yoro", lastName: "Yoro", currentProgramId: "prog-1" }),
    ];
    const corpus = buildDuplicateDetectionCorpus(players);
    const report = findDuplicateCandidatesForPlayer("a", corpus);
    assert.equal(report.candidates.length, 0);
  });
});
