import { AgeGroup, PlayerGender, RankingScope } from "@prisma/client";
import { slugify } from "./format";
import { getUaapSchoolDisplayName } from "./uaap-school-display";
import { getMonthStart } from "./ranking-eligibility";
import { prisma } from "./prisma";

const formulaVersionNumber = 1;
const defaultAgeGroup = AgeGroup.U19;
const rankingAgeGroups = [AgeGroup.U13, AgeGroup.U16, AgeGroup.U19] as const;

export type RankingGender = "Boys" | "Girls";
export type RankingAgeGroup = "U13" | "U16" | "U19";

export type NationalRankingRow = {
  rank: number;
  playerId: string;
  displayName: string;
  slug: string;
  city: string;
  region: string;
  position: string | null;
  heightCm: number | null;
  birthYear: number | null;
  age: number | null;
  currentTeam: string;
  photoUrl: string | null;
  gender: RankingGender;
  ageGroup: RankingAgeGroup;
  rating: number;
  starRating: number;
  verifiedGameCount: number;
};

export type NationalRankingSnapshot = {
  snapshotId: string | null;
  gender: RankingGender;
  ageGroup: RankingAgeGroup;
  weekOf: string | null;
  formulaVersionId: string | null;
  totalRows: number;
  rows: NationalRankingRow[];
};

export type LatestNationalRankings = {
  formulaVersionId: string | null;
  snapshots: {
    boys: NationalRankingSnapshot;
    girls: NationalRankingSnapshot;
  };
  snapshotsByAge: Record<RankingAgeGroup, { boys: NationalRankingSnapshot; girls: NationalRankingSnapshot }>;
};

function toDisplayGender(gender: PlayerGender): RankingGender {
  return gender === PlayerGender.GIRLS ? "Girls" : "Boys";
}

function calculateAge(birthDate: Date | null) {
  if (!birthDate) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birthDate.getUTCDate())) age -= 1;
  return age;
}

function emptySnapshot(gender: PlayerGender, formulaVersionId: string | null, ageGroup: RankingAgeGroup): NationalRankingSnapshot {
  return { snapshotId: null, gender: toDisplayGender(gender), ageGroup, weekOf: null, formulaVersionId, totalRows: 0, rows: [] };
}

async function getLatestSnapshot(gender: PlayerGender, formulaVersionId: string | null, ageGroup: RankingAgeGroup): Promise<NationalRankingSnapshot> {
  if (!formulaVersionId) return emptySnapshot(gender, null, ageGroup);

  const snapshots = await prisma.rankingSnapshot.findMany({
    where: { scope: RankingScope.NATIONAL, ageGroup: ageGroup as AgeGroup, gender, formulaVersionId, city: null, region: null },
    include: {
      rows: {
        include: {
          player: {
            select: {
              id: true,
              displayName: true,
              city: true,
              region: true,
              position: true,
              heightCm: true,
              birthDate: true,
              photoUrl: true,
              gender: true,
              gameStats: {
                where: { deletedAt: null, game: { season: { league: { ageGroup: ageGroup as AgeGroup } } } },
                include: { team: { select: { name: true } } },
                orderBy: { game: { gameDate: "desc" } },
                take: 1
              }
            }
          }
        },
        orderBy: { rank: "asc" }
      }
    },
    orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }]
  });

  const snapshot = snapshots.find((item) => item.weekOf.getTime() === getMonthStart(item.weekOf).getTime()) ?? null;
  if (!snapshot) return emptySnapshot(gender, formulaVersionId, ageGroup);

  return {
    snapshotId: snapshot.id,
    gender: toDisplayGender(snapshot.gender),
    ageGroup: (snapshot.ageGroup ?? ageGroup) as RankingAgeGroup,
    weekOf: snapshot.weekOf.toISOString(),
    formulaVersionId: snapshot.formulaVersionId,
    totalRows: snapshot.rows.length,
    rows: snapshot.rows.map((row) => ({
      rank: row.rank,
      playerId: row.playerId,
      displayName: row.player.displayName,
      slug: slugify(row.player.displayName),
      city: row.player.city,
      region: row.player.region,
      position: row.player.position,
      heightCm: row.player.heightCm,
      birthYear: row.player.birthDate ? row.player.birthDate.getUTCFullYear() : null,
      age: calculateAge(row.player.birthDate),
      currentTeam: getUaapSchoolDisplayName(row.player.gameStats[0]?.team.name),
      photoUrl: row.player.photoUrl,
      gender: toDisplayGender(row.player.gender),
      ageGroup: (snapshot.ageGroup ?? ageGroup) as RankingAgeGroup,
      rating: Number(row.rating),
      starRating: row.starRating,
      verifiedGameCount: row.verifiedGameCount
    }))
  };
}

export async function getLatestNationalRankings(): Promise<LatestNationalRankings> {
  const formulaVersion = await prisma.formulaVersion.findUnique({ where: { versionNumber: formulaVersionNumber }, select: { id: true } });
  const formulaVersionId = formulaVersion?.id ?? null;
  const entries = await Promise.all(rankingAgeGroups.map(async (ageGroup) => {
    const [boys, girls] = await Promise.all([
      getLatestSnapshot(PlayerGender.BOYS, formulaVersionId, ageGroup),
      getLatestSnapshot(PlayerGender.GIRLS, formulaVersionId, ageGroup)
    ]);
    return [ageGroup, { boys, girls }] as const;
  }));
  const snapshotsByAge = Object.fromEntries(entries) as Record<RankingAgeGroup, { boys: NationalRankingSnapshot; girls: NationalRankingSnapshot }>;
  return { formulaVersionId, snapshots: snapshotsByAge[defaultAgeGroup], snapshotsByAge };
}
