import { loadManagedTeams } from "@/lib/admin/load-managed-teams";
import type { ManagedTeam } from "@/lib/admin/managed-team";

export type ProgramManagedTeamRow = {
  id: string;
  name: string;
  city: string;
  region: string;
  logoUrl: string | null;
  genders: string;
  ageGroups: string;
  competitionCount: number;
  activePlayers: number;
  programFullName: string;
  officialGames: number;
  contexts: string[];
};

function parseCompetitionProfile(contexts: string[]) {
  const genders = new Set<string>();
  const ageGroups = new Set<string>();

  for (const context of contexts) {
    const [ageGender] = context.split(" / ");
    const match = ageGender?.trim().match(/^(U\d+)\s+(.+)$/);
    if (match) {
      ageGroups.add(match[1]);
      genders.add(match[2]);
    }
  }

  return {
    genders: Array.from(genders).sort((left, right) => left.localeCompare(right)).join(", ") || "—",
    ageGroups: Array.from(ageGroups).sort((left, right) => left.localeCompare(right)).join(", ") || "—",
    competitionCount: contexts.length,
  };
}

export function managedTeamToProgramRow(team: ManagedTeam, programFullName: string): ProgramManagedTeamRow {
  const profile = parseCompetitionProfile(team.contexts);

  return {
    id: team.id,
    name: team.name,
    city: team.city,
    region: team.region,
    logoUrl: team.logoUrl,
    genders: profile.genders,
    ageGroups: profile.ageGroups,
    competitionCount: profile.competitionCount,
    activePlayers: team.playerCount,
    programFullName,
    officialGames: team.homeGames + team.awayGames,
    contexts: team.contexts,
  };
}

export async function loadProgramManagedTeamRows(programId: string, programFullName: string): Promise<ProgramManagedTeamRow[]> {
  const teams = await loadManagedTeams();
  return teams
    .filter((team) => team.programId === programId)
    .map((team) => managedTeamToProgramRow(team, programFullName))
    .sort((left, right) => left.name.localeCompare(right.name));
}
