import { ProgramRole } from "@prisma/client";

import {
  isOfficialVerifiedGame,
  type PlayerIntegrityContext,
} from "@/lib/admin/load-player-integrity-context";
import type { PlayerProgramTransferHistoryRow } from "@/lib/admin/load-player-transfer-history";
import { resolveAdminPlayerStats } from "@/lib/admin/resolve-admin-player-stats";
import { slugify } from "@/lib/format";
import { buildCompetitionParticipationFromStats, type GameStatWithLeague } from "@/lib/player-competition-context";
import { getAgeBracketAsOfMarch31, getClassYear } from "@/lib/ranking-eligibility";

export type IntegritySeverity = "INFO" | "WARNING" | "ERROR";

export type IntegrityHealth = "Excellent" | "Good" | "Needs Attention" | "Critical";

export type IntegrityDiagnostic = {
  id: string;
  section: string;
  severity: IntegritySeverity;
  title: string;
  why: string;
  howToFix: string;
};

export type PlayerIntegrityReport = {
  health: IntegrityHealth;
  healthScore: number;
  diagnostics: IntegrityDiagnostic[];
  identity: {
    playerId: string;
    slug: string;
    birthDate: string | null;
    ageGroup: string;
    gender: string;
    nationality: string;
    portraitStatus: string;
    schoolOverrideStatus: string;
  };
  program: {
    currentProgram: string | null;
    parentGroup: string | null;
    currentTeam: string | null;
    assignmentStatus: string;
  };
  competition: {
    verifiedGames: number;
    competitionsPlayed: number;
    latestCompetition: string | null;
    latestSeason: string | null;
    latestVerifiedGame: string | null;
  };
  ratings: {
    currentRating: string | null;
    stars: string | null;
    snapshotCount: number;
    latestSnapshot: string | null;
    formulaVersion: string | null;
  };
  profile: {
    photo: string;
    bio: string;
    height: string;
    position: string | null;
    handedness: string;
    recruitingClass: string | null;
    highlights: string;
  };
  administrative: {
    transferHistoryCount: number;
    lastTransfer: string | null;
    lastEditor: string | null;
    createdAt: string;
    updatedAt: string;
    softDeleteStatus: string;
  };
};

type BuildInput = PlayerIntegrityContext & {
  transferHistory: PlayerProgramTransferHistoryRow[];
};

function formatDate(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : null;
}

function resolveLatestVerifiedTeamName(
  gameStats: PlayerIntegrityContext["player"]["gameStats"],
): { teamName: string | null; programId: string | null } {
  const verified = gameStats.filter((stat) => isOfficialVerifiedGame(stat.game.verificationStatus));
  if (!verified.length) return { teamName: null, programId: null };
  const latest = verified[0];
  return {
    teamName: latest.team.name,
    programId: latest.team.programId,
  };
}

export function scoreIntegrityHealth(diagnostics: IntegrityDiagnostic[]): {
  health: IntegrityHealth;
  healthScore: number;
} {
  let healthScore = 100;
  let errorCount = 0;
  let warningCount = 0;

  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === "ERROR") {
      healthScore -= 20;
      errorCount += 1;
    } else if (diagnostic.severity === "WARNING") {
      healthScore -= 8;
      warningCount += 1;
    } else {
      healthScore -= 2;
    }
  }

  healthScore = Math.max(0, healthScore);

  if (errorCount >= 2 || healthScore < 50) {
    return { health: "Critical", healthScore };
  }
  if (errorCount >= 1 || healthScore < 65) {
    return { health: "Needs Attention", healthScore };
  }
  if (warningCount >= 3 || healthScore < 85) {
    return { health: "Good", healthScore };
  }
  return { health: "Excellent", healthScore };
}

