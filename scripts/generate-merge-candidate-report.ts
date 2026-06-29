/**
 * READ-ONLY merge-candidate report generator (Players + Teams).
 *
 * Produces scripts/reports/merge-candidate-report.json.
 *
 * HARD CONSTRAINTS:
 *   - No DB writes, no soft deletes, no player/team updates, no alias creation.
 *   - No merge execution. Game / GameStat / GamePerformanceScore / PlayerRating
 *     are read ONLY. The only filesystem write is the report JSON.
 *
 * Detection reuses Phase B (player identity) and Phase C (team resolution) logic:
 *   - Players: normalized displayName matches, alias overlap, shared import keys,
 *     fuzzy near-name pairs with shared team/competition context. Same-game
 *     co-appearance is a HARD AGAINST signal.
 *   - Teams: same-program display-key duplicates, same-competition-context
 *     duplicates, programId linkage, opponent co-appearance as a HARD AGAINST.
 *
 * Usage: npx tsx scripts/generate-merge-candidate-report.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { normalizeImportedPlayerNameKey } from "../src/lib/player-import-identity";
import { teamDisplayMatchKey } from "../src/lib/team-import-matching";
import { getUaapSchoolDisplayName } from "../src/lib/uaap-school-display";

type Classification = "A_safe" | "B_manual_review" | "C_never_merge";

// ── shared helpers ─────────────────────────────────────────────────────────
function stripAgeGenderSuffix(name: string) {
  return name.replace(/\s+U(?:13|16|19)\s+(?:Boys|Girls)$/i, "").trim();
}
function publicSchoolDisplayName(teamName: string) {
  const alias = stripAgeGenderSuffix(teamName);
  return getUaapSchoolDisplayName(alias || teamName);
}
function inferGenderFromText(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase().includes("girls") ? "Girls" : "Boys";
}

/** Token set from a normalized import key (tokens >= 2 chars). */
function nameTokenSet(key: string): Set<string> {
  return new Set(
    key
      .split(" ")
      .map((t) => t.trim())
      .filter((t) => t.length >= 2)
  );
}
function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}
function isSubset(small: Set<string>, big: Set<string>) {
  if (small.size === 0 || small.size > big.size) return false;
  for (const t of small) if (!big.has(t)) return false;
  return true;
}
/** Normalized Levenshtein similarity on whole key strings. */
function levSimilarity(a: string, b: string) {
  if (a === b) return 1;
  const m = a.length;
  const n = b.length;
  if (m === 0 || n === 0) return 0;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j += 1) prev[j] = j;
  for (let i = 1; i <= m; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j += 1) prev[j] = curr[j];
  }
  return 1 - prev[n] / Math.max(m, n);
}

