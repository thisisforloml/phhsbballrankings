/**
 * Read-only: trace LSGH -> DLSZ display substitution.
 * Usage: npx tsx scripts/investigate-lsgh-dlsz-display.ts
 */
import { prisma } from "../src/lib/prisma";
import { getProgramDisplayName, getTeamDisplayName, resolveProgramIdentity } from "../src/lib/uaap-school-display";
import { resolvePrimaryRankingAffiliation } from "../src/lib/player-display-affiliation";

async function main() {
  const programs = await prisma.program.findMany({
    where: {
      deletedAt: null,
      OR: [
        { fullName: { contains: "La Salle", mode: "insensitive" } },
        { abbreviation: { contains: "LSGH", mode: "insensitive" } },
        { abbreviation: { contains: "DLSZ", mode: "insensitive" } },
        { fullName: { contains: "Green Hills", mode: "insensitive" } },
        { fullName: { contains: "Zobel", mode: "insensitive" } }
      ]
    },
    select: { id: true, fullName: true, abbreviation: true, type: true }
  });

  const teams = await prisma.team.findMany({
    where: {
      deletedAt: null,
      OR: [
        { name: { contains: "La Salle", mode: "insensitive" } },
        { name: { contains: "LSGH", mode: "insensitive" } },
        { name: { contains: "Green Hills", mode: "insensitive" } },
        { name: { contains: "Zobel", mode: "insensitive" } },
        { name: { contains: "DLSZ", mode: "insensitive" } }
      ]
    },
    select: {
      id: true,
      name: true,
      programId: true,
      program: { select: { fullName: true, abbreviation: true, type: true } }
    }
  });

  const lsghPlayers = await prisma.player.findMany({
    where: {
      deletedAt: null,
      OR: [
        { currentProgram: { fullName: { contains: "Green Hills", mode: "insensitive" } } },
        { currentProgram: { abbreviation: { contains: "LSGH", mode: "insensitive" } } },
        {
          gameStats: {
            some: {
              deletedAt: null,
              team: {
                OR: [
                  { name: { contains: "Green Hills", mode: "insensitive" } },
                  { name: { contains: "LSGH", mode: "insensitive" } }
                ]
              }
            }
          }
        }
      ]
    },
    select: {
      id: true,
      displayName: true,
      schoolOverride: true,
      currentProgram: { select: { id: true, fullName: true, abbreviation: true, type: true } },
      gameStats: {
        where: { deletedAt: null },
        select: {
          team: {
            select: {
              name: true,
              program: { select: { fullName: true, abbreviation: true, type: true } }
            }
          },
          game: { select: { gameDate: true } }
        },
        orderBy: { game: { gameDate: "desc" } },
        take: 40
      },
      currentRatings: {
        select: { ageGroup: true, adjustedRating: true, verifiedGameCount: true },
        take: 5
      }
    }
  });

  const affected = lsghPlayers.map((player) => {
    const affiliation = resolvePrimaryRankingAffiliation({
      schoolOverride: player.schoolOverride,
      currentProgram: player.currentProgram,
      gameStats: player.gameStats
    });
    const teamNames = [...new Set(player.gameStats.map((s) => s.team.name))];
    const programNames = [...new Set(player.gameStats.map((s) => s.team.program?.fullName).filter(Boolean))];

    const displayTests = teamNames.map((name) => ({
      rawTeamName: name,
      getProgramDisplayName: getProgramDisplayName(name),
      getTeamDisplayName: getTeamDisplayName(name),
      resolveProgramIdentity: resolveProgramIdentity(name)
    }));

    const showsDlsz = affiliation.includes("Zobel") || affiliation === "De La Salle Santiago Zobel";

    return {
      playerId: player.id,
      displayName: player.displayName,
      schoolOverride: player.schoolOverride,
      dbCurrentProgram: player.currentProgram,
      uniqueTeamNames: teamNames,
      uniqueProgramNamesFromTeams: programNames,
      renderedAffiliation: affiliation,
      showsDlsz,
      displayTests,
      ratings: player.currentRatings
    };
  });

  const dlszMislabeled = affected.filter((p) => p.showsDlsz);
  const correctlyLabeled = affected.filter((p) => !p.showsDlsz);

  const rankedLsgh = await prisma.playerRating.findMany({
    where: {
      player: {
        deletedAt: null,
        OR: [
          { currentProgramId: "a2cce9e2-795c-4580-9f2b-499d02c2673a" },
          {
            gameStats: {
              some: {
                deletedAt: null,
                team: { programId: "a2cce9e2-795c-4580-9f2b-499d02c2673a" }
              }
            }
          }
        ]
      }
    },
    select: {
      ageGroup: true,
      adjustedRating: true,
      verifiedGameCount: true,
      player: {
        select: {
          id: true,
          displayName: true,
          schoolOverride: true,
          currentProgram: { select: { fullName: true, abbreviation: true, type: true } },
          gameStats: {
            where: { deletedAt: null },
            select: {
              team: {
                select: {
                  name: true,
                  program: { select: { fullName: true, abbreviation: true, type: true } }
                }
              },
              game: { select: { gameDate: true } }
            },
            orderBy: { game: { gameDate: "desc" } },
            take: 40
          }
        }
      }
    },
    orderBy: { adjustedRating: "desc" }
  });

  const rankedDisplayTrace = rankedLsgh.map((rating) => {
    const player = rating.player;
    const affiliation = resolvePrimaryRankingAffiliation({
      schoolOverride: player.schoolOverride,
      currentProgram: player.currentProgram,
      gameStats: player.gameStats
    });
    const rankingTableLabel = getProgramDisplayName(affiliation) || affiliation || "—";
    return {
      displayName: player.displayName,
      playerId: player.id,
      ageGroup: rating.ageGroup,
      rating: Number(rating.adjustedRating),
      affiliationFromRankingsQuery: affiliation,
      rankingTableRenderedLabel: rankingTableLabel,
      mislabeledAsDlsz: rankingTableLabel.includes("Zobel")
    };
  });

  console.log(
    JSON.stringify(
      {
        aliasProbe: {
          laSalleGreenHills: {
            input: "La Salle Green Hills",
            getProgramDisplayName: getProgramDisplayName("La Salle Green Hills"),
            getTeamDisplayName: getTeamDisplayName("La Salle Green Hills"),
            identity: resolveProgramIdentity("La Salle Green Hills")
          },
          lsgh: {
            input: "LSGH",
            getProgramDisplayName: getProgramDisplayName("LSGH"),
            identity: resolveProgramIdentity("LSGH")
          },
          laSalleGreenHillsU19Boys: {
            input: "La Salle Green Hills U19 Boys",
            getProgramDisplayName: getProgramDisplayName("La Salle Green Hills U19 Boys"),
            identity: resolveProgramIdentity("La Salle Green Hills U19 Boys")
          }
        },
        programs,
        teams,
        totalLsghEvidencePlayers: affected.length,
        dlszMislabeledCount: dlszMislabeled.length,
        dlszMislabeled: dlszMislabeled.map((p) => ({
          displayName: p.displayName,
          playerId: p.playerId,
          rendered: p.renderedAffiliation,
          dbProgram: p.dbCurrentProgram,
          teamNames: p.uniqueTeamNames,
          displayTests: p.displayTests.map((t) => ({
            raw: t.rawTeamName,
            program: t.getProgramDisplayName,
            rule: t.resolveProgramIdentity.programKey
          }))
        })),
        correctlyLabeledSample: correctlyLabeled.slice(0, 5),
        rankedDisplayTrace,
        rankedMislabeledCount: rankedDisplayTrace.filter((row) => row.mislabeledAsDlsz).length
      },
      null,
      2
    )
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
