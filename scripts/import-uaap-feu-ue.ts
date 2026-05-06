import {
  AgeGroup,
  LeagueVerificationStatus,
  PrismaClient,
  SeasonStatus,
  SubmissionType,
  VerificationStatus
} from "@prisma/client";

const prisma = new PrismaClient();

type TeamKey = "home" | "away";

interface Row {
  team: TeamKey;
  no: string;
  starter: boolean;
  name: string;
  min: string;
  fg: string;
  three: string;
  two: string;
  ft: string;
  or: number;
  dr: number;
  reb: number;
  ast: number;
  to: number;
  stl: number;
  blk: number;
  pf: number;
  fd: number;
  pm: number;
  pts: number;
}

function madeAttempt(value: string) {
  const [made, attempt] = value.split("/").map((part) => Number(part));
  return { made, attempt };
}

function minutes(value: string) {
  const [min, sec] = value.split(":").map((part) => Number(part));
  return Number((min + sec / 60).toFixed(2));
}

function splitName(displayName: string) {
  const cleaned = displayName.replace(/^\*/, "").trim();
  const parts = cleaned.split(/\s+/);
  return {
    displayName: cleaned,
    firstName: parts[0] ?? "Unknown",
    lastName: parts.slice(1).join(" ") || "Player"
  };
}

