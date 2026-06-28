import { AgeGroup, PlayerGender, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_TPI_V1_PARAMETERS,
  TEAM_FORMULA_SLUG_V1,
  type TpiV1Parameters
} from "./constants";
import { isTeamEvidenceEligibleGame } from "./team-evidence-filter";
import { resolveImportedOfficialGameIds } from "./team-evidence-imported-games";
import {
  boardGroupKey,
  computeTeamTpiBoard,
  dedupeTeamTpiGames,
  inferTeamStandingsGender,
  teamStandingsGenderToPlayerGender,
  type TeamTpiGameInput,
  type TeamTpiProgramResult
} from "./team-tpi-v1";

export type ComputeProgramTeamRatingsOptions = {
  evaluationDate?: Date;
  dryRun?: boolean;
  ageGroup?: AgeGroup;
  gender?: PlayerGender;
};

export type ComputeProgramTeamRatingsResult = {
  dryRun: boolean;
  evaluationDate: string;
  teamFormulaVersionId: string;
  teamFormulaSlug: string;
  evidencePolicyVersion: string;
  thresholdPolicyVersion: string;
  boards: Array<{
    boardKey: string;
    gameCount: number;
    programCount: number;
    results: TeamTpiProgramResult[];
  }>;
  upserted: number;
  deleted: number;
  totalRows: number;
};

function parseTpiParameters(raw: Prisma.JsonValue): TpiV1Parameters {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_TPI_V1_PARAMETERS;
  }
  const p = raw as Record<string, unknown>;
  return {
    shrinkageK: Number(p.shrinkageK ?? DEFAULT_TPI_V1_PARAMETERS.shrinkageK),
    halfLifeDays: Number(p.halfLifeDays ?? DEFAULT_TPI_V1_PARAMETERS.halfLifeDays),
    maxAgeDays: Number(p.maxAgeDays ?? DEFAULT_TPI_V1_PARAMETERS.maxAgeDays),
    boardPrior: Number(p.boardPrior ?? DEFAULT_TPI_V1_PARAMETERS.boardPrior),
    minGames: Number(p.minGames ?? DEFAULT_TPI_V1_PARAMETERS.minGames),
    minOpponents: Number(p.minOpponents ?? DEFAULT_TPI_V1_PARAMETERS.minOpponents),
    passIterations: Number(p.passIterations ?? DEFAULT_TPI_V1_PARAMETERS.passIterations),
    evidencePolicyVersion: String(p.evidencePolicyVersion ?? DEFAULT_TPI_V1_PARAMETERS.evidencePolicyVersion),
    thresholdPolicyVersion: String(p.thresholdPolicyVersion ?? DEFAULT_TPI_V1_PARAMETERS.thresholdPolicyVersion)
  };
}

export async function getActiveTeamFormulaVersion(slug = TEAM_FORMULA_SLUG_V1) {
  const version = await prisma.teamFormulaVersion.findUnique({ where: { slug } });
  if (!version) {
    throw new Error(`Team formula version not found: ${slug}`);
  }
  return version;
}

export async function loadTeamEvidenceGames(): Promise<TeamTpiGameInput[]> {
  const games = await prisma.game.findMany({
    where: {
      deletedAt: null,
      season: { deletedAt: null, league: { deletedAt: null } },
      homeTeam: { deletedAt: null, program: { deletedAt: null } },
      awayTeam: { deletedAt: null, program: { deletedAt: null } }
    },
    include: {
      homeTeam: { include: { program: true } },
      awayTeam: { include: { program: true } },
      season: { include: { league: true } }
    },
    orderBy: [{ gameDate: "asc" }]
  });

  const importedGameIds = await resolveImportedOfficialGameIds();

  const rows: TeamTpiGameInput[] = [];
  for (const g of games) {
    if (!importedGameIds.has(g.id)) continue;

    if (
      !isTeamEvidenceEligibleGame({
        verificationStatus: g.verificationStatus,
        submissionType: g.submissionType,
        deletedAt: g.deletedAt,
        homeProgramId: g.homeTeam.programId,
        awayProgramId: g.awayTeam.programId
      })
    ) {
      continue;
    }

    const gender = inferTeamStandingsGender(g.season.league.name, g.homeTeam.name, g.awayTeam.name);
    rows.push({
      gameId: g.id,
      gameNumber: g.gameNumber,
      gameDate: g.gameDate,
      homeScore: g.homeScore,
      awayScore: g.awayScore,
      homeProgramId: g.homeTeam.programId!,
      awayProgramId: g.awayTeam.programId!,
      homeProgramName: g.homeTeam.program?.fullName ?? g.homeTeam.name,
      awayProgramName: g.awayTeam.program?.fullName ?? g.awayTeam.name,
      leagueTier: g.season.league.tier,
      leagueId: g.season.leagueId,
      seasonId: g.seasonId,
      ageGroup: g.season.league.ageGroup,
      gender
    });
  }
  return rows;
}

function matchesBoardFilter(
  ageGroup: AgeGroup,
  gender: PlayerGender,
  options: ComputeProgramTeamRatingsOptions
) {
  if (options.ageGroup && options.ageGroup !== ageGroup) return false;
  if (options.gender && options.gender !== gender) return false;
  return true;
}

