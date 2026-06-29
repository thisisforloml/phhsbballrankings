import { AgeGroup, Prisma, SeasonStatus } from "@prisma/client";
import { prisma } from "../../src/lib/prisma";

export type SourceSeason = {
  id: string;
  name: string;
  seasonYear: number;
  status: string;
  startsOn: Date;
  endsOn: Date | null;
  leagueId: string;
  leagueName: string;
  gameCount: number;
};

export type TargetSeasonSpec = {
  name: string;
  seasonYear: number;
  status: string;
  startsOn: Date;
  endsOn: Date | null;
  sourceSeasonIds: string[];
};

export type LeagueMergePlan = {
  canonicalLeagueName: string;
  ageGroup: AgeGroup;
  sources: SourceSeason[];
  targets: TargetSeasonSpec[];
};

export function buildTargetSeasonSpecs(
  sources: SourceSeason[],
  targetSeasonNameForSource: (leagueName: string, seasonName: string) => string
): TargetSeasonSpec[] {
  const byName = new Map<string, TargetSeasonSpec>();

  for (const source of sources) {
    const name = targetSeasonNameForSource(source.leagueName, source.name);
    const existing = byName.get(name);
    if (!existing) {
      byName.set(name, {
        name,
        seasonYear: source.seasonYear,
        status: source.status,
        startsOn: source.startsOn,
        endsOn: source.endsOn,
        sourceSeasonIds: [source.id]
      });
      continue;
    }

    existing.sourceSeasonIds.push(source.id);
    existing.seasonYear = Math.max(existing.seasonYear, source.seasonYear);
    if (source.startsOn < existing.startsOn) existing.startsOn = source.startsOn;
    if (source.endsOn && (!existing.endsOn || source.endsOn > existing.endsOn)) existing.endsOn = source.endsOn;
  }

  return Array.from(byName.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export function reportMergePlan(plan: LeagueMergePlan, title: string) {
  console.log(`=== ${title} ===\n`);
  console.log(`Canonical league: ${plan.canonicalLeagueName} (${plan.ageGroup})`);
  console.log(`Source edition leagues: ${new Set(plan.sources.map((s) => s.leagueId)).size}`);
  console.log(`Source seasons: ${plan.sources.length}`);
  console.log(`Target seasons: ${plan.targets.length}`);
  console.log(`Total games: ${plan.sources.reduce((sum, row) => sum + row.gameCount, 0)}\n`);

  for (const target of plan.targets) {
    console.log(`Target season: ${target.name}`);
    for (const sourceId of target.sourceSeasonIds) {
      const source = plan.sources.find((row) => row.id === sourceId)!;
      console.log(`  ← ${source.leagueName} / ${source.name} (${source.gameCount} games) [${source.id}]`);
    }
  }
}

async function resolveRosterConflicts(
  tx: Prisma.TransactionClient,
  sourceSeasonIds: string[],
  targetSeasonId: string
) {
  const rosters = await tx.playerTeamSeason.findMany({
    where: { seasonId: { in: sourceSeasonIds }, deletedAt: null },
    orderBy: [{ adminOverride: "desc" }, { updatedAt: "desc" }]
  });

  const byPlayer = new Map<string, typeof rosters>();
  for (const roster of rosters) {
    const group = byPlayer.get(roster.playerId) ?? [];
    group.push(roster);
    byPlayer.set(roster.playerId, group);
  }

  for (const [playerId, group] of byPlayer) {
    const [keeper, ...duplicates] = group;
    for (const duplicate of duplicates) {
      await tx.playerTeamSeason.update({
        where: { id: duplicate.id },
        data: { deletedAt: new Date(), endsOn: duplicate.endsOn ?? new Date() }
      });
    }
    await tx.playerTeamSeason.update({
      where: { id: keeper.id },
      data: { seasonId: targetSeasonId }
    });
    if (duplicates.length) {
      console.log(`  roster dedupe player ${playerId}: kept ${keeper.id}, removed ${duplicates.length}`);
    }
  }
}

async function resolveTeamRatingConflicts(
  tx: Prisma.TransactionClient,
  sourceSeasonIds: string[],
  targetSeasonId: string
) {
  const ratings = await tx.teamRating.findMany({
    where: { seasonId: { in: sourceSeasonIds } },
    orderBy: { computedAt: "desc" }
  });

  const byTeam = new Map<string, typeof ratings>();
  for (const rating of ratings) {
    const group = byTeam.get(rating.teamId) ?? [];
    group.push(rating);
    byTeam.set(rating.teamId, group);
  }

  for (const [, group] of byTeam) {
    const [keeper, ...duplicates] = group;
    for (const duplicate of duplicates) {
      await tx.teamRating.delete({ where: { id: duplicate.id } });
    }
    await tx.teamRating.update({
      where: { id: keeper.id },
      data: { seasonId: targetSeasonId }
    });
  }
}

export async function executeLeagueMerge(plan: LeagueMergePlan) {
  const templateLeague = await prisma.league.findFirst({
    where: { id: plan.sources[0]?.leagueId },
    select: {
      ageGroup: true,
      organizerName: true,
      city: true,
      region: true,
      verificationStatus: true,
      tier: true,
      logoUrl: true,
      adminNotes: true
    }
  });

  if (!templateLeague) throw new Error("No template league found.");

  const sourceLeagueIds = [...new Set(plan.sources.map((row) => row.leagueId))];
  const mergeNote = `Merged leagues on ${new Date().toISOString().slice(0, 10)}: ${sourceLeagueIds.join(", ")}`;

  await prisma.$transaction(async (tx) => {
    let canonicalLeague = await tx.league.findFirst({
      where: { name: plan.canonicalLeagueName, ageGroup: plan.ageGroup, deletedAt: null }
    });

    if (!canonicalLeague) {
      canonicalLeague = await tx.league.create({
        data: {
          name: plan.canonicalLeagueName,
          ageGroup: plan.ageGroup,
          organizerName: templateLeague.organizerName,
          city: templateLeague.city,
          region: templateLeague.region,
          verificationStatus: templateLeague.verificationStatus,
          tier: templateLeague.tier,
          logoUrl: templateLeague.logoUrl,
          adminNotes: mergeNote
        }
      });
      console.log(`Created canonical league ${canonicalLeague.id}`);
    } else {
      await tx.league.update({
        where: { id: canonicalLeague.id },
        data: {
          adminNotes: [canonicalLeague.adminNotes, mergeNote].filter(Boolean).join("\n")
        }
      });
      console.log(`Reusing canonical league ${canonicalLeague.id}`);
    }

    const seasonIdMap = new Map<string, string>();

    for (const target of plan.targets) {
      let canonicalSeason = await tx.season.findUnique({
        where: { leagueId_name: { leagueId: canonicalLeague.id, name: target.name } }
      });

      if (!canonicalSeason) {
        canonicalSeason = await tx.season.create({
          data: {
            leagueId: canonicalLeague.id,
            name: target.name,
            seasonYear: target.seasonYear,
            status: target.status as SeasonStatus,
            startsOn: target.startsOn,
            endsOn: target.endsOn
          }
        });
        console.log(`Created season ${target.name} (${canonicalSeason.id})`);
      } else {
        console.log(`Reusing season ${target.name} (${canonicalSeason.id})`);
      }

      for (const sourceSeasonId of target.sourceSeasonIds) {
        seasonIdMap.set(sourceSeasonId, canonicalSeason.id);
      }

      const gameUpdate = await tx.game.updateMany({
        where: { seasonId: { in: target.sourceSeasonIds }, deletedAt: null },
        data: { seasonId: canonicalSeason.id }
      });
      console.log(`  games reparented: ${gameUpdate.count}`);

      await tx.leagueSeasonAverage.deleteMany({ where: { seasonId: { in: target.sourceSeasonIds } } });

      await resolveRosterConflicts(tx, target.sourceSeasonIds, canonicalSeason.id);
      await resolveTeamRatingConflicts(tx, target.sourceSeasonIds, canonicalSeason.id);
    }

    for (const sourceSeasonId of plan.sources.map((row) => row.id)) {
      await tx.season.update({
        where: { id: sourceSeasonId },
        data: { deletedAt: new Date() }
      });
    }

    for (const sourceLeagueId of sourceLeagueIds) {
      if (sourceLeagueId === canonicalLeague.id) continue;

      const accessRows = await tx.userLeagueAccess.findMany({ where: { leagueId: sourceLeagueId, deletedAt: null } });
      for (const access of accessRows) {
        const existingCanonical = await tx.userLeagueAccess.findUnique({
          where: { userId_leagueId: { userId: access.userId, leagueId: canonicalLeague.id } }
        });
        if (!existingCanonical) {
          await tx.userLeagueAccess.create({
            data: { userId: access.userId, leagueId: canonicalLeague.id }
          });
        } else if (existingCanonical.deletedAt) {
          await tx.userLeagueAccess.update({
            where: { id: existingCanonical.id },
            data: { deletedAt: null }
          });
        }
        await tx.userLeagueAccess.update({
          where: { id: access.id },
          data: { deletedAt: new Date() }
        });
      }

      await tx.league.update({
        where: { id: sourceLeagueId },
        data: {
          deletedAt: new Date(),
          adminNotes: `Merged into ${plan.canonicalLeagueName} (${canonicalLeague.id}) on ${new Date().toISOString()}`
        }
      });
    }

    console.log("\nMerge transaction complete.");
    console.log("Season map:", Object.fromEntries(seasonIdMap));
  }, { timeout: 120000 });
}

export async function verifyCanonicalLeague(canonicalLeagueName: string) {
  const verify = await prisma.league.findFirst({
    where: { name: canonicalLeagueName, deletedAt: null },
    include: {
      seasons: {
        where: { deletedAt: null },
        include: { _count: { select: { games: { where: { deletedAt: null } } } } },
        orderBy: { name: "asc" }
      }
    }
  });

  console.log("\n=== Post-merge verification ===");
  if (!verify) {
    console.log("Canonical league not found.");
    return;
  }

  console.log(`${verify.name} (${verify.id}) — ${verify.ageGroup}`);
  for (const season of verify.seasons) {
    console.log(`  ${season.name}: ${season._count.games} games`);
  }
}

export async function loadLeagueSeasons(leagueIds: string[]): Promise<SourceSeason[]> {
  const leagues = await prisma.league.findMany({
    where: { deletedAt: null, id: { in: leagueIds } },
    include: {
      seasons: {
        where: { deletedAt: null },
        include: { _count: { select: { games: { where: { deletedAt: null } } } } }
      }
    },
    orderBy: { name: "asc" }
  });

  const rows: SourceSeason[] = [];
  for (const league of leagues) {
    for (const season of league.seasons) {
      rows.push({
        id: season.id,
        name: season.name,
        seasonYear: season.seasonYear,
        status: season.status,
        startsOn: season.startsOn,
        endsOn: season.endsOn,
        leagueId: league.id,
        leagueName: league.name,
        gameCount: season._count.games
      });
    }
  }
  return rows;
}
