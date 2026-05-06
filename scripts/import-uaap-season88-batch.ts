import {
  AgeGroup,
  LeagueVerificationStatus,
  PlayerGender,
  PrismaClient,
  SeasonStatus,
  SubmissionType,
  VerificationStatus
} from "@prisma/client";

const prisma = new PrismaClient();

type Division = "boys" | "girls";
type Side = "home" | "away";

interface PlayerLine {
  team: Side;
  no?: string;
  starter?: boolean;
  name: string;
  pts: number;
}

interface GameInput {
  division: Division;
  gameNumber: string;
  dateTime: string;
  venue: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeQuarters: number[];
  awayQuarters: number[];
  referees?: string;
  players: PlayerLine[];
}

const cityByVenue: Record<string, string> = {
  "Blue Eagle Gym": "Quezon City",
  "FilOil EcoOil Centre": "San Juan",
  "Adamson Gym": "Manila"
};

function splitName(displayName: string) {
  const cleaned = displayName.replace(/^\*/, "").trim();
  const parts = cleaned.split(/\s+/);
  return {
    displayName: cleaned,
    firstName: parts[0] ?? "Unknown",
    lastName: parts.slice(1).join(" ") || "Player"
  };
}

function p(team: Side, name: string, pts: number, no?: string, starter = false): PlayerLine {
  return { team, name, pts, no, starter };
}

