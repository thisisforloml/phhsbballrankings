export type RosterHistoryRow = {
  playerId: string;
  teamId: string;
};

export type RosterIndex = {
  playersByTeamId: Map<string, Set<string>>;
  playersByProgramId: Map<string, Set<string>>;
  teamProgramId: Map<string, string | null>;
  playerTeamIds: Map<string, Set<string>>;
  playerProgramIds: Map<string, Set<string>>;
};

export function buildRosterIndex(input: {
  rosterRows: RosterHistoryRow[];
  teamProgramId: Map<string, string | null>;
}): RosterIndex {
  const playersByTeamId = new Map<string, Set<string>>();
  const playersByProgramId = new Map<string, Set<string>>();
  const playerTeamIds = new Map<string, Set<string>>();
  const playerProgramIds = new Map<string, Set<string>>();

  for (const row of input.rosterRows) {
    const teamSet = playersByTeamId.get(row.teamId) ?? new Set<string>();
    teamSet.add(row.playerId);
    playersByTeamId.set(row.teamId, teamSet);

    const playerTeams = playerTeamIds.get(row.playerId) ?? new Set<string>();
    playerTeams.add(row.teamId);
    playerTeamIds.set(row.playerId, playerTeams);

    const programId = input.teamProgramId.get(row.teamId) ?? null;
    if (programId) {
      const programSet = playersByProgramId.get(programId) ?? new Set<string>();
      programSet.add(row.playerId);
      playersByProgramId.set(programId, programSet);

      const playerPrograms = playerProgramIds.get(row.playerId) ?? new Set<string>();
      playerPrograms.add(programId);
      playerProgramIds.set(row.playerId, playerPrograms);
    }
  }

  return {
    playersByTeamId,
    playersByProgramId,
    teamProgramId: input.teamProgramId,
    playerTeamIds,
    playerProgramIds
  };
}

export type RosterScopeKind = "team" | "program" | "global";

export type ResolvedRosterScope = {
  kind: RosterScopeKind;
  scopedTeamId: string | null;
  scopedProgramId: string | null;
  playerIds: Set<string> | null;
  scopedToTeam: boolean;
  scopedToProgram: boolean;
  emptyProvisionalRoster: boolean;
};

export function resolveRosterScope(input: {
  scopedTeamId: string | null;
  provisionalScopedToTeam: boolean;
  roster: Pick<RosterIndex, "playersByTeamId" | "playersByProgramId" | "teamProgramId">;
}): ResolvedRosterScope {
  const { scopedTeamId, provisionalScopedToTeam, roster } = input;

  if (!scopedTeamId) {
    return {
      kind: "global",
      scopedTeamId: null,
      scopedProgramId: null,
      playerIds: null,
      scopedToTeam: false,
      scopedToProgram: false,
      emptyProvisionalRoster: false
    };
  }

  const teamRoster = roster.playersByTeamId.get(scopedTeamId);
  if (teamRoster && teamRoster.size > 0) {
    return {
      kind: "team",
      scopedTeamId,
      scopedProgramId: roster.teamProgramId.get(scopedTeamId) ?? null,
      playerIds: teamRoster,
      scopedToTeam: true,
      scopedToProgram: false,
      emptyProvisionalRoster: false
    };
  }

  const programId = roster.teamProgramId.get(scopedTeamId) ?? null;
  if (programId) {
    const programRoster = roster.playersByProgramId.get(programId);
    if (programRoster && programRoster.size > 0) {
      return {
        kind: "program",
        scopedTeamId,
        scopedProgramId: programId,
        playerIds: programRoster,
        scopedToTeam: false,
        scopedToProgram: true,
        emptyProvisionalRoster: provisionalScopedToTeam
      };
    }
  }

  return {
    kind: "global",
    scopedTeamId,
    scopedProgramId: programId,
    playerIds: null,
    scopedToTeam: false,
    scopedToProgram: false,
    emptyProvisionalRoster: provisionalScopedToTeam
  };
}
