import { Prisma } from "@prisma/client";

export const activeCompetitionGameWhere = {
  deletedAt: null,
  season: { deletedAt: null, league: { deletedAt: null } },
  homeTeam: { deletedAt: null },
  awayTeam: { deletedAt: null },
} as const;

export const activeCompetitionGameStatWhere = {
  deletedAt: null,
  game: activeCompetitionGameWhere,
} as const;

export const activeCompetitionGameSql = Prisma.sql`
  g."deletedAt" IS NULL
  AND s."deletedAt" IS NULL
  AND l."deletedAt" IS NULL
  AND ht."deletedAt" IS NULL
  AND at."deletedAt" IS NULL
`;

export const activeCompetitionGameJoins = Prisma.sql`
  FROM games g
  INNER JOIN seasons s ON s.id = g."seasonId"
  INNER JOIN leagues l ON l.id = s."leagueId"
  INNER JOIN teams ht ON ht.id = g."homeTeamId"
  INNER JOIN teams at ON at.id = g."awayTeamId"
`;