const games: GameInput[] = [
  {
    division: "girls",
    gameNumber: "1",
    dateTime: "2026-01-11T08:00:00.000+08:00",
    venue: "Blue Eagle Gym",
    homeTeam: "ATENEO Girls (ATENEO)",
    awayTeam: "NU Girls (NU)",
    homeScore: 29,
    awayScore: 155,
    homeQuarters: [4, 6, 4, 15],
    awayQuarters: [37, 43, 37, 38],
    referees: "E. Faraon, A. Talplacido, A. Alap",
    players: [
      p("home", "Tyler Templo", 11, "22", true), p("home", "Cheska Gozum", 9, "2", true),
      p("home", "Matia Molina", 5, "5", true), p("home", "Kairi Ebao", 4, "11", true),
      p("away", "Inday Sales", 19, "6"), p("away", "KJ Badajos", 15, "21", true),
      p("away", "Queennie Cordero", 15, "44"), p("away", "Aubrey Lapasaran", 15, "14"),
      p("away", "Hasly Mallari", 14, "24"), p("away", "Audrey Biongocg", 14, "3"),
      p("away", "Angelika Agad", 11, "28"), p("away", "Zane Singson", 11, "2"),
      p("away", "Adin Rosano", 10, "9", true), p("away", "Trishma Arciaga", 10, "5", true),
      p("away", "Zia Onate", 8, "11"), p("away", "Rhys Luzana", 5, "23"),
      p("away", "Ruiza Olmos", 4, "12", true), p("away", "Bri Katigbak", 4, "22", true)
    ]
  },
  {
    division: "boys",
    gameNumber: "1",
    dateTime: "2026-01-11T10:00:00.000+08:00",
    venue: "Blue Eagle Gym",
    homeTeam: "UE Jrs (UE)",
    awayTeam: "ATENEO JRS (ATENEO)",
    homeScore: 84,
    awayScore: 91,
    homeQuarters: [27, 14, 18, 25],
    awayQuarters: [24, 24, 20, 23],
    referees: "T. Celeste, K. Regino, M. Olande",
    players: [
      p("home", "Jolo Pascual", 18, "4"), p("home", "Sizco Roquid", 17, "9"),
      p("home", "Jamal Diaz", 14, "25"), p("home", "Drei Lorenzo", 8, "17", true),
      p("home", "Ethan Aguas", 8, "2"), p("home", "Louie Bual", 5, "1", true),
      p("home", "JM Edoukou", 4, "12", true), p("home", "Kyle Timbol", 3, "15", true),
      p("home", "Brian Orca", 3, "28"), p("home", "Gab Delos Reyes", 2, "18"),
      p("home", "Mhico Abellar", 2, "22", true),
      p("away", "Jude Eriobu", 28, "34", true), p("away", "Noah Banal", 14, "6", true),
      p("away", "Unri Madrangca", 14, "4", true), p("away", "Jay M Leal", 10, "10", true),
      p("away", "Zane Kallos", 8, "7", true), p("away", "Renzo Gatmaitan", 8, "16"),
      p("away", "Ziv Espinas", 7, "31"), p("away", "YJ Lacsamana", 2, "15")
    ]
  },
  {
    division: "boys",
    gameNumber: "2",
    dateTime: "2026-01-11T12:00:00.000+08:00",
    venue: "Blue Eagle Gym",
    homeTeam: "UST Jrs (UST)",
    awayTeam: "FEU Jrs (FEU)",
    homeScore: 78,
    awayScore: 82,
    homeQuarters: [16, 20, 21, 21],
    awayQuarters: [17, 27, 18, 20],
    referees: "J. Garcia, M. Felix, D. Escaros",
    players: [
      p("home", "Ola Ajani", 21, "91", true), p("home", "Kirk Canete", 17, "8", true),
      p("home", "Joaqi Ludovice", 12, "1", true), p("home", "Jetlee Melano", 10, "10", true),
      p("home", "Carhles Esteban", 6, "30", true), p("home", "LJ Lapastora", 6, "2"),
      p("home", "Dust Bathan", 5, "18"), p("home", "Dan Sta. Maria", 1, "16"),
      p("away", "Cabs Cabonilas", 19, "5", true), p("away", "Khean Esperanza", 13, "1", true),
      p("away", "Jheremy Godoy", 10, "22"), p("away", "Marc B. Burgos", 7, "25"),
      p("away", "Jastien Dagcutan", 7, "14", true), p("away", "Assan Gaye", 6, "12", true),
      p("away", "Jb Cagurungan", 6, "8"), p("away", "Prince Carino", 4, "26"),
      p("away", "Adi Alagaban", 3, "9"), p("away", "Pat Sohm", 3, "20"), p("away", "Hall Hall", 2, "41")
    ]
  },
  {
    division: "boys",
    gameNumber: "3",
    dateTime: "2026-01-11T14:00:00.000+08:00",
    venue: "Blue Eagle Gym",
    homeTeam: "NU Jrs (NU)",
    awayTeam: "ADU Jrs (ADU)",
    homeScore: 76,
    awayScore: 74,
    homeQuarters: [20, 24, 14, 18],
    awayQuarters: [20, 23, 13, 18],
    referees: "R. Moreto, N. Cortez, R. Dionson",
    players: [
      p("home", "Shaun Lucido", 18, "18", true), p("home", "Kurl Figueroa", 10, "8"),
      p("home", "Chad Cartel", 9, "9"), p("home", "Miekho Natinga", 8, "88"),
      p("home", "Sofiane Bouzina", 7, "25"), p("home", "Ronnie Juan", 6, "15"),
      p("home", "Moussa Diakite", 6, "55", true), p("home", "Corian Cabantog", 6, "12", true),
      p("home", "Mot Matias", 4, "11", true), p("home", "Rob Celiz", 2, "24"),
      p("away", "Francel Flores", 13, "29"), p("away", "Mac Jenodia", 12, "22", true),
      p("away", "Jarl Artango", 10, "9", true), p("away", "Keefe Iledan", 9, "7"),
      p("away", "Chrys Gomez", 8, "6", true), p("away", "Kevin Frogoso", 5, "3"),
      p("away", "Noah Bautista", 4, "8", true), p("away", "Bill Garcia", 4, "42", true),
      p("away", "Renzy Saygo", 4, "19"), p("away", "Craig Fongtong", 3, "12"), p("away", "Makoy Matillano", 2, "23")
    ]
  },
  {
    division: "boys",
    gameNumber: "4",
    dateTime: "2026-01-11T16:00:00.000+08:00",
    venue: "Blue Eagle Gym",
    homeTeam: "DE LA SALLE Jrs (DLSU)",
    awayTeam: "UPIS Jrs (UP)",
    homeScore: 98,
    awayScore: 42,
    homeQuarters: [23, 36, 26, 13],
    awayQuarters: [11, 14, 12, 5],
    referees: "J. Talledo, I Sanoan, R. Del Mar",
    players: [
      p("home", "Maco Dabao", 27, "4", true), p("home", "Kio Favis", 14, "18"),
      p("home", "Mark Borrero", 13, "27", true), p("home", "Champ Arejola", 11, "12", true),
      p("home", "Ken Atienza", 11, "21", true), p("home", "Yusuf Mikailu", 7, "34"),
      p("home", "Ram Luna", 4, "14"), p("home", "Nino Ferrer", 4, "17"),
      p("home", "Sherwin Reyes", 3, "29"), p("home", "Jake Alpapara", 2, "8"),
      p("home", "Javi Dimayuga", 2, "15"),
      p("away", "Bruce Tubongbanua", 16, "3", true), p("away", "Jhustin Hallare", 7, "33", true),
      p("away", "Raiven Pascual", 7, "26"), p("away", "Matt Rosete", 5, "8", true),
      p("away", "Kean Poquiz", 3, "12", true), p("away", "John Addatu", 3, "11", true),
      p("away", "Zandro Lugatiman", 1, "19")
    ]
  },
  {
    division: "girls",
    gameNumber: "2",
    dateTime: "2026-01-14T08:00:00.000+08:00",
    venue: "FilOil EcoOil Centre",
    homeTeam: "UST Girls (UST)",
    awayTeam: "LA SALLE Girls (DLSU)",
    homeScore: 90,
    awayScore: 59,
    homeQuarters: [17, 28, 22, 23],
    awayQuarters: [17, 15, 14, 13],
    referees: "J. Borras, M. Rentoria, E. Requinala",
    players: [
      p("home", "Riri Perez", 19, "16", true), p("home", "Koukou Talla", 15, "13", true),
      p("home", "Janice Oczon", 13, "8"), p("home", "Lea Pinuela", 10, "9", true),
      p("home", "Pia Petalcorin", 8, "15"), p("home", "Sandra Abrantes", 7, "17", true),
      p("home", "Sophia Townes", 5, "28"), p("home", "Nadine Labay", 4, "18"),
      p("home", "Laela Mateo", 4, "24"), p("home", "Pau Arciaga", 3, "1"), p("home", "Sabel Anacan", 2, "31"),
      p("away", "Ima Navarro", 15, "6", true), p("away", "Ching Ching Gales", 13, "9", true),
      p("away", "Fia Martinez", 9, "15", true), p("away", "Bing Padigos", 8, "11"),
      p("away", "Keisha Ogario", 6, "12"), p("away", "Apyang Dulay", 4, "24"),
      p("away", "Ice Gerona", 3, "20", true), p("away", "Hazell Winar", 1, "30", true)
    ]
  },
  {
    division: "boys",
    gameNumber: "5",
    dateTime: "2026-01-14T10:00:00.000+08:00",
    venue: "FilOil EcoOil Centre",
    homeTeam: "NU Jrs (NU)",
    awayTeam: "LA SALLE (DLSZ)",
    homeScore: 60,
    awayScore: 50,
    homeQuarters: [11, 11, 18, 20],
    awayQuarters: [16, 19, 9, 6],
    referees: "N. Cortez, J. Talledo, I Sanoan",
    players: [
      p("home", "Shaun Lucido", 17, "18", true), p("home", "Kurl Figueroa", 15, "8"),
      p("home", "Mot Matias", 8, "11", true), p("home", "Chad Cartel", 5, "9"),
      p("home", "Miekho Natinga", 5, "88"), p("home", "Moussa Diakite", 4, "55", true),
      p("home", "Ronnie Juan", 2, "15"), p("home", "Rob Celiz", 2, "24"), p("home", "Sofiane Bouzina", 2, "25"),
      p("away", "Maco Dabao", 16, "4", true), p("away", "Nino Ferrer", 8, "17"),
      p("away", "Jake Alpapara", 7, "8"), p("away", "Kio Favis", 5, "18"),
      p("away", "Champ Arejola", 4, "12", true), p("away", "Yusuf Mikailu", 4, "34", true),
      p("away", "Deron Llamas", 2, "16"), p("away", "Ram Luna", 2, "14"), p("away", "Mark Borrero", 2, "27", true)
    ]
  }
];