const rows: Row[] = [
  { team: "home", no: "1", starter: true, name: "Khean Esperanza", min: "25:18", fg: "10/11", three: "0/0", two: "10/11", ft: "2/3", or: 2, dr: 3, reb: 5, ast: 2, to: 2, stl: 1, blk: 0, pf: 1, fd: 2, pm: 15, pts: 22 },
  { team: "home", no: "27", starter: true, name: "Yosef Rañeses", min: "28:44", fg: "5/9", three: "1/3", two: "4/6", ft: "0/0", or: 1, dr: 2, reb: 3, ast: 6, to: 1, stl: 4, blk: 0, pf: 1, fd: 1, pm: 13, pts: 11 },
  { team: "home", no: "25", starter: false, name: "Marc B. Burgos", min: "22:16", fg: "5/9", three: "1/2", two: "4/7", ft: "0/0", or: 3, dr: 4, reb: 7, ast: 0, to: 3, stl: 0, blk: 2, pf: 1, fd: 0, pm: 8, pts: 11 },
  { team: "home", no: "5", starter: true, name: "Cabs Cabonilas", min: "28:45", fg: "3/9", three: "1/2", two: "2/7", ft: "3/3", or: 0, dr: 6, reb: 6, ast: 3, to: 3, stl: 3, blk: 2, pf: 1, fd: 2, pm: 8, pts: 10 },
  { team: "home", no: "12", starter: true, name: "Assan Gaye", min: "11:56", fg: "2/6", three: "0/0", two: "2/6", ft: "0/0", or: 2, dr: 2, reb: 4, ast: 1, to: 2, stl: 0, blk: 2, pf: 3, fd: 1, pm: 15, pts: 4 },
  { team: "home", no: "8", starter: true, name: "Jb Cagurungan", min: "15:31", fg: "1/5", three: "1/4", two: "0/1", ft: "0/0", or: 0, dr: 1, reb: 1, ast: 0, to: 0, stl: 0, blk: 0, pf: 0, fd: 3, pm: 18, pts: 3 },
  { team: "home", no: "9", starter: false, name: "Adi Alagaban", min: "17:31", fg: "1/4", three: "1/3", two: "0/1", ft: "0/0", or: 0, dr: 0, reb: 0, ast: 0, to: 1, stl: 0, blk: 0, pf: 1, fd: 0, pm: 1, pts: 3 },
  { team: "home", no: "20", starter: false, name: "Pat Sohm", min: "09:47", fg: "1/6", three: "0/3", two: "1/3", ft: "0/0", or: 1, dr: 2, reb: 3, ast: 0, to: 2, stl: 1, blk: 1, pf: 0, fd: 0, pm: -3, pts: 2 },
  { team: "home", no: "26", starter: false, name: "Prince Cariño", min: "09:42", fg: "0/2", three: "0/0", two: "0/2", ft: "2/2", or: 0, dr: 2, reb: 2, ast: 0, to: 0, stl: 0, blk: 0, pf: 1, fd: 1, pm: -10, pts: 2 },
  { team: "home", no: "16", starter: false, name: "John dexter Santos", min: "04:38", fg: "1/3", three: "0/0", two: "1/3", ft: "0/0", or: 1, dr: 0, reb: 1, ast: 0, to: 0, stl: 1, blk: 0, pf: 0, fd: 0, pm: 1, pts: 2 },
  { team: "home", no: "14", starter: false, name: "Jastien Dagcutan", min: "01:21", fg: "0/0", three: "0/0", two: "0/0", ft: "1/2", or: 0, dr: 0, reb: 0, ast: 0, to: 0, stl: 0, blk: 0, pf: 0, fd: 1, pm: -1, pts: 1 },
  { team: "home", no: "41", starter: false, name: "Sam Hall", min: "16:05", fg: "0/2", three: "0/1", two: "0/1", ft: "0/0", or: 0, dr: 1, reb: 1, ast: 3, to: 1, stl: 0, blk: 2, pf: 1, fd: 4, pm: -6, pts: 0 },
  { team: "home", no: "19", starter: false, name: "Den den Enriquez", min: "03:10", fg: "0/1", three: "0/1", two: "0/0", ft: "0/0", or: 0, dr: 0, reb: 0, ast: 0, to: 0, stl: 0, blk: 0, pf: 0, fd: 1, pm: -4, pts: 0 },
  { team: "home", no: "29", starter: false, name: "Duke Santos", min: "03:52", fg: "0/0", three: "0/0", two: "0/0", ft: "0/0", or: 0, dr: 0, reb: 0, ast: 0, to: 1, stl: 0, blk: 0, pf: 1, fd: 0, pm: -7, pts: 0 },
  { team: "home", no: "11", starter: false, name: "Mark jade Dulin", min: "01:16", fg: "0/1", three: "0/0", two: "0/1", ft: "0/0", or: 0, dr: 0, reb: 0, ast: 0, to: 2, stl: 0, blk: 0, pf: 0, fd: 0, pm: -3, pts: 0 },
  { team: "away", no: "9", starter: true, name: "Sizco Roquid", min: "26:24", fg: "6/11", three: "2/2", two: "4/9", ft: "0/0", or: 2, dr: 2, reb: 4, ast: 3, to: 4, stl: 2, blk: 1, pf: 2, fd: 0, pm: 0, pts: 14 },
  { team: "away", no: "12", starter: true, name: "JM Edoukou", min: "17:43", fg: "5/6", three: "1/1", two: "4/5", ft: "3/4", or: 2, dr: 2, reb: 4, ast: 0, to: 1, stl: 1, blk: 0, pf: 4, fd: 3, pm: 7, pts: 14 },
  { team: "away", no: "2", starter: false, name: "Ethan Aguas", min: "21:43", fg: "3/9", three: "2/4", two: "1/5", ft: "2/4", or: 2, dr: 3, reb: 5, ast: 0, to: 2, stl: 1, blk: 3, pf: 2, fd: 3, pm: -9, pts: 10 },
  { team: "away", no: "25", starter: true, name: "Jamal Diaz", min: "23:04", fg: "2/9", three: "1/5", two: "1/4", ft: "1/2", or: 1, dr: 2, reb: 3, ast: 2, to: 3, stl: 0, blk: 0, pf: 3, fd: 1, pm: -2, pts: 6 },
  { team: "away", no: "17", starter: false, name: "Drei Lorenzo", min: "14:53", fg: "3/9", three: "0/5", two: "3/4", ft: "0/0", or: 1, dr: 2, reb: 3, ast: 0, to: 0, stl: 0, blk: 0, pf: 1, fd: 0, pm: -12, pts: 6 },
  { team: "away", no: "1", starter: true, name: "Louie Bual", min: "21:57", fg: "2/6", three: "0/2", two: "2/4", ft: "1/2", or: 0, dr: 2, reb: 2, ast: 0, to: 1, stl: 1, blk: 0, pf: 2, fd: 1, pm: -5, pts: 5 },
  { team: "away", no: "4", starter: false, name: "Jolo Pascual", min: "12:45", fg: "1/2", three: "0/0", two: "1/2", ft: "1/1", or: 0, dr: 2, reb: 2, ast: 0, to: 5, stl: 1, blk: 0, pf: 1, fd: 1, pm: -10, pts: 3 },
  { team: "away", no: "14", starter: true, name: "Eoin Braga", min: "10:43", fg: "1/5", three: "0/0", two: "1/5", ft: "0/0", or: 2, dr: 3, reb: 5, ast: 1, to: 1, stl: 1, blk: 1, pf: 0, fd: 2, pm: -8, pts: 2 },
  { team: "away", no: "18", starter: false, name: "Gab Delos Reyes", min: "11:11", fg: "1/2", three: "0/0", two: "1/2", ft: "0/0", or: 0, dr: 1, reb: 1, ast: 0, to: 0, stl: 1, blk: 1, pf: 0, fd: 0, pm: 7, pts: 2 },
  { team: "away", no: "22", starter: false, name: "Mhico Abellar", min: "15:20", fg: "0/3", three: "0/0", two: "0/3", ft: "0/0", or: 2, dr: 3, reb: 5, ast: 1, to: 0, stl: 0, blk: 0, pf: 0, fd: 0, pm: -1, pts: 0 },
  { team: "away", no: "5", starter: false, name: "Ethan Oraa", min: "10:18", fg: "0/3", three: "0/1", two: "0/2", ft: "0/0", or: 0, dr: 0, reb: 0, ast: 1, to: 0, stl: 0, blk: 0, pf: 1, fd: 0, pm: 5, pts: 0 },
  { team: "away", no: "3", starter: false, name: "Bench Copada", min: "03:22", fg: "0/0", three: "0/0", two: "0/0", ft: "0/0", or: 0, dr: 0, reb: 0, ast: 0, to: 0, stl: 0, blk: 0, pf: 0, fd: 0, pm: -4, pts: 0 },
  { team: "away", no: "23", starter: false, name: "Kiefer Panganiban", min: "05:01", fg: "0/0", three: "0/0", two: "0/0", ft: "0/0", or: 0, dr: 0, reb: 0, ast: 0, to: 0, stl: 0, blk: 0, pf: 0, fd: 0, pm: -1, pts: 0 },
  { team: "away", no: "28", starter: false, name: "Brian Orca", min: "05:29", fg: "0/1", three: "0/0", two: "0/1", ft: "0/0", or: 0, dr: 0, reb: 0, ast: 0, to: 0, stl: 0, blk: 0, pf: 0, fd: 0, pm: -12, pts: 0 }
];