async function main() {
  const generatedAt = new Date().toISOString();

  // ── load (read-only) ──────────────────────────────────────────────────────
  const [
    activePlayers,
    playerAliases,
    playerExternalAliases,
    rosterSeasons,
    games,
    gameStats,
    gpsRows,
    ratingRows,
    activeTeams
  ] = await Promise.all([
    prisma.player.findMany({
      where: { deletedAt: null },
      select: { id: true, displayName: true, gender: true, currentProgramId: true, createdAt: true }
    }),
    prisma.playerAlias.findMany({ select: { aliasName: true, gender: true, playerId: true, source: true } }),
    prisma.playerExternalAlias.findMany({
      select: { provider: true, normalizedExternalLabel: true, externalLabel: true, playerId: true }
    }),
    prisma.playerTeamSeason.findMany({
      where: { deletedAt: null },
      select: { playerId: true, teamId: true, seasonId: true }
    }),
    prisma.game.findMany({
      where: {
        deletedAt: null,
        season: { deletedAt: null, league: { deletedAt: null } },
        homeTeam: { deletedAt: null },
        awayTeam: { deletedAt: null }
      },
      select: {
        id: true,
        seasonId: true,
        homeTeamId: true,
        awayTeamId: true,
        gameDate: true,
        gameNumber: true,
        season: {
          select: {
            id: true,
            name: true,
            leagueId: true,
            league: { select: { id: true, name: true, ageGroup: true } }
          }
        }
      }
    }),
    prisma.gameStat.findMany({
      where: { deletedAt: null },
      select: { playerId: true, gameId: true, teamId: true }
    }),
    prisma.gamePerformanceScore.groupBy({
      by: ["playerId"],
      where: { deletedAt: null },
      _count: { _all: true }
    }),
    prisma.playerRating.groupBy({ by: ["playerId"], _count: { _all: true } }),
    prisma.team.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        programId: true,
        program: { select: { id: true, fullName: true } }
      }
    })
  ]);

  // ── derived maps ──────────────────────────────────────────────────────────
  const gameById = new Map(games.map((g) => [g.id, g]));
  const playerById = new Map(activePlayers.map((p) => [p.id, p]));
  const teamById = new Map(activeTeams.map((t) => [t.id, t]));

  // player -> stats summary
  type PlayerStats = {
    gameIds: Set<string>;
    teamIds: Set<string>;
    statCount: number;
    contexts: Set<string>; // leagueId|seasonId
    leagues: Set<string>;
  };
  const statsByPlayer = new Map<string, PlayerStats>();
  for (const gs of gameStats) {
    const g = gameById.get(gs.gameId);
    let entry = statsByPlayer.get(gs.playerId);
    if (!entry) {
      entry = { gameIds: new Set(), teamIds: new Set(), statCount: 0, contexts: new Set(), leagues: new Set() };
      statsByPlayer.set(gs.playerId, entry);
    }
    entry.statCount += 1;
    entry.gameIds.add(gs.gameId);
    entry.teamIds.add(gs.teamId);
    if (g) {
      entry.contexts.add(`${g.season.leagueId}|${g.seasonId}`);
      entry.leagues.add(g.season.leagueId);
    }
  }

  const gpsByPlayer = new Map(gpsRows.map((r) => [r.playerId, r._count._all]));
  const ratingByPlayer = new Map(ratingRows.map((r) => [r.playerId, r._count._all]));

  const rosterByPlayer = new Map<string, Set<string>>(); // playerId -> teamIds
  for (const r of rosterSeasons) {
    const set = rosterByPlayer.get(r.playerId) ?? new Set<string>();
    set.add(r.teamId);
    rosterByPlayer.set(r.playerId, set);
  }

  const aliasesByPlayer = new Map<string, Array<{ aliasName: string; source: string }>>();
  const aliasNameToPlayer = new Map<string, string>(); // `${gender}|${UPPER(alias)}` -> playerId
  for (const a of playerAliases) {
    const list = aliasesByPlayer.get(a.playerId) ?? [];
    list.push({ aliasName: a.aliasName, source: a.source });
    aliasesByPlayer.set(a.playerId, list);
    aliasNameToPlayer.set(`${a.gender}|${normalizeImportedPlayerNameKey(a.aliasName)}`, a.playerId);
  }

  const extAliasByPlayer = new Map<string, Set<string>>(); // playerId -> normalized labels
  for (const e of playerExternalAliases) {
    const set = extAliasByPlayer.get(e.playerId) ?? new Set<string>();
    set.add(`${e.provider}|${e.normalizedExternalLabel}`);
    extAliasByPlayer.set(e.playerId, set);
  }

  // team -> context / co-appearance maps
  type TeamUsage = {
    gameIds: Set<string>;
    contexts: Set<string>; // leagueId|seasonId
    ageGroups: Set<string>;
    leagues: Set<string>;
    seasons: Set<string>;
    gamesPlayed: number;
  };
  const usageByTeam = new Map<string, TeamUsage>();
  const ensureUsage = (teamId: string) => {
    let u = usageByTeam.get(teamId);
    if (!u) {
      u = { gameIds: new Set(), contexts: new Set(), ageGroups: new Set(), leagues: new Set(), seasons: new Set(), gamesPlayed: 0 };
      usageByTeam.set(teamId, u);
    }
    return u;
  };
  for (const g of games) {
    for (const teamId of [g.homeTeamId, g.awayTeamId]) {
      const u = ensureUsage(teamId);
      u.gameIds.add(g.id);
      u.contexts.add(`${g.season.leagueId}|${g.seasonId}`);
      u.ageGroups.add(g.season.league.ageGroup);
      u.leagues.add(g.season.league.id);
      u.seasons.add(g.seasonId);
      u.gamesPlayed += 1;
    }
  }
  // team -> gameStat count
  const statCountByTeam = new Map<string, number>();
  for (const gs of gameStats) {
    statCountByTeam.set(gs.teamId, (statCountByTeam.get(gs.teamId) ?? 0) + 1);
  }
  // opponent co-appearance: set of gameIds where both teams appear (as opponents)
  const teamsInGame = new Map<string, Set<string>>(); // gameId -> teamIds
  for (const g of games) {
    teamsInGame.set(g.id, new Set([g.homeTeamId, g.awayTeamId]));
  }

  // ════════════════════════════════════════════════════════════════════════
  // PLAYERS
  // ════════════════════════════════════════════════════════════════════════
  type PlayerCandidate = Record<string, unknown> & { classification: Classification };
  const playerCandidates: PlayerCandidate[] = [];

  // group by gender, build token index for candidate generation
  const byGender = new Map<PlayerGender, typeof activePlayers>();
  for (const p of activePlayers) {
    const list = byGender.get(p.gender) ?? [];
    list.push(p);
    byGender.set(p.gender, list);
  }

  const seenPairs = new Set<string>();

  for (const [gender, players] of byGender) {
    // precompute keys + token sets
    const keyByPlayer = new Map<string, string>();
    const tokensByPlayer = new Map<string, Set<string>>();
    const tokenIndex = new Map<string, string[]>(); // token -> playerIds
    for (const p of players) {
      const key = normalizeImportedPlayerNameKey(p.displayName);
      keyByPlayer.set(p.id, key);
      const tokens = nameTokenSet(key);
      tokensByPlayer.set(p.id, tokens);
      for (const t of tokens) {
        const arr = tokenIndex.get(t) ?? [];
        arr.push(p.id);
        tokenIndex.set(t, arr);
      }
    }

    // candidate pairs: any two players sharing at least one token
    for (const ids of tokenIndex.values()) {
      if (ids.length < 2) continue;
      for (let i = 0; i < ids.length; i += 1) {
        for (let j = i + 1; j < ids.length; j += 1) {
          const a = ids[i];
          const b = ids[j];
          const pairKey = a < b ? `${a}|${b}` : `${b}|${a}`;
          if (seenPairs.has(pairKey)) continue;

          const ka = keyByPlayer.get(a)!;
          const kb = keyByPlayer.get(b)!;
          const ta = tokensByPlayer.get(a)!;
          const tb = tokensByPlayer.get(b)!;
          const jac = jaccard(ta, tb);
          const subset = isSubset(ta, tb) || isSubset(tb, ta);
          const lev = levSimilarity(ka, kb);
          const exactKey = ka === kb;

          // gate: must be a plausible near-duplicate
          const plausible =
            exactKey ||
            (jac >= 0.5 && Math.min(ta.size, tb.size) >= 2) ||
            (subset && Math.min(ta.size, tb.size) >= 2) ||
            lev >= 0.85;
          if (!plausible) continue;
          seenPairs.add(pairKey);

          const pa = playerById.get(a)!;
          const pb = playerById.get(b)!;
          const sa = statsByPlayer.get(a);
          const sb = statsByPlayer.get(b);

          // shared evidence
          const sharedGameIds = sa && sb ? [...sa.gameIds].filter((g) => sb.gameIds.has(g)) : [];
          const sharedTeamIds = sa && sb ? [...sa.teamIds].filter((t) => sb.teamIds.has(t)) : [];
          const sharedRosterTeams = (() => {
            const ra = rosterByPlayer.get(a);
            const rb = rosterByPlayer.get(b);
            if (!ra || !rb) return [];
            return [...ra].filter((t) => rb.has(t));
          })();
          const sharedContexts = sa && sb ? [...sa.contexts].filter((c) => sb.contexts.has(c)) : [];

          const sameGameConflict = sharedGameIds.length > 0;

          // alias evidence
          const aliasLinks: string[] = [];
          const aKey = `${gender}|${ka}`;
          const bKey = `${gender}|${kb}`;
          if (aliasNameToPlayer.get(aKey) === b) aliasLinks.push(`alias '${pa.displayName}' -> ${b}`);
          if (aliasNameToPlayer.get(bKey) === a) aliasLinks.push(`alias '${pb.displayName}' -> ${a}`);
          const extA = extAliasByPlayer.get(a) ?? new Set();
          const extB = extAliasByPlayer.get(b) ?? new Set();
          const sharedExtAlias = [...extA].filter((x) => extB.has(x));

          // confidence scoring (transparent, 0-100)
          let confidence = 0;
          const methodParts: string[] = [];
          if (exactKey) {
            confidence += 45;
            methodParts.push("exact_normalized_key(+45)");
          } else {
            const nameComponent = Math.round(Math.max(jac, lev) * 35);
            confidence += nameComponent;
            methodParts.push(`name_similarity jac=${jac.toFixed(2)} lev=${lev.toFixed(2)}(+${nameComponent})`);
            if (subset) {
              confidence += 5;
              methodParts.push("token_subset(+5)");
            }
          }
          if (sharedRosterTeams.length > 0 || sharedTeamIds.length > 0) {
            confidence += 20;
            methodParts.push("shared_team(+20)");
          }
          if (sharedContexts.length > 0) {
            confidence += 12;
            methodParts.push("shared_competition(+12)");
          }
          if (aliasLinks.length > 0) {
            confidence += 15;
            methodParts.push("alias_link(+15)");
          }
          if (sharedExtAlias.length > 0) {
            confidence += 15;
            methodParts.push("shared_external_alias(+15)");
          }
          if (sameGameConflict) {
            confidence = Math.min(confidence, 5);
            methodParts.push("SAME_GAME_CONFLICT(hard_cap_5)");
          }
          confidence = Math.max(0, Math.min(100, confidence));

          // classification
          let classification: Classification;
          if (sameGameConflict) {
            classification = "C_never_merge";
          } else if (
            (exactKey || aliasLinks.length > 0 || sharedExtAlias.length > 0) &&
            (sharedRosterTeams.length > 0 || sharedTeamIds.length > 0 || sharedContexts.length > 0) &&
            confidence >= 70
          ) {
            classification = "A_safe";
          } else if (
            (sharedRosterTeams.length > 0 || sharedTeamIds.length > 0 || sharedContexts.length > 0) ||
            aliasLinks.length > 0 ||
            sharedExtAlias.length > 0 ||
            confidence >= 60
          ) {
            classification = "B_manual_review";
          } else {
            // similar name, no shared context/alias evidence -> coincidental distinct identities
            classification = "C_never_merge";
          }

          const statCountA = sa?.statCount ?? 0;
          const statCountB = sb?.statCount ?? 0;

          playerCandidates.push({
            type: "player_pair",
            classification,
            confidence,
            confidenceMethod: methodParts.join("; "),
            gender,
            players: [
              {
                id: a,
                displayName: pa.displayName,
                normalizedKey: ka,
                createdAt: pa.createdAt.toISOString(),
                gameStats: statCountA,
                games: sa?.gameIds.size ?? 0,
                gps: gpsByPlayer.get(a) ?? 0,
                playerRatings: ratingByPlayer.get(a) ?? 0
              },
              {
                id: b,
                displayName: pb.displayName,
                normalizedKey: kb,
                createdAt: pb.createdAt.toISOString(),
                gameStats: statCountB,
                games: sb?.gameIds.size ?? 0,
                gps: gpsByPlayer.get(b) ?? 0,
                playerRatings: ratingByPlayer.get(b) ?? 0
              }
            ],
            evidenceFor: [
              exactKey ? "Identical normalized name key." : `Name similarity jaccard=${jac.toFixed(2)}, lev=${lev.toFixed(2)}.`,
              sharedRosterTeams.length > 0 ? `${sharedRosterTeams.length} shared roster team(s).` : null,
              sharedTeamIds.length > 0 ? `${sharedTeamIds.length} shared game-stat team(s).` : null,
              sharedContexts.length > 0 ? `${sharedContexts.length} shared competition context(s).` : null,
              aliasLinks.length > 0 ? aliasLinks.join("; ") : null,
              sharedExtAlias.length > 0 ? `${sharedExtAlias.length} shared external import label(s).` : null
            ].filter(Boolean),
            evidenceAgainst: [
              sameGameConflict
                ? `HARD: co-appear in ${sharedGameIds.length} same game(s) — distinct on-court identities.`
                : null,
              !exactKey ? "Different normalized name spellings (may be different people)." : null,
              sharedContexts.length === 0 && !sameGameConflict ? "No shared league/season competition context." : null,
              sharedRosterTeams.length === 0 && sharedTeamIds.length === 0 ? "No shared team." : null
            ].filter(Boolean),
            sharedCompetitions: sharedContexts.map((c) => {
              const [leagueId, seasonId] = c.split("|");
              const sample = games.find((g) => g.season.leagueId === leagueId && g.seasonId === seasonId);
              return { leagueId, seasonId, leagueName: sample?.season.league.name ?? null, seasonName: sample?.season.name ?? null };
            }),
            sharedTeams: [...new Set([...sharedRosterTeams, ...sharedTeamIds])].map((t) => ({
              teamId: t,
              teamName: teamById.get(t)?.name ?? null
            })),
            sharedGames: sharedGameIds.map((gid) => {
              const g = gameById.get(gid);
              return { gameId: gid, gameNumber: g?.gameNumber ?? null, gameDate: g?.gameDate.toISOString() ?? null };
            }),
            sameGameConflicts: {
              count: sharedGameIds.length,
              gameIds: sharedGameIds.slice(0, 20)
            },
            aliasEvidence: {
              aliasLinks,
              aliasesOnA: aliasesByPlayer.get(a) ?? [],
              aliasesOnB: aliasesByPlayer.get(b) ?? [],
              sharedExternalAliases: sharedExtAlias
            },
            historicalRisk: {
              level: sameGameConflict
                ? "critical"
                : Math.min(statCountA, statCountB) === 0
                  ? "low"
                  : statCountA + statCountB >= 60
                    ? "high"
                    : "medium",
              gameStatsAffected: statCountA + statCountB,
              gpsAffected: (gpsByPlayer.get(a) ?? 0) + (gpsByPlayer.get(b) ?? 0),
              playerRatingsAffected: (ratingByPlayer.get(a) ?? 0) + (ratingByPlayer.get(b) ?? 0),
              note: sameGameConflict
                ? "Merging would collapse two distinct players who shared a court — corrupts historical box scores."
                : "Merge would reassign loser's GameStat/GPS/PlayerRating to canonical; reversible only with full backup."
            }
          });
        }
      }
    }
  }

  // also surface already-merged active/deleted overlaps (informational, already done)
  const activeDeletedOverlap = await prisma.$queryRaw<
    Array<{ display_name: string; gender: PlayerGender; active_ids: string[]; deleted_ids: string[] }>
  >`
    SELECT active."displayName" AS display_name, active.gender,
           array_agg(DISTINCT active.id) AS active_ids,
           array_agg(DISTINCT deleted.id) AS deleted_ids
    FROM players active
    JOIN players deleted
      ON deleted."displayName" = active."displayName"
     AND deleted.gender = active.gender
     AND deleted."deletedAt" IS NOT NULL
     AND deleted.id <> active.id
    WHERE active."deletedAt" IS NULL
    GROUP BY active."displayName", active.gender
    ORDER BY display_name ASC
  `;

  // ════════════════════════════════════════════════════════════════════════
  // TEAMS
  // ════════════════════════════════════════════════════════════════════════
  type TeamCandidate = Record<string, unknown> & { classification: Classification };
  const teamCandidates: TeamCandidate[] = [];

  // (1) same-program display-key duplicate groups (Phase C logic)
  const withinProgramDisplayKey = new Map<string, typeof activeTeams>();
  for (const t of activeTeams) {
    if (!t.programId) continue;
    const key = `${t.programId}|${teamDisplayMatchKey(t.name)}`;
    withinProgramDisplayKey.set(key, [...(withinProgramDisplayKey.get(key) ?? []), t]);
  }
  const sameProgramGroups = Array.from(withinProgramDisplayKey.entries())
    .filter(([, teams]) => teams.length > 1)
    .map(([key, teams]) => ({ source: "same_program_display_key" as const, key, teams }));

  // (2) same competition-context duplicate groups (Phase C logic)
  type ContextGroup = { contextKey: string; publicName: string; ageGroup: string; gender: string; leagueId: string; seasonId: string; teamIds: Set<string> };
  const contextGroups = new Map<string, ContextGroup>();
  for (const g of games) {
    const gender = inferGenderFromText(g.season.league.name);
    for (const teamId of [g.homeTeamId, g.awayTeamId]) {
      const team = teamById.get(teamId);
      if (!team) continue;
      const publicName = publicSchoolDisplayName(team.name);
      const key = [publicName, g.season.league.ageGroup, gender, g.season.leagueId, g.seasonId].join("|");
      let grp = contextGroups.get(key);
      if (!grp) {
        grp = {
          contextKey: key,
          publicName,
          ageGroup: g.season.league.ageGroup,
          gender,
          leagueId: g.season.leagueId,
          seasonId: g.seasonId,
          teamIds: new Set()
        };
        contextGroups.set(key, grp);
      }
      grp.teamIds.add(teamId);
    }
  }
  const contextDuplicateGroups = Array.from(contextGroups.values())
    .filter((grp) => grp.teamIds.size > 1)
    .map((grp) => ({ source: "duplicate_same_context" as const, key: grp.contextKey, grp, teams: [...grp.teamIds].map((id) => teamById.get(id)!).filter(Boolean) }));

  // combine groups, dedupe by sorted team-id set
  type RawGroup = { source: string; teamIds: string[]; meta?: Record<string, unknown> };
  const rawGroups: RawGroup[] = [];
  const seenGroupKeys = new Set<string>();
  const pushGroup = (rg: RawGroup) => {
    const k = [...rg.teamIds].sort().join("|") + "::" + rg.source;
    if (seenGroupKeys.has(k)) return;
    seenGroupKeys.add(k);
    rawGroups.push(rg);
  };
  for (const g of sameProgramGroups) {
    pushGroup({ source: g.source, teamIds: g.teams.map((t) => t.id) });
  }
  for (const g of contextDuplicateGroups) {
    pushGroup({
      source: g.source,
      teamIds: g.teams.map((t) => t.id),
      meta: { publicName: g.grp.publicName, ageGroup: g.grp.ageGroup, gender: g.grp.gender, leagueId: g.grp.leagueId, seasonId: g.grp.seasonId }
    });
  }

  for (const rg of rawGroups) {
    const teams = rg.teamIds.map((id) => teamById.get(id)!).filter(Boolean);
    if (teams.length < 2) continue;

    const perTeam = teams.map((t) => {
      const u = usageByTeam.get(t.id);
      return {
        teamId: t.id,
        teamName: t.name,
        programId: t.programId,
        programName: t.program?.fullName ?? null,
        gameStats: statCountByTeam.get(t.id) ?? 0,
        games: u?.gamesPlayed ?? 0,
        ageGroups: u ? [...u.ageGroups] : [],
        contexts: u ? [...u.contexts] : []
      };
    });

    // shared competition contexts across the group (intersection)
    const contextSets = perTeam.map((p) => new Set(p.contexts));
    const sharedContexts = [...(contextSets[0] ?? new Set<string>())].filter((c) =>
      contextSets.every((s) => s.has(c))
    );

    // age-group overlap
    const allAgeGroups = new Set(perTeam.flatMap((p) => p.ageGroups));
    const ageGroupUnionCount = allAgeGroups.size;
    const ageGroupsDisjoint =
      perTeam.every((p) => p.ageGroups.length > 0) &&
      perTeam.reduce((acc, p) => acc + p.ageGroups.length, 0) === ageGroupUnionCount &&
      ageGroupUnionCount === perTeam.filter((p) => p.ageGroups.length > 0).length &&
      ageGroupUnionCount > 1;

    // opponent co-appearance (HARD against): both teams in same game
    const opponentGames: string[] = [];
    for (const [gid, set] of teamsInGame) {
      let present = 0;
      for (const t of teams) if (set.has(t.id)) present += 1;
      if (present >= 2) opponentGames.push(gid);
    }

    const programIds = new Set(perTeam.map((p) => p.programId));
    const crossProgram = programIds.size > 1;
    const totalGameStats = perTeam.reduce((s, p) => s + p.gameStats, 0);
    const totalGames = perTeam.reduce((s, p) => s + p.games, 0);
    const anyInactive = perTeam.some((p) => p.games === 0 && p.gameStats === 0);
    const allInactive = perTeam.every((p) => p.games === 0 && p.gameStats === 0);

    // confidence + classification
    let confidence = 0;
    const methodParts: string[] = [];
    confidence += 30;
    methodParts.push(`${rg.source}(+30)`);
    if (sharedContexts.length > 0) {
      confidence += 35;
      methodParts.push("shared_competition_context(+35)");
    }
    if (!crossProgram) {
      confidence += 10;
      methodParts.push("same_program(+10)");
    }
    if (ageGroupsDisjoint) {
      confidence -= 40;
      methodParts.push("disjoint_age_groups(-40)");
    }
    if (opponentGames.length > 0) {
      confidence = Math.min(confidence, 5);
      methodParts.push("OPPONENT_CO_APPEARANCE(hard_cap_5)");
    }
    confidence = Math.max(0, Math.min(100, confidence));

    let classification: Classification;
    if (opponentGames.length > 0) {
      classification = "C_never_merge";
    } else if (ageGroupsDisjoint) {
      classification = "C_never_merge"; // age-division conflation risk
    } else if (allInactive) {
      classification = "B_manual_review"; // 0 evidence, low-risk but identity unclear
    } else if (sharedContexts.length > 0 && confidence >= 70) {
      classification = "A_safe";
    } else {
      classification = "B_manual_review";
    }

    const sharedContextDetails = sharedContexts.map((c) => {
      const [leagueId, seasonId] = c.split("|");
      const sample = games.find((g) => g.season.leagueId === leagueId && g.seasonId === seasonId);
      return { leagueId, seasonId, leagueName: sample?.season.league.name ?? null, seasonName: sample?.season.name ?? null };
    });

    teamCandidates.push({
      type: "team_group",
      classification,
      confidence,
      confidenceMethod: methodParts.join("; "),
      detectionSource: rg.source,
      meta: rg.meta ?? null,
      teams: perTeam,
      crossProgram,
      sharedPrograms: crossProgram
        ? []
        : [...programIds].filter(Boolean).map((pid) => ({ programId: pid, programName: teams.find((t) => t.programId === pid)?.program?.fullName ?? null })),
      evidenceFor: [
        `Detected via ${rg.source}.`,
        sharedContexts.length > 0 ? `${sharedContexts.length} shared league/season context(s) — same competition.` : null,
        !crossProgram ? "All teams under the same Program." : null,
        allInactive ? "All teams have 0 games and 0 GameStats (no historical evidence at risk)." : null
      ].filter(Boolean),
      evidenceAgainst: [
        opponentGames.length > 0 ? `HARD: teams co-appear as opponents in ${opponentGames.length} game(s) — distinct teams.` : null,
        ageGroupsDisjoint ? `Disjoint age-group contexts (${[...allAgeGroups].join(", ")}) — likely distinct age divisions; merge would conflate age-group history.` : null,
        crossProgram ? "Teams belong to different Program records — merge also requires program reconciliation." : null,
        sharedContexts.length === 0 && opponentGames.length === 0 ? "No shared league/season context between the teams." : null
      ].filter(Boolean),
      sharedCompetitions: sharedContextDetails,
      sharedGames: opponentGames.slice(0, 20).map((gid) => {
        const g = gameById.get(gid);
        return { gameId: gid, gameNumber: g?.gameNumber ?? null, gameDate: g?.gameDate.toISOString() ?? null };
      }),
      sameGameConflicts: { count: opponentGames.length, gameIds: opponentGames.slice(0, 20) },
      aliasEvidence: { note: "TeamExternalAlias splits = 0 per Phase C; display-key collision used as identity evidence." },
      historicalRisk: {
        level: opponentGames.length > 0 ? "critical" : ageGroupsDisjoint ? "high" : allInactive ? "low" : totalGameStats >= 200 ? "high" : "medium",
        gameStatsAffected: totalGameStats,
        gamesAffected: totalGames,
        note:
          opponentGames.length > 0
            ? "Teams played each other; merging is impossible without destroying game records."
            : ageGroupsDisjoint
              ? "Merging U16 and U19 divisions would collapse separate age-group standings and ratings."
              : "Merge rewrites GameStat.teamId and Game home/away team references — touches sensitive evidence; requires approval."
      }
    });
  }

  // ── classification tallies ──────────────────────────────────────────────
  const tally = (arr: Array<{ classification: Classification }>) => ({
    A_safe: arr.filter((c) => c.classification === "A_safe").length,
    B_manual_review: arr.filter((c) => c.classification === "B_manual_review").length,
    C_never_merge: arr.filter((c) => c.classification === "C_never_merge").length
  });
  const playerTally = tally(playerCandidates);
  const teamTally = tally(teamCandidates);

  // ── recommended merge plan (Class A only) — NOT executed ──────────────────
  const recommendedMergePlan = {
    status: "REQUIRES EXPLICIT APPROVAL — not executed",
    mode: "read-only",
    players: playerCandidates
      .filter((c) => c.classification === "A_safe")
      .map((c) => {
        const players = c.players as Array<{ id: string; displayName: string; gameStats: number; gps: number; playerRatings: number; createdAt: string }>;
        const sorted = [...players].sort((a, b) => b.gameStats - a.gameStats || a.createdAt.localeCompare(b.createdAt));
        const canonical = sorted[0];
        const duplicates = sorted.slice(1);
        return {
          canonicalPlayerId: canonical.id,
          canonicalDisplayName: canonical.displayName,
          duplicatePlayerIds: duplicates.map((d) => d.id),
          expectedAffected: {
            gameStats: duplicates.reduce((s, d) => s + d.gameStats, 0),
            gps: duplicates.reduce((s, d) => s + d.gps, 0),
            playerRatings: duplicates.reduce((s, d) => s + d.playerRatings, 0)
          },
          confidence: c.confidence
        };
      }),
    teams: teamCandidates
      .filter((c) => c.classification === "A_safe")
      .map((c) => {
        const teams = c.teams as Array<{ teamId: string; teamName: string; gameStats: number; games: number }>;
        const sorted = [...teams].sort((a, b) => b.gameStats - a.gameStats || b.games - a.games);
        const canonical = sorted[0];
        const duplicates = sorted.slice(1);
        return {
          canonicalTeamId: canonical.teamId,
          canonicalTeamName: canonical.teamName,
          duplicateTeamIds: duplicates.map((d) => d.teamId),
          expectedAffected: {
            gameStats: duplicates.reduce((s, d) => s + d.gameStats, 0),
            games: duplicates.reduce((s, d) => s + d.games, 0)
          },
          crossProgram: c.crossProgram,
          confidence: c.confidence,
          warning: "Touches GameStat.teamId and Game home/away references — sensitive historical evidence."
        };
      })
  };

  const report = {
    generatedAt,
    phase: "merge-candidate-report",
    mode: "read-only",
    sourceReports: [
      "scripts/reports/phase-b-identity-audit-report.json",
      "scripts/reports/phase-c-team-resolution-audit-report.json"
    ],
    metrics: {
      playersScanned: activePlayers.length,
      teamsScanned: activeTeams.length,
      gamesScanned: games.length,
      gameStatsScanned: gameStats.length,
      playerCandidatePairs: playerCandidates.length,
      teamCandidateGroups: teamCandidates.length,
      players: playerTally,
      teams: teamTally
    },
    alreadyMergedActiveDeletedOverlaps: activeDeletedOverlap.map((o) => ({
      displayName: o.display_name,
      gender: o.gender,
      activeIds: o.active_ids,
      deletedIds: o.deleted_ids,
      note: "Expected: prior approved merge (canonical active + soft-deleted duplicate). No action."
    })),
    players: playerCandidates.sort((a, b) => (b.confidence as number) - (a.confidence as number)),
    teams: teamCandidates.sort((a, b) => (b.confidence as number) - (a.confidence as number)),
    summary: {
      players: playerTally,
      teams: teamTally,
      classA_total: playerTally.A_safe + teamTally.A_safe,
      classB_total: playerTally.B_manual_review + teamTally.B_manual_review,
      classC_total: playerTally.C_never_merge + teamTally.C_never_merge
    },
    recommendedMergePlan
  };

  const reportPath = join(process.cwd(), "scripts", "reports", "merge-candidate-report.json");
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  // concise console summary
  console.error(`Players scanned: ${activePlayers.length}, teams: ${activeTeams.length}, games: ${games.length}, stats: ${gameStats.length}`);
  console.error(`Player candidates: ${playerCandidates.length} (A=${playerTally.A_safe} B=${playerTally.B_manual_review} C=${playerTally.C_never_merge})`);
  console.error(`Team candidates: ${teamCandidates.length} (A=${teamTally.A_safe} B=${teamTally.B_manual_review} C=${teamTally.C_never_merge})`);
  console.error(`Class A plan: ${recommendedMergePlan.players.length} player pair(s), ${recommendedMergePlan.teams.length} team group(s)`);
  console.error(`Wrote ${reportPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