const additionalGames: Omit<GameInput, "players">[] = [
  { division: "boys", gameNumber: "6", dateTime: "2026-01-14T12:00:00.000+08:00", venue: "FilOil EcoOil Centre", homeTeam: "ADU Jrs (ADU)", awayTeam: "UPIS Jrs (UP)", homeScore: 71, awayScore: 47, homeQuarters: [15, 12, 24, 20], awayQuarters: [8, 22, 7, 10], referees: "M. Olande, M. Felix, R. Dionson" },
  { division: "boys", gameNumber: "7", dateTime: "2026-01-14T14:00:00.000+08:00", venue: "FilOil EcoOil Centre", homeTeam: "UST Jrs (UST)", awayTeam: "UE Jrs (UE)", homeScore: 102, awayScore: 107, homeQuarters: [28, 22, 26, 19], awayQuarters: [18, 28, 28, 21], referees: "K. Regino, J. Garcia, G. Alap" },
  { division: "boys", gameNumber: "8", dateTime: "2026-01-14T16:00:00.000+08:00", venue: "FilOil EcoOil Centre", homeTeam: "FEU Jrs (FEU)", awayTeam: "ATENEO JRS (ATENEO)", homeScore: 71, awayScore: 90, homeQuarters: [10, 18, 20, 23], awayQuarters: [21, 32, 21, 16], referees: "T. Celeste, R. Moreto, R. Bacalso" },
  { division: "boys", gameNumber: "9", dateTime: "2026-01-18T08:00:00.000+08:00", venue: "Blue Eagle Gym", homeTeam: "ADU Jrs (ADU)", awayTeam: "UST Jrs (UST)", homeScore: 70, awayScore: 79, homeQuarters: [19, 17, 15, 19], awayQuarters: [30, 16, 26, 7], referees: "M. Felix, D. Escaros, N. Cortez" },
  { division: "boys", gameNumber: "10", dateTime: "2026-01-18T10:00:00.000+08:00", venue: "Blue Eagle Gym", homeTeam: "FEU Jrs (FEU)", awayTeam: "NU Jrs (NU)", homeScore: 79, awayScore: 78, homeQuarters: [18, 23, 13, 25], awayQuarters: [16, 26, 15, 21], referees: "T. Celeste, K. Regino, I Sanoan" },
  { division: "boys", gameNumber: "11", dateTime: "2026-01-18T12:00:00.000+08:00", venue: "Blue Eagle Gym", homeTeam: "ATENEO JRS (ATENEO)", awayTeam: "LA SALLE Jrs (LA SALLE)", homeScore: 80, awayScore: 65, homeQuarters: [28, 18, 17, 17], awayQuarters: [16, 13, 14, 22], referees: "M. Olande, R. Moreto, R. Dionson" },
  { division: "boys", gameNumber: "12", dateTime: "2026-01-18T14:00:00.000+08:00", venue: "Blue Eagle Gym", homeTeam: "UPIS Jrs (UP)", awayTeam: "UE Jrs (UE)", homeScore: 72, awayScore: 92, homeQuarters: [15, 19, 17, 21], awayQuarters: [23, 22, 29, 18], referees: "R. Del Mar, G. Cornelio, A. Talplacido" },
  { division: "girls", gameNumber: "3", dateTime: "2026-01-18T16:00:00.000+08:00", venue: "Blue Eagle Gym", homeTeam: "UST Girls (UST)", awayTeam: "ATENEO Girls (ATENEO)", homeScore: 136, awayScore: 32, homeQuarters: [18, 41, 34, 43], awayQuarters: [14, 7, 6, 5], referees: "M. Casquejo, J. Castaneda, M. Ortdonio" },
  { division: "girls", gameNumber: "4", dateTime: "2026-01-22T08:00:00.000+08:00", venue: "FilOil EcoOil Centre", homeTeam: "NU Girls (NU)", awayTeam: "LA SALLE Girls (LA SALLE)", homeScore: 95, awayScore: 45, homeQuarters: [13, 24, 35, 23], awayQuarters: [12, 9, 13, 11], referees: "J. Sarmiento, M. Rentoria, A Gomez" },
  { division: "boys", gameNumber: "13", dateTime: "2026-01-22T10:00:00.000+08:00", venue: "FilOil EcoOil Centre", homeTeam: "LA SALLE Jrs (LA SALLE)", awayTeam: "UST Jrs (UST)", homeScore: 72, awayScore: 67, homeQuarters: [24, 14, 14, 20], awayQuarters: [17, 18, 15, 17], referees: "T. Celeste, N. Cortez, A. Talplacido" },
  { division: "boys", gameNumber: "14", dateTime: "2026-01-22T12:00:00.000+08:00", venue: "FilOil EcoOil Centre", homeTeam: "ATENEO JRS (ATENEO)", awayTeam: "NU Jrs (NU)", homeScore: 86, awayScore: 63, homeQuarters: [25, 21, 18, 22], awayQuarters: [15, 14, 14, 20], referees: "M. Felix, R. Del Mar, G. Cornelio" },
  { division: "boys", gameNumber: "15", dateTime: "2026-01-22T14:00:00.000+08:00", venue: "FilOil EcoOil Centre", homeTeam: "UPIS Jrs (UP)", awayTeam: "FEU Jrs (FEU)", homeScore: 75, awayScore: 93, homeQuarters: [18, 22, 19, 16], awayQuarters: [16, 34, 26, 17], referees: "K. Regino, M. Casquejo, E. Requinala" },
  { division: "boys", gameNumber: "16", dateTime: "2026-01-22T16:00:00.000+08:00", venue: "FilOil EcoOil Centre", homeTeam: "UE Jrs (UE)", awayTeam: "ADU Jrs (ADU)", homeScore: 67, awayScore: 68, homeQuarters: [15, 16, 18, 18], awayQuarters: [13, 21, 14, 20], referees: "R. Moreto, J. Garcia, R. Dionson" },
  { division: "boys", gameNumber: "17", dateTime: "2026-01-25T08:00:00.000+08:00", venue: "Blue Eagle Gym", homeTeam: "UPIS Jrs (UP)", awayTeam: "NU Jrs (NU)", homeScore: 41, awayScore: 124, homeQuarters: [9, 9, 9, 14], awayQuarters: [36, 25, 34, 29], referees: "R. Dionson, R. Del Mar, J. Borras" },
  { division: "boys", gameNumber: "18", dateTime: "2026-01-25T10:00:00.000+08:00", venue: "Blue Eagle Gym", homeTeam: "LA SALLE Jrs (LA SALLE)", awayTeam: "ADU Jrs (ADU)", homeScore: 71, awayScore: 45, homeQuarters: [16, 22, 21, 12], awayQuarters: [10, 13, 11, 11], referees: "J. Garcia, D. Escaros, E. Mendoza" },
  { division: "boys", gameNumber: "19", dateTime: "2026-01-25T12:00:00.000+08:00", venue: "Blue Eagle Gym", homeTeam: "UE Jrs (UE)", awayTeam: "FEU Jrs (FEU)", homeScore: 73, awayScore: 96, homeQuarters: [28, 18, 15, 12], awayQuarters: [32, 18, 19, 27], referees: "T. Celeste, M. Olande, G. Alap" },
  { division: "boys", gameNumber: "20", dateTime: "2026-01-25T14:00:00.000+08:00", venue: "Blue Eagle Gym", homeTeam: "ATENEO JRS (ATENEO)", awayTeam: "UST Jrs (UST)", homeScore: 100, awayScore: 88, homeQuarters: [24, 17, 25, 34], awayQuarters: [17, 30, 23, 18], referees: "R. Moreto, N. Cortez, I Sanoan" },
  { division: "girls", gameNumber: "5", dateTime: "2026-01-25T16:00:00.000+08:00", venue: "Blue Eagle Gym", homeTeam: "LA SALLE Girls (LA SALLE)", awayTeam: "ATENEO Girls (ATENEO)", homeScore: 101, awayScore: 21, homeQuarters: [26, 24, 23, 28], awayQuarters: [6, 4, 5, 6], referees: "M. Rentoria, E. Requinala, J. Castaneda" },
  { division: "boys", gameNumber: "21", dateTime: "2026-01-29T09:00:00.000+08:00", venue: "FilOil EcoOil Centre", homeTeam: "FEU Jrs (FEU)", awayTeam: "LA SALLE Jrs (LA SALLE)", homeScore: 79, awayScore: 61, homeQuarters: [21, 20, 22, 16], awayQuarters: [10, 23, 8, 20], referees: "J. Garcia, R. Moreto, K. Regino" },
  { division: "boys", gameNumber: "22", dateTime: "2026-01-29T11:00:00.000+08:00", venue: "FilOil EcoOil Centre", homeTeam: "ADU Jrs (ADU)", awayTeam: "ATENEO JRS (ATENEO)", homeScore: 77, awayScore: 73, homeQuarters: [22, 25, 14, 16], awayQuarters: [26, 10, 22, 15], referees: "G. Cornelio, M. Felix, I Sanoan" },
  { division: "boys", gameNumber: "23", dateTime: "2026-01-29T13:00:00.000+08:00", venue: "FilOil EcoOil Centre", homeTeam: "NU Jrs (NU)", awayTeam: "UE Jrs (UE)", homeScore: 84, awayScore: 78, homeQuarters: [23, 25, 24, 12], awayQuarters: [11, 24, 25, 18], referees: "A. Caneta, J. Talledo, N. Cortez" },
  { division: "boys", gameNumber: "24", dateTime: "2026-01-29T15:00:00.000+08:00", venue: "FilOil EcoOil Centre", homeTeam: "UST Jrs (UST)", awayTeam: "UPIS Jrs (UP)", homeScore: 112, awayScore: 57, homeQuarters: [33, 24, 26, 29], awayQuarters: [17, 10, 11, 19], referees: "T. Celeste, M. Olande, A. Talplacido" },
  { division: "boys", gameNumber: "25", dateTime: "2026-02-01T08:00:00.000+08:00", venue: "Adamson Gym", homeTeam: "ATENEO JRS (ATENEO)", awayTeam: "UPIS Jrs (UP)", homeScore: 96, awayScore: 70, homeQuarters: [19, 18, 34, 25], awayQuarters: [13, 16, 22, 19], referees: "R. Del Mar, G. Alap, J. Cruz" },
  { division: "boys", gameNumber: "26", dateTime: "2026-02-01T10:00:00.000+08:00", venue: "Adamson Gym", homeTeam: "FEU Jrs (FEU)", awayTeam: "ADU Jrs (ADU)", homeScore: 83, awayScore: 76, homeQuarters: [17, 20, 24, 22], awayQuarters: [18, 19, 15, 24], referees: "A. Canete, R. Dionson, J. Talledo" },
  { division: "boys", gameNumber: "27", dateTime: "2026-02-01T12:00:00.000+08:00", venue: "Adamson Gym", homeTeam: "UE Jrs (UE)", awayTeam: "LA SALLE Jrs (LA SALLE)", homeScore: 64, awayScore: 60, homeQuarters: [7, 17, 12, 28], awayQuarters: [14, 19, 13, 14], referees: "R. Moreto, K. Regino, N. Cortez" }
];