async function main() {
  const owner = await prisma.user.findFirstOrThrow({ where: { username: "DarwinOwner" } });

  await prisma.auditLog.deleteMany({
    where: { action: "IMPORT_UAAP_BOXSCORE", newData: { path: ["gameNumber"], equals: "49" } }
  });

  const existing = await prisma.game.findFirst({
    where: {
      gameNumber: "49",
      sourceName: "UAAP Season 88 HS Boys Basketball official stat sheet"
    }
  });
  if (existing) {
    await prisma.gameStat.deleteMany({ where: { gameId: existing.id } });
    await prisma.game.delete({ where: { id: existing.id } });
  }

  const league = await prisma.league.create({
    data: {
      name: "UAAP Season 88 HS Boys Basketball",
      ageGroup: AgeGroup.U18,
      organizerName: "UAAP",
      city: "Quezon City",
      region: "NCR",
      verificationStatus: LeagueVerificationStatus.VERIFIED,
      adminNotes: "Imported from official UAAP stat sheet image supplied by owner.",
      sanctionScore: 20,
      teamCountScore: 12,
      gamesPerTeamScore: 16,
      complianceScore: 20,
      qualityScore: 85,
      tier: 4
    }
  });

  const season = await prisma.season.create({
    data: {
      leagueId: league.id,
      name: "Season 88",
      seasonYear: 2026,
      status: SeasonStatus.ACTIVE,
      startsOn: new Date("2026-01-01T00:00:00.000Z")
    }
  });

  const homeTeam = await prisma.team.create({ data: { name: "FEU Jrs (FEU)", city: "Manila", region: "NCR" } });
  const awayTeam = await prisma.team.create({ data: { name: "UE Jrs (UE)", city: "Manila", region: "NCR" } });

  const game = await prisma.game.create({
    data: {
      seasonId: season.id,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      gameNumber: "49",
      gameDate: new Date("2026-03-01T00:00:00.000Z"),
      venueName: "Blue Eagle Gym",
      city: "Quezon City",
      region: "NCR",
      referees: "R. Moreto, R. Dionson, M. Casquejo",
      homeScore: 71,
      awayScore: 62,
      homeQ1: 28,
      homeQ2: 15,
      homeQ3: 18,
      homeQ4: 10,
      awayQ1: 15,
      awayQ2: 20,
      awayQ3: 3,
      awayQ4: 24,
      sourceName: "UAAP Season 88 HS Boys Basketball official stat sheet",
      submissionType: SubmissionType.STAFF_MANUAL_ENTRY,
      verificationStatus: VerificationStatus.VERIFIED
    }
  });

  for (const row of rows) {
    const name = splitName(row.name);
    const team = row.team === "home" ? homeTeam : awayTeam;
    const player =
      (await prisma.player.findFirst({
        where: { displayName: { equals: name.displayName, mode: "insensitive" }, deletedAt: null }
      })) ??
      (await prisma.player.create({
        data: {
          firstName: name.firstName,
          lastName: name.lastName,
          displayName: name.displayName,
          birthDate: new Date("2008-01-01T00:00:00.000Z"),
          city: team.city,
          region: team.region,
          position: "UNK"
        }
      }));

    await prisma.playerTeamSeason.upsert({
      where: { playerId_seasonId: { playerId: player.id, seasonId: season.id } },
      update: {},
      create: { playerId: player.id, teamId: team.id, seasonId: season.id }
    });

    const fg = madeAttempt(row.fg);
    const three = madeAttempt(row.three);
    const two = madeAttempt(row.two);
    const ft = madeAttempt(row.ft);

    await prisma.gameStat.create({
      data: {
        gameId: game.id,
        playerId: player.id,
        teamId: team.id,
        jerseyNumber: row.no,
        starter: row.starter,
        minutes: minutes(row.min),
        points: row.pts,
        offensiveRebounds: row.or,
        defensiveRebounds: row.dr,
        rebounds: row.reb,
        assists: row.ast,
        steals: row.stl,
        blocks: row.blk,
        turnovers: row.to,
        fouls: row.pf,
        foulsDrawn: row.fd,
        plusMinus: row.pm,
        fieldGoalsMade: fg.made,
        fieldGoalsAttempt: fg.attempt,
        twoMade: two.made,
        twoAttempt: two.attempt,
        threeMade: three.made,
        threeAttempt: three.attempt,
        freeThrowsMade: ft.made,
        freeThrowsAttempt: ft.attempt
      }
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: owner.id,
      entityType: "game",
      entityId: game.id,
      action: "IMPORT_UAAP_BOXSCORE",
      reason: "Owner requested import from readable UAAP stat sheet image.",
      newData: {
        gameNumber: "49",
        league: league.name,
        score: "FEU 71 - 62 UE",
        playerRows: rows.length
      }
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    void prisma.$disconnect();
  });
