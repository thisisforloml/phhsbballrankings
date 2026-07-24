import { ProgramRole } from "@prisma/client";

import { normalizeDuplicateLastName, normalizeDuplicateName } from "@/lib/admin/player-duplicate-detection/name-similarity";
import type { DuplicatePlayerRecord } from "@/lib/admin/player-duplicate-detection/types";
import { firstLastIdentityKey } from "@/lib/player-name-identity";

export type DuplicateDetectionCorpus = {
  players: DuplicatePlayerRecord[];
  playersById: Map<string, DuplicatePlayerRecord>;
  index: DuplicateDetectionIndex;
};

export type DuplicateDetectionIndex = {
  byNameKey: Map<string, string[]>;
  byFirstLastKey: Map<string, string[]>;
  byLastNameKey: Map<string, string[]>;
  byBirthYear: Map<string, string[]>;
  byProgramId: Map<string, string[]>;
  byParentGroupId: Map<string, string[]>;
  byTeamId: Map<string, string[]>;
  byLeagueId: Map<string, string[]>;
  byGameId: Map<string, string[]>;
};

function pushIndex(map: Map<string, string[]>, key: string, playerId: string) {
  const bucket = map.get(key);
  if (bucket) {
    if (!bucket.includes(playerId)) bucket.push(playerId);
    return;
  }
  map.set(key, [playerId]);
}

function pushMany(map: Map<string, string[]>, keys: Iterable<string>, playerId: string) {
  for (const key of keys) {
    if (!key) continue;
    pushIndex(map, key, playerId);
  }
}

export function buildDuplicateDetectionIndex(players: DuplicatePlayerRecord[]): DuplicateDetectionIndex {
  const index: DuplicateDetectionIndex = {
    byNameKey: new Map(),
    byFirstLastKey: new Map(),
    byLastNameKey: new Map(),
    byBirthYear: new Map(),
    byProgramId: new Map(),
    byParentGroupId: new Map(),
    byTeamId: new Map(),
    byLeagueId: new Map(),
    byGameId: new Map(),
  };

  for (const player of players) {
    pushIndex(index.byNameKey, normalizeDuplicateName(player.displayName), player.id);
    const firstLastKey = firstLastIdentityKey(player.displayName);
    if (firstLastKey) pushIndex(index.byFirstLastKey, firstLastKey, player.id);
    pushIndex(index.byLastNameKey, normalizeDuplicateLastName(player.lastName), player.id);

    if (player.birthDate) {
      pushIndex(index.byBirthYear, String(player.birthDate.getUTCFullYear()), player.id);
    }
    if (player.currentProgramId) {
      pushIndex(index.byProgramId, player.currentProgramId, player.id);
    }
    if (player.parentGroupProgramId) {
      pushIndex(index.byParentGroupId, player.parentGroupProgramId, player.id);
    }
    pushMany(index.byTeamId, player.teamIds, player.id);
    pushMany(index.byLeagueId, player.leagueIds, player.id);
    pushMany(index.byGameId, player.gameIds, player.id);
  }

  return index;
}

export function collectIndexedCandidateIds(
  target: DuplicatePlayerRecord,
  index: DuplicateDetectionIndex,
) {
  const candidateIds = new Set<string>();

  const addBucket = (ids: string[] | undefined) => {
    for (const id of ids ?? []) {
      if (id !== target.id) candidateIds.add(id);
    }
  };

  addBucket(index.byNameKey.get(normalizeDuplicateName(target.displayName)));
  const firstLastKey = firstLastIdentityKey(target.displayName);
  if (firstLastKey) addBucket(index.byFirstLastKey.get(firstLastKey));
  addBucket(index.byLastNameKey.get(normalizeDuplicateLastName(target.lastName)));

  if (target.birthDate) {
    addBucket(index.byBirthYear.get(String(target.birthDate.getUTCFullYear())));
  }
  if (target.currentProgramId) {
    addBucket(index.byProgramId.get(target.currentProgramId));
  }
  if (target.parentGroupProgramId) {
    addBucket(index.byParentGroupId.get(target.parentGroupProgramId));
  }

  for (const teamId of target.teamIds) addBucket(index.byTeamId.get(teamId));
  for (const leagueId of target.leagueIds) addBucket(index.byLeagueId.get(leagueId));
  for (const gameId of target.gameIds) addBucket(index.byGameId.get(gameId));

  return candidateIds;
}

type RawDuplicatePlayerRow = {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: Date | null;
  heightCm: number | null;
  photoUrl: string | null;
  currentProgramId: string | null;
  currentProgram: {
    id: string;
    fullName: string;
    programRole: ProgramRole;
    deletedAt: Date | null;
    parentProgram: { id: string; fullName: string; programRole: ProgramRole } | null;
  } | null;
  aliases: Array<{ aliasName: string }>;
  externalAliases: Array<{ provider: string; normalizedExternalLabel: string }>;
  gameStats: Array<{
    gameId: string;
    teamId: string;
    game: {
      id: string;
      season: {
        name: string;
        league: { id: string; name: string };
      };
    };
  }>;
};

export function mapRawDuplicatePlayerRow(row: RawDuplicatePlayerRow): DuplicatePlayerRecord {
  const currentProgram =
    row.currentProgram?.programRole === ProgramRole.OPERATIONAL && !row.currentProgram.deletedAt
      ? row.currentProgram
      : null;
  const parentGroup =
    currentProgram?.parentProgram?.programRole === ProgramRole.GROUP
      ? currentProgram.parentProgram
      : null;

  const teamIds = new Set<string>();
  const leagueIds = new Set<string>();
  const seasonKeys = new Set<string>();
  const gameIds = new Set<string>();

  for (const stat of row.gameStats) {
    teamIds.add(stat.teamId);
    leagueIds.add(stat.game.season.league.id);
    seasonKeys.add(`${stat.game.season.league.id}:${stat.game.season.name}`);
    gameIds.add(stat.game.id);
  }

  return {
    id: row.id,
    displayName: row.displayName,
    firstName: row.firstName,
    lastName: row.lastName,
    gender: row.gender,
    birthDate: row.birthDate,
    heightCm: row.heightCm,
    photoUrl: row.photoUrl,
    currentProgramId: currentProgram?.id ?? row.currentProgramId,
    currentProgramName: currentProgram?.fullName ?? null,
    parentGroupProgramId: parentGroup?.id ?? null,
    parentGroupName: parentGroup?.fullName ?? null,
    aliases: row.aliases.map((alias) => alias.aliasName),
    externalIds: row.externalAliases.map((alias) => ({
      provider: alias.provider,
      label: alias.normalizedExternalLabel,
    })),
    teamIds,
    leagueIds,
    seasonKeys,
    gameIds,
    dominantHand: null,
    portraitHash: row.photoUrl ? `photo:${row.photoUrl}` : null,
  };
}

export function buildDuplicateDetectionCorpus(players: DuplicatePlayerRecord[]): DuplicateDetectionCorpus {
  const playersById = new Map(players.map((player) => [player.id, player]));
  return {
    players,
    playersById,
    index: buildDuplicateDetectionIndex(players),
  };
}