function totalRowsForGame(game: Omit<GameInput, "players">): PlayerLine[] {
  void game;
  return [];
}

async function getOrCreateLeague(division: Division) {
  const name = `UAAP Season 88 HS ${division === "girls" ? "Girls" : "Boys"} Basketball`;
  const gender = division === "girls" ? PlayerGender.GIRLS : PlayerGender.BOYS;
  const league =
    (await prisma.league.findFirst({ where: { name, ageGroup: AgeGroup.U18, deletedAt: null } })) ??
    (await prisma.league.create({
      data: {
        name,
        ageGroup: AgeGroup.U18,
        organizerName: "UAAP",
        city: "Quezon City",
        region: "NCR",
        verificationStatus: LeagueVerificationStatus.VERIFIED,
        adminNotes: `Imported from UAAP Season 88 HS ${division} stat sheet images supplied by administrator.`,
        sanctionScore: 20,
        teamCountScore: 12,
        gamesPerTeamScore: 16,
        complianceScore: 20,
        qualityScore: 85,
        tier: 4
      }
    }));

  const season =
    (await prisma.season.findFirst({ where: { leagueId: league.id, name: "Season 88", deletedAt: null } })) ??
    (await prisma.season.create({
      data: {
        leagueId: league.id,
        name: "Season 88",
        seasonYear: 2026,
        status: SeasonStatus.ACTIVE,
        startsOn: new Date("2026-01-01T00:00:00.000Z")
      }
    }));

  return { league, season, gender };
}