export async function computeProgramTeamRatings(
  options: ComputeProgramTeamRatingsOptions = {}
): Promise<ComputeProgramTeamRatingsResult> {
  const evaluationDate = options.evaluationDate ?? new Date();
  const dryRun = options.dryRun ?? false;

  const formulaVersion = await getActiveTeamFormulaVersion();
  const params = parseTpiParameters(formulaVersion.parameters);

  const rawGames = await loadTeamEvidenceGames();
  const boards = new Map<string, TeamTpiGameInput[]>();
  for (const g of rawGames) {
    const key = boardGroupKey(g.ageGroup, g.gender);
    if (!boards.has(key)) boards.set(key, []);
    boards.get(key)!.push(g);
  }

  const boardResults: ComputeProgramTeamRatingsResult["boards"] = [];
  const persistTargets: Array<{
    result: TeamTpiProgramResult;
    playerGender: PlayerGender;
  }> = [];

  for (const [boardKey, boardGames] of boards) {
    const [ageGroup, genderLabel] = boardKey.split(":") as [AgeGroup, "Boys" | "Girls"];
    const playerGender = teamStandingsGenderToPlayerGender(genderLabel);
    if (!matchesBoardFilter(ageGroup, playerGender, options)) continue;

    const dedupedBoardGames = dedupeTeamTpiGames(boardGames);
    const results = computeTeamTpiBoard(dedupedBoardGames, evaluationDate, params);
    boardResults.push({
      boardKey,
      gameCount: dedupedBoardGames.length,
      programCount: results.length,
      results
    });
    for (const result of results) {
      persistTargets.push({ result, playerGender });
    }
  }

  if (dryRun) {
    return {
      dryRun: true,
      evaluationDate: evaluationDate.toISOString(),
      teamFormulaVersionId: formulaVersion.id,
      teamFormulaSlug: formulaVersion.slug,
      evidencePolicyVersion: params.evidencePolicyVersion,
      thresholdPolicyVersion: params.thresholdPolicyVersion,
      boards: boardResults,
      upserted: 0,
      deleted: 0,
      totalRows: persistTargets.length
    };
  }

  const computedAt = new Date();
  let upserted = 0;
  let deleted = 0;

  await prisma.$transaction(async (tx) => {
    for (const { result, playerGender } of persistTargets) {
      await tx.programTeamRating.upsert({
        where: {
          programId_ageGroup_gender: {
            programId: result.programId,
            ageGroup: result.ageGroup,
            gender: playerGender
          }
        },
        create: {
          programId: result.programId,
          ageGroup: result.ageGroup,
          gender: playerGender,
          rating: result.tpiAdjusted,
          observedRating: result.pass1ObservedFinal,
          effectiveGameWeight: result.effectiveWeight,
          verifiedGameCount: result.verifiedGames,
          verifiedOpponentCount: result.verifiedOpponents,
          verifiedCompetitionCount: result.verifiedCompetitions,
          publicBoardEligible: result.publicBoardEligible,
          teamFormulaVersionId: formulaVersion.id,
          evidencePolicyVersion: params.evidencePolicyVersion,
          thresholdPolicyVersion: params.thresholdPolicyVersion,
          computedAt
        },
        update: {
          rating: result.tpiAdjusted,
          observedRating: result.pass1ObservedFinal,
          effectiveGameWeight: result.effectiveWeight,
          verifiedGameCount: result.verifiedGames,
          verifiedOpponentCount: result.verifiedOpponents,
          verifiedCompetitionCount: result.verifiedCompetitions,
          publicBoardEligible: result.publicBoardEligible,
          teamFormulaVersionId: formulaVersion.id,
          evidencePolicyVersion: params.evidencePolicyVersion,
          thresholdPolicyVersion: params.thresholdPolicyVersion,
          computedAt
        }
      });
      upserted += 1;
    }

    const activeKeys = new Set(
      persistTargets.map(
        ({ result, playerGender }) => `${result.programId}:${result.ageGroup}:${playerGender}`
      )
    );

    const staleScope: Prisma.ProgramTeamRatingWhereInput = {};
    if (options.ageGroup) staleScope.ageGroup = options.ageGroup;
    if (options.gender) staleScope.gender = options.gender;

    const existing = await tx.programTeamRating.findMany({
      where: staleScope,
      select: { id: true, programId: true, ageGroup: true, gender: true }
    });

    const staleIds = existing
      .filter((row) => !activeKeys.has(`${row.programId}:${row.ageGroup}:${row.gender}`))
      .map((row) => row.id);

    if (staleIds.length > 0) {
      await tx.programTeamRating.deleteMany({ where: { id: { in: staleIds } } });
      deleted += staleIds.length;
    }

    const orphaned = await tx.programTeamRating.deleteMany({
      where: { program: { deletedAt: { not: null } } }
    });
    deleted += orphaned.count;
  });

  const totalRows = await prisma.programTeamRating.count();

  return {
    dryRun: false,
    evaluationDate: evaluationDate.toISOString(),
    teamFormulaVersionId: formulaVersion.id,
    teamFormulaSlug: formulaVersion.slug,
    evidencePolicyVersion: params.evidencePolicyVersion,
    thresholdPolicyVersion: params.thresholdPolicyVersion,
    boards: boardResults,
    upserted,
    deleted,
    totalRows
  };
}