export function buildPlayerIntegrityReport(input: BuildInput): PlayerIntegrityReport {
  const { player, lastAudit, transferHistory } = input;
  const diagnostics: IntegrityDiagnostic[] = [];

  const computedAgeBracket = getAgeBracketAsOfMarch31(player.birthDate);
  const displayAgeBracket = player.ageGroupOverride || computedAgeBracket || "Unknown";
  const recruitingClassYear = player.classYearOverride ?? getClassYear(player.birthDate);
  const slug = player.profileSlug ?? slugify(player.displayName);

  const officialStats = player.gameStats.filter((stat) => isOfficialVerifiedGame(stat.game.verificationStatus));
  const unofficialOnly =
    player.gameStats.length > 0 && officialStats.length === 0;
  const competitionStats: GameStatWithLeague[] = officialStats.map((stat) => ({
    game: {
      gameDate: stat.game.gameDate,
      season: {
        name: stat.game.season.name,
        league: {
          id: stat.game.season.league.id,
          name: stat.game.season.league.name,
          tier: stat.game.season.league.tier,
        },
      },
    },
  }));
  const competition = buildCompetitionParticipationFromStats(competitionStats);
  const latestOfficialGame = officialStats[0]?.game ?? null;
  const { teamName: currentTeamName, programId: evidenceProgramId } = resolveLatestVerifiedTeamName(player.gameStats);

  const adminStats = resolveAdminPlayerStats({
    birthDate: player.birthDate,
    ageGroupOverride: player.ageGroupOverride,
    currentRatings: player.currentRatings,
    gameStats: officialStats.map((stat) => ({ game: { id: stat.game.id } })),
  });

  const activeRatingsForBracket = player.currentRatings.filter((rating) => rating.ageGroup === displayAgeBracket);
  const primaryRating = activeRatingsForBracket[0] ?? player.currentRatings[0] ?? null;
  const latestSnapshotRow = player.rankingRows[0] ?? null;
  const currentProgram = player.currentProgram;
  const currentProgramLabel =
    currentProgram && currentProgram.programRole === ProgramRole.OPERATIONAL && !currentProgram.deletedAt
      ? currentProgram.fullName
      : null;
  const parentGroup =
    currentProgram?.parentProgram?.programRole === ProgramRole.GROUP
      ? currentProgram.parentProgram.fullName
      : null;

  let assignmentStatus = "Unassigned";
  if (currentProgram?.deletedAt) assignmentStatus = "Archived program linked";
  else if (currentProgram?.programRole === ProgramRole.GROUP) assignmentStatus = "Organization linked directly (invalid)";
  else if (player.currentProgramId) assignmentStatus = "Explicit operational program";
  else assignmentStatus = "No explicit program";

  if (!player.currentProgramId) {
    diagnostics.push({
      id: "program-unassigned",
      section: "Program Integrity",
      severity: "WARNING",
      title: "No program assigned",
      why: "Player.currentProgramId is empty, so public affiliation may fall back to game-evidence inference.",
      howToFix: "Use Program assignment on the player admin panel to set an explicit operational program.",
    });
  }

  if (currentProgram?.deletedAt) {
    diagnostics.push({
      id: "program-archived",
      section: "Program Integrity",
      severity: "ERROR",
      title: "Archived program assigned",
      why: "The linked program record is soft-deleted but still referenced on the player.",
      howToFix: "Transfer the player to an active operational program or remove the stale program link.",
    });
  }

  if (currentProgram?.programRole === ProgramRole.GROUP) {
    diagnostics.push({
      id: "program-group-linked",
      section: "Program Integrity",
      severity: "ERROR",
      title: "Organization assigned directly",
      why: "Organizations group Programs and must not own players directly.",
      howToFix: "Transfer or assign the player to an operational Program.",
    });
  }

  if (
    player.currentProgramId &&
    evidenceProgramId &&
    evidenceProgramId !== player.currentProgramId
  ) {
    diagnostics.push({
      id: "program-team-mismatch",
      section: "Program Integrity",
      severity: "WARNING",
      title: "Current team belongs to a different operational program",
      why: "Latest verified game evidence is tied to a team whose programId does not match the player's currentProgramId.",
      howToFix: "Confirm the correct program assignment or review whether recent game stats were imported under the expected team.",
    });
  }

  if (!currentTeamName) {
    diagnostics.push({
      id: "program-no-team-evidence",
      section: "Program Integrity",
      severity: "INFO",
      title: "No verified team evidence",
      why: "No verified or submitted official games were found for this player.",
      howToFix: "No action required until verified games are imported; team display will remain empty.",
    });
  }

  if (!officialStats.length) {
    diagnostics.push({
      id: "competition-no-verified",
      section: "Competition Integrity",
      severity: "WARNING",
      title: "No verified games",
      why: "This player has no official verified or submitted games in the evidence chain.",
      howToFix: "Import and verify official game submissions, or confirm the player should remain off public competition surfaces.",
    });
  }

  if (unofficialOnly) {
    diagnostics.push({
      id: "competition-unofficial-only",
      section: "Competition Integrity",
      severity: "WARNING",
      title: "Only unofficial games on record",
      why: "Game stats exist, but none use VERIFIED or SUBMITTED verification status.",
      howToFix: "Complete submission review so games reach verified status before relying on them for rankings.",
    });
  }

  const verifiedProgramIds = new Set(
    officialStats
      .map((stat) => stat.team.programId)
      .filter((programId): programId is string => Boolean(programId)),
  );
  if (verifiedProgramIds.size > 1) {
    diagnostics.push({
      id: "competition-mismatch",
      section: "Competition Integrity",
      severity: "WARNING",
      title: "Competition mismatch",
      why: "Verified game evidence references teams from multiple operational programs.",
      howToFix: "Review imported game stats and team assignments; confirm transfers are recorded and stats are mapped to the correct program teams.",
    });
  }

  if (
    player.schoolOverride &&
    currentProgramLabel &&
    player.schoolOverride.trim().toLowerCase() !== currentProgramLabel.trim().toLowerCase()
  ) {
    diagnostics.push({
      id: "profile-school-override-mismatch",
      section: "Profile Integrity",
      severity: "INFO",
      title: "School override differs from current program",
      why: "schoolOverride is set and does not match the explicit operational program name.",
      howToFix: "Clear the override if the program link is correct, or update the override to match the intended public label.",
    });
  }

  if (officialStats.length > 0 && adminStats.rating === null) {
    diagnostics.push({
      id: "ratings-missing",
      section: "Ratings Integrity",
      severity: "WARNING",
      title: "Missing rating",
      why: `Verified games exist but no active-policy PlayerRating was found for the ${displayAgeBracket} board.`,
      howToFix: "Run the approved rating sync/recompute workflow for this player's age group after verifying game evidence.",
    });
  }

  if (activeRatingsForBracket.length > 1) {
    diagnostics.push({
      id: "ratings-multiple-active",
      section: "Ratings Integrity",
      severity: "ERROR",
      title: "Multiple active ratings",
      why: "More than one PlayerRating row exists for the same age group under the active policy version.",
      howToFix: "Audit duplicate PlayerRating rows with the rankings team before any public snapshot publish.",
    });
  }

  if (latestSnapshotRow && adminStats.rating !== null) {
    const snapshotRating = Number(latestSnapshotRow.rating);
    const delta = Math.abs(snapshotRating - adminStats.rating);
    if (delta > 0.05) {
      diagnostics.push({
        id: "ratings-snapshot-inconsistency",
        section: "Ratings Integrity",
        severity: "INFO",
        title: "Snapshot inconsistency",
        why: `Latest national snapshot rating (${snapshotRating.toFixed(1)}) differs from the live PlayerRating (${adminStats.rating.toFixed(1)}).`,
        howToFix: "Expected after new verified games or before the next snapshot publish; investigate only if the gap persists across recomputes.",
      });
    }
  }

  if (!player.photoUrl) {
    diagnostics.push({
      id: "profile-missing-portrait",
      section: "Profile Integrity",
      severity: "INFO",
      title: "Missing portrait",
      why: "photoUrl is empty on the player record.",
      howToFix: "Upload a portrait in the Profile tab when a credible image is available.",
    });
  }

  if (player.heightCm === null) {
    diagnostics.push({
      id: "profile-missing-height",
      section: "Profile Integrity",
      severity: "INFO",
      title: "Missing height",
      why: "heightCm is not set.",
      howToFix: "Enter height on the Profile tab from a trusted roster or measurement source.",
    });
  }

  if (!player.position?.trim()) {
    diagnostics.push({
      id: "profile-missing-position",
      section: "Profile Integrity",
      severity: "WARNING",
      title: "Missing primary position",
      why: "position is empty on the player bio.",
      howToFix: "Add the player's primary position in the Profile tab.",
    });
  }

  if (!recruitingClassYear) {
    diagnostics.push({
      id: "profile-missing-class-year",
      section: "Profile Integrity",
      severity: "INFO",
      title: "Missing recruiting class",
      why: "Neither birth date nor class year override is available to derive a class year.",
      howToFix: "Add birth date or class year override so eligibility and recruiting class can be displayed.",
    });
  }

  if (!player.birthDate) {
    diagnostics.push({
      id: "identity-missing-birthdate",
      section: "Identity",
      severity: "WARNING",
      title: "Missing birth date",
      why: "birthDate is null, so age-group brackets use overrides or remain unknown.",
      howToFix: "Add birth date on the Profile tab from verified roster or ID evidence.",
    });
  }

  const { health, healthScore } = scoreIntegrityHealth(diagnostics);
  const lastTransfer = transferHistory[0] ?? null;

  return {
    health,
    healthScore,
    diagnostics,
    identity: {
      playerId: player.id,
      slug,
      birthDate: formatDate(player.birthDate),
      ageGroup: displayAgeBracket,
      gender: player.gender,
      nationality: "Not tracked in schema",
      portraitStatus: player.photoUrl ? "Portrait on file" : "Missing portrait",
      schoolOverrideStatus: player.schoolOverride?.trim() ? `Override: ${player.schoolOverride}` : "No override",
    },
    program: {
      currentProgram: currentProgramLabel,
      parentGroup,
      currentTeam: currentTeamName,
      assignmentStatus,
    },
    competition: {
      verifiedGames: competition.totalVerifiedGames,
      competitionsPlayed: competition.competitionCount,
      latestCompetition: competition.primary?.leagueName ?? null,
      latestSeason: latestOfficialGame ? latestOfficialGame.season.name : null,
      latestVerifiedGame: formatDate(latestOfficialGame?.gameDate ?? null),
    },
    ratings: {
      currentRating: adminStats.rating !== null ? adminStats.rating.toFixed(1) : null,
      stars: primaryRating ? String(primaryRating.starRating) : null,
      snapshotCount: player._count.rankingRows,
      latestSnapshot: latestSnapshotRow
        ? `${formatDate(latestSnapshotRow.snapshot.weekOf)} · rank ${latestSnapshotRow.rank}`
        : null,
      formulaVersion: primaryRating
        ? `v${primaryRating.formulaVersion.versionNumber} · ${primaryRating.formulaVersion.description}`
        : null,
    },
    profile: {
      photo: player.photoUrl ? "On file" : "Missing",
      bio: [player.hometown ?? player.city, player.region].filter(Boolean).join(", ") || "Not tracked",
      height: player.heightCm ? `${player.heightCm} cm` : "Missing",
      position: player.position,
      handedness: "Not tracked in schema",
      recruitingClass: recruitingClassYear ? `Class of ${recruitingClassYear}` : null,
      highlights: "Not tracked in schema",
    },
    administrative: {
      transferHistoryCount: player._count.programHistory,
      lastTransfer: lastTransfer
        ? `${lastTransfer.fromProgramName} → ${lastTransfer.toProgramName} (${lastTransfer.effectiveDate ?? "no date"})`
        : null,
      lastEditor: lastAudit?.user?.name ?? lastAudit?.user?.username ?? null,
      createdAt: player.createdAt.toISOString(),
      updatedAt: player.updatedAt.toISOString(),
      softDeleteStatus: player.deletedAt ? `Archived ${formatDate(player.deletedAt)}` : "Active",
    },
  };
}