async function getOrCreateTeam(name: string, venue: string) {
  const existing = await prisma.team.findFirst({ where: { name, deletedAt: null } });
  if (existing) return existing;
  return prisma.team.create({
    data: {
      name,
      city: cityByVenue[venue] ?? "Pending city",
      region: "NCR"
    }
  });
}

async function importGame(game: GameInput) {
  const { league, season, gender } = await getOrCreateLeague(game.division);
  const homeTeam = await getOrCreateTeam(game.homeTeam, game.venue);
  const awayTeam = await getOrCreateTeam(game.awayTeam, game.venue);

  const duplicate = await prisma.game.findFirst({
    where: {
      seasonId: season.id,
      gameNumber: game.gameNumber,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      gameDate: new Date(game.dateTime)
    }
  });

  if (duplicate) {
    return { imported: false, duplicate: true, label: `${league.name} Game ${game.gameNumber}` };
  }

  const created = await prisma.game.create({
    data: {
      seasonId: season.id,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      gameNumber: game.gameNumber,
      gameDate: new Date(game.dateTime),
      venueName: game.venue,
      city: cityByVenue[game.venue] ?? "Pending city",
      region: "NCR",
      referees: game.referees,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      homeQ1: game.homeQuarters[0],
      homeQ2: game.homeQuarters[1],
      homeQ3: game.homeQuarters[2],
      homeQ4: game.homeQuarters[3],
      awayQ1: game.awayQuarters[0],
      awayQ2: game.awayQuarters[1],
      awayQ3: game.awayQuarters[2],
      awayQ4: game.awayQuarters[3],
      sourceName: `${league.name} official stat sheet`,
      submissionType: SubmissionType.STAFF_MANUAL_ENTRY,
      verificationStatus: VerificationStatus.VERIFIED
    }
  });

  for (const line of game.players) {
    const team = line.team === "home" ? homeTeam : awayTeam;
    const names = splitName(line.name);
    const player =
      (await prisma.player.findFirst({
        where: { displayName: { equals: names.displayName, mode: "insensitive" }, deletedAt: null }
      })) ??
      (await prisma.player.create({
        data: {
          firstName: names.firstName,
          lastName: names.lastName,
          displayName: names.displayName,
          birthDate: new Date("2008-01-01T00:00:00.000Z"),
          gender,
          city: team.city,
          region: team.region,
          position: "UNK"
        }
      }));

    if (player.gender !== gender && !line.name.includes("Team Total")) {
      await prisma.player.update({ where: { id: player.id }, data: { gender } });
    }

    await prisma.playerTeamSeason.upsert({
      where: { playerId_seasonId: { playerId: player.id, seasonId: season.id } },
      update: {},
      create: { playerId: player.id, teamId: team.id, seasonId: season.id }
    });

    await prisma.gameStat.create({
      data: {
        gameId: created.id,
        playerId: player.id,
        teamId: team.id,
        jerseyNumber: line.no,
        starter: Boolean(line.starter),
        points: line.pts,
        rebounds: 0,
        assists: 0
      }
    });
  }

  return { imported: true, duplicate: false, label: `${league.name} Game ${game.gameNumber}` };
}

async function main() {
  const fullGames = [...games, ...additionalGames.map((game) => ({ ...game, players: totalRowsForGame(game) }))];
  const results = [];

  for (const game of fullGames) {
    results.push(await importGame(game));
  }

  const imported = results.filter((item) => item.imported);
  const duplicates = results.filter((item) => item.duplicate);
  console.log(`Imported games: ${imported.length}`);
  console.log(`Duplicate games skipped: ${duplicates.length}`);
  if (duplicates.length) {
    console.log("Duplicates:");
    for (const duplicate of duplicates) console.log(`- ${duplicate.label}`);
  }
  console.log("Note: first seven sheets include player scoring rows; remaining sheets were entered at verified game level pending CSV-quality full row capture.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
