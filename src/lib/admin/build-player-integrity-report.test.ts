import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ProgramRole, VerificationStatus } from "@prisma/client";

import {
  buildPlayerIntegrityReport,
  type IntegrityDiagnostic,
  scoreIntegrityHealth,
} from "@/lib/admin/build-player-integrity-report";
import type { PlayerIntegrityContext } from "@/lib/admin/load-player-integrity-context";

function diagnostic(severity: IntegrityDiagnostic["severity"], id = "test"): IntegrityDiagnostic {
  return {
    id,
    section: "Test",
    severity,
    title: id,
    why: "why",
    howToFix: "fix",
  };
}

describe("scoreIntegrityHealth", () => {
  it("returns Excellent when no diagnostics", () => {
    const result = scoreIntegrityHealth([]);
    assert.equal(result.health, "Excellent");
    assert.equal(result.healthScore, 100);
  });

  it("returns Good with three warnings", () => {
    const result = scoreIntegrityHealth([
      diagnostic("WARNING", "w1"),
      diagnostic("WARNING", "w2"),
      diagnostic("WARNING", "w3"),
    ]);
    assert.equal(result.health, "Good");
    assert.equal(result.healthScore, 76);
  });

  it("returns Needs Attention with one error", () => {
    const result = scoreIntegrityHealth([diagnostic("ERROR")]);
    assert.equal(result.health, "Needs Attention");
    assert.equal(result.healthScore, 80);
  });

  it("returns Critical with two errors", () => {
    const result = scoreIntegrityHealth([diagnostic("ERROR", "e1"), diagnostic("ERROR", "e2")]);
    assert.equal(result.health, "Critical");
    assert.equal(result.healthScore, 60);
  });

  it("returns Critical when score drops below 50", () => {
    const result = scoreIntegrityHealth(Array.from({ length: 4 }, (_, index) => diagnostic("ERROR", `e${index}`)));
    assert.equal(result.health, "Critical");
    assert.equal(result.healthScore, 20);
  });
});

describe("buildPlayerIntegrityReport", () => {
  const basePlayer = {
    id: "player-1",
    displayName: "Juan Dela Cruz",
    firstName: "Juan",
    lastName: "Dela Cruz",
    birthDate: new Date("2010-05-01T00:00:00.000Z"),
    gender: "BOYS" as const,
    photoUrl: null,
    heightCm: null,
    position: null,
    schoolOverride: null,
    ageGroupOverride: null,
    classYearOverride: null,
    hometown: "Manila",
    region: "NCR",
    city: "Manila",
    profileSlug: "juan-dela-cruz",
    currentProgramId: null,
    commitmentStatus: "UNDECLARED" as const,
    committedUniversity: null,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-06-01T00:00:00.000Z"),
    deletedAt: null,
    currentProgram: null,
    currentRatings: [],
    rankingRows: [],
    gameStats: [],
    _count: { programHistory: 0, rankingRows: 0 },
  } satisfies PlayerIntegrityContext["player"];

  it("flags unassigned program and missing verified games", () => {
    const report = buildPlayerIntegrityReport({
      player: basePlayer,
      lastAudit: null,
      activePolicyVersionId: "policy-1",
      transferHistory: [],
    });

    assert.ok(report.diagnostics.some((item) => item.id === "program-unassigned"));
    assert.ok(report.diagnostics.some((item) => item.id === "competition-no-verified"));
    assert.equal(report.identity.slug, "juan-dela-cruz");
    assert.equal(report.program.assignmentStatus, "No explicit program");
  });

  it("flags group program assignment as error", () => {
    const report = buildPlayerIntegrityReport({
      player: {
        ...basePlayer,
        currentProgramId: "group-1",
        currentProgram: {
          id: "group-1",
          fullName: "De La Salle Philippines",
          abbreviation: "DLSU",
          programRole: ProgramRole.GROUP,
          deletedAt: null,
          parentProgram: null,
        },
      },
      lastAudit: null,
      activePolicyVersionId: "policy-1",
      transferHistory: [],
    });

    assert.ok(report.diagnostics.some((item) => item.id === "program-group-linked" && item.severity === "ERROR"));
  });

  it("derives current team from latest verified game", () => {
    const report = buildPlayerIntegrityReport({
      player: {
        ...basePlayer,
        currentProgramId: "prog-a",
        currentProgram: {
          id: "prog-a",
          fullName: "School A",
          abbreviation: "A",
          programRole: ProgramRole.OPERATIONAL,
          deletedAt: null,
          parentProgram: null,
        },
        gameStats: [
          {
            team: {
              id: "team-1",
              name: "School A Varsity",
              programId: "prog-a",
              program: {
                id: "prog-a",
                fullName: "School A",
                programRole: ProgramRole.OPERATIONAL,
                deletedAt: null,
              },
            },
            game: {
              id: "game-1",
              gameDate: new Date("2025-03-01T00:00:00.000Z"),
              verificationStatus: VerificationStatus.VERIFIED,
              submissionType: "STAFF_MANUAL_ENTRY",
              season: {
                name: "UAAP Season 87",
                deletedAt: null,
                league: { id: "league-1", name: "UAAP", tier: 1, deletedAt: null },
              },
            },
          },
        ],
      },
      lastAudit: null,
      activePolicyVersionId: "policy-1",
      transferHistory: [],
    });

    assert.equal(report.program.currentTeam, "School A Varsity");
    assert.equal(report.competition.verifiedGames, 1);
    assert.ok(!report.diagnostics.some((item) => item.id === "competition-no-verified"));
  });
});
