import { AgeGroup, PlayerGender, PrismaClient, VerificationStatus } from "@prisma/client";

const prisma = new PrismaClient();

type Side = "home" | "away";
type Division = "boys" | "girls";

interface Row {
  team: Side;
  name: string;
  pts: number;
  starter?: boolean;
}

interface GameRows {
  division: Division;
  gameNumber: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  rows: Row[];
}

function r(team: Side, name: string, pts: number, starter = false): Row {
  return { team, name, pts, starter };
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

const games: GameRows[] = [
  {
    division: "boys", gameNumber: "6", date: "2026-01-14", homeTeam: "ADU Jrs (ADU)", awayTeam: "UPIS Jrs (UP)",
    rows: [
      r("home", "Mac Jenodia", 17, true), r("home", "Jarl Artango", 15, true), r("home", "Keefe Iledan", 8, true), r("home", "Francel Flores", 7, true), r("home", "Kevin Frogoso", 5), r("home", "Chrys Gomez", 5), r("home", "Renzy Saygo", 5), r("home", "Craig Fongtong", 4), r("home", "Noah Bautista", 3), r("home", "JP Eiman", 2), r("home", "Makoy Matillano", 0), r("home", "Nazi Babad", 0), r("home", "Marco Alcartado", 0), r("home", "Bill Garcia", 0, true), r("home", "Zyron Gonzales", 0), r("home", "Ivan Sailog", 0),
      r("away", "Bruce Tubongbanua", 17, true), r("away", "Jhustin Hallare", 10, true), r("away", "Kean Poquiz", 6, true), r("away", "Matt Rosete", 5, true), r("away", "Zandro Lugatiman", 4, true), r("away", "Raiven Pascual", 3), r("away", "MJ Rosete", 2), r("away", "John Addatu", 0), r("away", "Yojan Manguerra", 0), r("away", "Peter Hernandez", 0), r("away", "Daniel Cobico", 0), r("away", "Dominic Labao", 0)
    ]
  },
  {
    division: "boys", gameNumber: "7", date: "2026-01-14", homeTeam: "UST Jrs (UST)", awayTeam: "UE Jrs (UE)",
    rows: [
      r("home", "Joaqi Ludovice", 28, true), r("home", "Simon Pulongbarit", 24), r("home", "Jetlee Melano", 20, true), r("home", "Kirk Canete", 13, true), r("home", "Ola Ajani", 6, true), r("home", "LJ Lapastora", 4), r("home", "Carsson Vidanes", 3), r("home", "Third Candare", 2), r("home", "Dust Bathan", 2), r("home", "Carhles Esteban", 0, true), r("home", "Dan Sta. Maria", 0), r("home", "Liam Acido", 0),
      r("away", "Sizco Roquid", 26, true), r("away", "Ethan Aguas", 18, true), r("away", "Jamal Diaz", 13), r("away", "JM Edoukou", 9, true), r("away", "Mhico Abellar", 9), r("away", "Jolo Pascual", 8), r("away", "Gab Delos Reyes", 8), r("away", "Brian Orca", 6), r("away", "Kyle Timbol", 5, true), r("away", "Drei Lorenzo", 4, true), r("away", "Eoin Braga", 1), r("away", "Louie Bual", 0), r("away", "Ethan Oraa", 0)
    ]
  },
  {
    division: "boys", gameNumber: "8", date: "2026-01-14", homeTeam: "FEU Jrs (FEU)", awayTeam: "ATENEO JRS (ATENEO)",
    rows: [
      r("home", "Cabs Cabonilas", 14, true), r("home", "Khean Esperanza", 10), r("home", "Jheremy Godoy", 8), r("home", "Pat Sohm", 8), r("home", "Marc B. Burgos", 8), r("home", "Hall Hall", 7), r("home", "Yosef Raneses", 4, true), r("home", "Jb Cagurungan", 4, true), r("home", "Jastien Dagcutan", 3, true), r("home", "Assan Gaye", 3, true), r("home", "Adi Alagaban", 2), r("home", "John dexter Santos", 0), r("home", "Prince Carino", 0), r("home", "Duke Santos", 0),
      r("away", "Jude Eriobu", 22, true), r("away", "Jay M Leal", 17, true), r("away", "Unri Madrangca", 15, true), r("away", "Ziv Espinas", 9), r("away", "Noah Banal", 9, true), r("away", "Zane Kallos", 7, true), r("away", "Renzo Gatmaitan", 4), r("away", "Aiori Aquino", 3), r("away", "Q. Molina", 2), r("away", "YJ Lacsamana", 2), r("away", "Sky Jazul", 0)
    ]
  },
  {
    division: "boys", gameNumber: "9", date: "2026-01-18", homeTeam: "ADU Jrs (ADU)", awayTeam: "UST Jrs (UST)",
    rows: [
      r("home", "Mac Jenodia", 11, true), r("home", "Keefe Iledan", 10, true), r("home", "Chrys Gomez", 8, true), r("home", "Jarl Artango", 8), r("home", "Francel Flores", 7, true), r("home", "Bill Garcia", 6), r("home", "JP Eiman", 5), r("home", "Kevin Frogoso", 4), r("home", "Noah Bautista", 3), r("home", "Renzy Saygo", 3), r("home", "Makoy Matillano", 3), r("home", "Ivan Sailog", 2), r("home", "Nazi Babad", 0), r("home", "Craig Fongtong", 0), r("home", "Marco Alcartado", 0), r("home", "Zyron Gonzales", 0),
      r("away", "Ola Ajani", 12, true), r("away", "Joaqi Ludovice", 9, true), r("away", "JC Canapi", 9), r("away", "Carhles Esteban", 8), r("away", "LJ Lapastora", 8), r("away", "Simon Pulongbarit", 8, true), r("away", "Jetlee Melano", 7, true), r("away", "Dan Sta. Maria", 6), r("away", "Kyle Bandigan", 3), r("away", "Liam Acido", 3), r("away", "Carsson Vidanes", 2), r("away", "Tomas Cruz", 2), r("away", "Kirk Canete", 1, true), r("away", "Sean Bohol", 1), r("away", "Dust Bathan", 0), r("away", "Third Candare", 0)
    ]
  },
  {
    division: "boys", gameNumber: "10", date: "2026-01-18", homeTeam: "FEU Jrs (FEU)", awayTeam: "NU Jrs (NU)",
    rows: [
      r("home", "Cabs Cabonilas", 22, true), r("home", "Sam Hall", 13), r("home", "Jheremy Godoy", 11), r("home", "Marc B. Burgos", 9), r("home", "Adi Alagaban", 8), r("home", "Assan Gaye", 7, true), r("home", "Yosef Raneses", 4, true), r("home", "Prince Carino", 4), r("home", "John dexter Santos", 1), r("home", "Jb Cagurungan", 0), r("home", "Jastien Dagcutan", 0), r("home", "Khean Esperanza", 0, true), r("home", "Pat Sohm", 0),
      r("away", "Shaun Lucido", 20, true), r("away", "Kurl Figueroa", 17), r("away", "Moussa Diakite", 16, true), r("away", "Chad Cartel", 6), r("away", "Corian Cabantog", 6, true), r("away", "Mot Matias", 4, true), r("away", "Ronnie Juan", 4), r("away", "Rob Celiz", 3), r("away", "Sofiane Bouzina", 2), r("away", "Miekho Natinga", 0), r("away", "Sal Mann", 0, true), r("away", "Allan Timbang", 0)
    ]
  },
  {
    division: "boys", gameNumber: "11", date: "2026-01-18", homeTeam: "ATENEO JRS (ATENEO)", awayTeam: "LA SALLE Jrs (LA SALLE)",
    rows: [
      r("home", "Jay M Leal", 19, true), r("home", "Noah Banal", 17, true), r("home", "Zane Kallos", 11, true), r("home", "Ziv Espinas", 11), r("home", "Jude Eriobu", 9, true), r("home", "YJ Lacsamana", 7), r("home", "Aiori Aquino", 6), r("home", "Renzo Gatmaitan", 0), r("home", "Q. Molina", 0), r("home", "EK Kaw", 0), r("home", "ER Reyes", 0), r("home", "Jared Magpoc", 0), r("home", "Unri Madrangca", 0),
      r("away", "Maco Dabao", 24), r("away", "Kio Favis", 14), r("away", "Ram Luna", 7), r("away", "Jake Alpapara", 6), r("away", "Mark Borrero", 6, true), r("away", "Champ Arejola", 5, true), r("away", "Yusuf Mikailu", 2, true), r("away", "Duncan Tan", 1), r("away", "Ken Atienza", 0, true), r("away", "Deron Llamas", 0), r("away", "Nino Ferrer", 0), r("away", "Javi Dimayuga", 0)
    ]
  },
  {
    division: "boys", gameNumber: "12", date: "2026-01-18", homeTeam: "UPIS Jrs (UP)", awayTeam: "UE Jrs (UE)",
    rows: [
      r("home", "Jhustin Hallare", 32, true), r("home", "Bruce Tubongbanua", 13, true), r("home", "Kean Poquiz", 12, true), r("home", "Raiven Pascual", 7), r("home", "Matt Rosete", 5, true), r("home", "Zandro Lugatiman", 3, true), r("home", "John Addatu", 0), r("home", "Peter Hernandez", 0), r("home", "Dominic Labao", 0), r("home", "Daniel Cobico", 0), r("home", "Yojan Manguerra", 0), r("home", "MJ Rosete", 0),
      r("away", "Ethan Aguas", 19), r("away", "Sizco Roquid", 14, true), r("away", "Jamal Diaz", 10), r("away", "Mhico Abellar", 8), r("away", "Eoin Braga", 8), r("away", "Kyle Timbol", 7), r("away", "Louie Bual", 6, true), r("away", "Kiefer Panganiban", 4), r("away", "JM Edoukou", 4), r("away", "Brian Orca", 3), r("away", "Ethan Oraa", 3, true), r("away", "Gab Delos Reyes", 2), r("away", "Bench Copada", 2, true), r("away", "Jolo Pascual", 2), r("away", "Drei Lorenzo", 0, true)
    ]
  },
  {
    division: "girls", gameNumber: "3", date: "2026-01-18", homeTeam: "UST Girls (UST)", awayTeam: "ATENEO Girls (ATENEO)",
    rows: [
      r("home", "Nadine Labay", 21), r("home", "Janice Oczon", 20, true), r("home", "Koukou Talla", 18, true), r("home", "Riri Perez", 16, true), r("home", "Pia Petalcorin", 14), r("home", "Pau Arciaga", 14), r("home", "Lea Pinuela", 8, true), r("home", "Yuyi Capinpin", 6), r("home", "Sophia Townes", 5), r("home", "Sabel Anacan", 4), r("home", "Laela Mateo", 4), r("home", "Ari Hew", 4, true), r("home", "Zia Kallos", 2),
      r("away", "Matia Molina", 11, true), r("away", "Tyler Templo", 9, true), r("away", "Kairi Ebao", 4, true), r("away", "Cheska Gozum", 3, true), r("away", "Alessia Palmieri", 2), r("away", "Louise Doque", 2), r("away", "Zoe Ablang", 1, true), r("away", "Klo Dalanon", 0), r("away", "Sara Madamba", 0), r("away", "Chloe Mariano", 0), r("away", "Jam Vejerano", 0), r("away", "Celest Trillo", 0)
    ]
  },
  {
    division: "girls", gameNumber: "4", date: "2026-01-22", homeTeam: "NU Girls (NU)", awayTeam: "LA SALLE Girls (LA SALLE)",
    rows: [
      r("home", "Adin Rosano", 18, true), r("home", "Aubrey Lapasaran", 17), r("home", "Zane Singson", 11, true), r("home", "Ruiza Olmos", 11), r("home", "Angelika Agad", 9), r("home", "Inday Sales", 9, true), r("home", "Bri Katigbak", 6, true), r("home", "KJ Badajos", 6, true), r("home", "Zia Onate", 5), r("home", "Rhys Luzana", 2), r("home", "Audrey Biongocg", 1), r("home", "Hasly Mallari", 0), r("home", "Trishma Arciaga", 0), r("home", "Queennie Cordero", 0),
      r("away", "Ima Navarro", 7, true), r("away", "Ching Ching Gales", 7, true), r("away", "Apyang Dulay", 6), r("away", "Fia Martinez", 6, true), r("away", "Ice Gerona", 5, true), r("away", "Stef Contreras", 4), r("away", "Bing Padigos", 4), r("away", "Hazell Winar", 3, true), r("away", "Keisha Ogario", 3), r("away", "Sophie Sanares", 0)
    ]
  },
  {
    division: "boys", gameNumber: "13", date: "2026-01-22", homeTeam: "LA SALLE Jrs (LA SALLE)", awayTeam: "UST Jrs (UST)",
    rows: [
      r("home", "Maco Dabao", 18, true), r("home", "Ken Atienza", 11, true), r("home", "Yusuf Mikailu", 10, true), r("home", "Kio Favis", 9), r("home", "Mark Borrero", 9, true), r("home", "Champ Arejola", 7, true), r("home", "Ram Luna", 4), r("home", "Duncan Tan", 2), r("home", "Jake Alpapara", 2), r("home", "Deron Llamas", 0), r("home", "Javi Dimayuga", 0),
      r("away", "Joaqi Ludovice", 25, true), r("away", "Ola Ajani", 10, true), r("away", "Kirk Canete", 8, true), r("away", "Jetlee Melano", 8, true), r("away", "Carhles Esteban", 5), r("away", "Dan Sta. Maria", 4), r("away", "Dust Bathan", 2), r("away", "LJ Lapastora", 2), r("away", "Simon Pulongbarit", 2, true), r("away", "JC Canapi", 1), r("away", "Third Candare", 0), r("away", "Carsson Vidanes", 0), r("away", "Kyle Bandigan", 0)
    ]
  },
  {
    division: "boys", gameNumber: "14", date: "2026-01-22", homeTeam: "ATENEO JRS (ATENEO)", awayTeam: "NU Jrs (NU)",
    rows: [
      r("home", "Jude Eriobu", 21, true), r("home", "Noah Banal", 15, true), r("home", "Jay M Leal", 15, true), r("home", "Renzo Gatmaitan", 11), r("home", "Unri Madrangca", 9, true), r("home", "EK Kaw", 4), r("home", "YJ Lacsamana", 4), r("home", "Zane Kallos", 2, true), r("home", "Ziv Espinas", 2), r("home", "Sky Jazul", 2), r("home", "JD Juangco", 1), r("home", "Aiori Aquino", 0),
      r("away", "Shaun Lucido", 18, true), r("away", "Chad Cartel", 13, true), r("away", "Moussa Diakite", 10, true), r("away", "Mot Matias", 5, true), r("away", "Corian Cabantog", 5, true), r("away", "Sofiane Bouzina", 5), r("away", "Chester Tulabut", 3), r("away", "Ronnie Juan", 2), r("away", "Kurl Figueroa", 2), r("away", "Rhon-J Matias", 0), r("away", "Rob Celiz", 0), r("away", "Miekho Natinga", 0), r("away", "Allan Timbang", 0)
    ]
  },
  {
    division: "boys", gameNumber: "15", date: "2026-01-22", homeTeam: "UPIS Jrs (UP)", awayTeam: "FEU Jrs (FEU)",
    rows: [
      r("home", "Bruce Tubongbanua", 25, true), r("home", "Jhustin Hallare", 22, true), r("home", "Zandro Lugatiman", 13, true), r("home", "Kean Poquiz", 12, true), r("home", "Matt Rosete", 3, true), r("home", "Raiven Pascual", 0), r("home", "Peter Hernandez", 0), r("home", "Dominic Labao", 0), r("home", "John Addatu", 0), r("home", "MJ Rosete", 0), r("home", "Yojan Manguerra", 0), r("home", "Daniel Cobico", 0),
      r("away", "Marc B. Burgos", 16), r("away", "Prince Carino", 13), r("away", "Pat Sohm", 10), r("away", "Cabs Cabonilas", 8, true), r("away", "Sam Hall", 7), r("away", "Jheremy Godoy", 6), r("away", "Duke Santos", 6), r("away", "Assan Gaye", 6, true), r("away", "Den den Enriquez", 5), r("away", "Khean Esperanza", 4, true), r("away", "Mark jade Dulin", 4), r("away", "Jastien Dagcutan", 4, true), r("away", "John dexter Santos", 2), r("away", "Adi Alagaban", 2), r("away", "Yosef Raneses", 0, true)
    ]
  },
  {
    division: "boys", gameNumber: "16", date: "2026-01-22", homeTeam: "UE Jrs (UE)", awayTeam: "ADU Jrs (ADU)",
    rows: [
      r("home", "Ethan Aguas", 13), r("home", "Jamal Diaz", 12, true), r("home", "Jolo Pascual", 10), r("home", "Eoin Braga", 6), r("home", "Kyle Timbol", 5, true), r("home", "Drei Lorenzo", 4), r("home", "JM Edoukou", 4, true), r("home", "Gab Delos Reyes", 4, true), r("home", "Brian Orca", 3), r("home", "Mhico Abellar", 3), r("home", "Sizco Roquid", 2, true), r("home", "Louie Bual", 1),
      r("away", "Jarl Artango", 14, true), r("away", "Mac Jenodia", 12, true), r("away", "Bill Garcia", 12, true), r("away", "Keefe Iledan", 10, true), r("away", "Chrys Gomez", 9, true), r("away", "Renzy Saygo", 5), r("away", "Noah Bautista", 4), r("away", "Francel Flores", 2), r("away", "Kevin Frogoso", 0), r("away", "Craig Fongtong", 0), r("away", "Nazi Babad", 0)
    ]
  },
  {
    division: "boys", gameNumber: "17", date: "2026-01-25", homeTeam: "UPIS Jrs (UP)", awayTeam: "NU Jrs (NU)",
    rows: [
      r("home", "Jhustin Hallare", 17, true), r("home", "Kean Poquiz", 7, true), r("home", "John Addatu", 5), r("home", "Bruce Tubongbanua", 4, true), r("home", "Raiven Pascual", 3), r("home", "Daniel Cobico", 3), r("home", "Zandro Lugatiman", 2, true), r("home", "Matt Rosete", 0, true), r("home", "Yojan Manguerra", 0), r("home", "Dominic Labao", 0), r("home", "MJ Rosete", 0), r("home", "Tapel Ryan", 0), r("home", "Peter Hernandez", 0), r("home", "Terren Villanueva", 0),
      r("away", "Miekho Natinga", 44), r("away", "Shaun Lucido", 21, true), r("away", "Moussa Diakite", 16, true), r("away", "Lebron Manding", 6), r("away", "Rhon-J Matias", 6), r("away", "Chad Cartel", 5, true), r("away", "Mot Matias", 4, true), r("away", "Kurl Figueroa", 4), r("away", "Sofiane Bouzina", 4), r("away", "Denyer Sison", 4), r("away", "Chester Tulabut", 4), r("away", "Sal Mann", 2), r("away", "Corian Cabantog", 2, true), r("away", "Rob Celiz", 2), r("away", "Ronnie Juan", 0), r("away", "Allan Timbang", 0)
    ]
  },
  {
    division: "boys", gameNumber: "18", date: "2026-01-25", homeTeam: "LA SALLE Jrs (LA SALLE)", awayTeam: "ADU Jrs (ADU)",
    rows: [
      r("home", "Maco Dabao", 17, true), r("home", "Yusuf Mikailu", 14, true), r("home", "Mark Borrero", 8, true), r("home", "Ken Atienza", 6, true), r("home", "Javi Dimayuga", 6), r("home", "Nino Ferrer", 5), r("home", "Jake Alpapara", 5), r("home", "Champ Arejola", 4, true), r("home", "Sherwin Reyes", 3), r("home", "Kio Favis", 2), r("home", "Duncan Tan", 1), r("home", "Ram Luna", 0), r("home", "Deron Llamas", 0), r("home", "Mikel Trillo", 0),
      r("away", "Francel Flores", 15), r("away", "Jarl Artango", 9, true), r("away", "Noah Bautista", 7), r("away", "Keefe Iledan", 4, true), r("away", "Chrys Gomez", 3, true), r("away", "Kevin Frogoso", 3), r("away", "Renzy Saygo", 2), r("away", "Bill Garcia", 2, true), r("away", "Mac Jenodia", 0, true), r("away", "Craig Fongtong", 0), r("away", "Zyron Gonzales", 0)
    ]
  },
  {
    division: "boys", gameNumber: "19", date: "2026-01-25", homeTeam: "UE Jrs (UE)", awayTeam: "FEU Jrs (FEU)",
    rows: [
      r("home", "Mhico Abellar", 12, true), r("home", "Gab Delos Reyes", 11), r("home", "Louie Bual", 9, true), r("home", "Jolo Pascual", 8, true), r("home", "Ethan Aguas", 7, true), r("home", "Drei Lorenzo", 5), r("home", "JM Edoukou", 5), r("home", "Ethan Oraa", 5), r("home", "Eoin Braga", 4, true), r("home", "Jamal Diaz", 3), r("home", "Sizco Roquid", 2), r("home", "Kyle Timbol", 2), r("home", "Brian Orca", 0), r("home", "Kiefer Panganiban", 0), r("home", "Bench Copada", 0),
      r("away", "Cabs Cabonilas", 22, true), r("away", "Marc B. Burgos", 12, true), r("away", "Khean Esperanza", 8, true), r("away", "Assan Gaye", 8), r("away", "Pat Sohm", 8), r("away", "Adi Alagaban", 8), r("away", "Den den Enriquez", 8), r("away", "Jb Cagurungan", 7, true), r("away", "Jastien Dagcutan", 5), r("away", "Sam Hall", 4), r("away", "Prince Carino", 4), r("away", "Yosef Raneses", 2, true), r("away", "John dexter Santos", 0), r("away", "Mark jade Dulin", 0), r("away", "Duke Santos", 0)
    ]
  },
  {
    division: "boys", gameNumber: "20", date: "2026-01-25", homeTeam: "ATENEO JRS (ATENEO)", awayTeam: "UST Jrs (UST)",
    rows: [
      r("home", "Jude Eriobu", 28, true), r("home", "Noah Banal", 25, true), r("home", "Jay M Leal", 17, true), r("home", "Unri Madrangca", 9, true), r("home", "Ziv Espinas", 9), r("home", "EK Kaw", 6), r("home", "Zane Kallos", 2, true), r("home", "Renzo Gatmaitan", 2), r("home", "YJ Lacsamana", 2),
      r("away", "JC Canapi", 24), r("away", "Joaqi Ludovice", 15, true), r("away", "Carhles Esteban", 13, true), r("away", "Kirk Canete", 12, true), r("away", "Jetlee Melano", 11, true), r("away", "LJ Lapastora", 5), r("away", "Ola Ajani", 4, true), r("away", "Dust Bathan", 2), r("away", "Simon Pulongbarit", 2), r("away", "Carsson Vidanes", 0), r("away", "Dan Sta. Maria", 0), r("away", "Third Candare", 0)
    ]
  },
  {
    division: "girls", gameNumber: "5", date: "2026-01-25", homeTeam: "LA SALLE Girls (LA SALLE)", awayTeam: "ATENEO Girls (ATENEO)",
    rows: [
      r("home", "Apyang Dulay", 18, true), r("home", "Fia Martinez", 15, true), r("home", "Bing Padigos", 14, true), r("home", "Ima Navarro", 13, true), r("home", "Ching Ching Gales", 10, true), r("home", "Ice Gerona", 9), r("home", "Hazell Winar", 8), r("home", "Sophie Sanares", 6), r("home", "Stef Contreras", 4), r("home", "Keisha Ogario", 2), r("home", "Fritz Cuaresma", 2), r("home", "CJ Luz Roque", 0),
      r("away", "Tyler Templo", 14, true), r("away", "Zoe Ablang", 4, true), r("away", "Louise Doque", 2), r("away", "Cheska Gozum", 1, true), r("away", "Matia Molina", 0, true), r("away", "Alessia Palmieri", 0), r("away", "Kairi Ebao", 0, true), r("away", "Klo Dalanon", 0), r("away", "Chloe Mariano", 0), r("away", "Jam Vejerano", 0), r("away", "Sara Madamba", 0), r("away", "Celest Trillo", 0)
    ]
  },
  {
    division: "boys", gameNumber: "21", date: "2026-01-29", homeTeam: "FEU Jrs (FEU)", awayTeam: "LA SALLE Jrs (LA SALLE)",
    rows: [
      r("home", "Cabs Cabonilas", 21, true), r("home", "Marc B. Burgos", 11), r("home", "Jb Cagurungan", 11, true), r("home", "Khean Esperanza", 10, true), r("home", "Pat Sohm", 6), r("home", "Yosef Raneses", 4, true), r("home", "Sam Hall", 4), r("home", "Prince Carino", 4), r("home", "Assan Gaye", 4, true), r("home", "Adi Alagaban", 2), r("home", "Duke Santos", 2), r("home", "John dexter Santos", 0), r("home", "Den den Enriquez", 0), r("home", "Jastien Dagcutan", 0),
      r("away", "Maco Dabao", 16, true), r("away", "Yusuf Mikailu", 11, true), r("away", "Kio Favis", 7), r("away", "Champ Arejola", 5, true), r("away", "Mark Borrero", 5, true), r("away", "Nino Ferrer", 5), r("away", "Ken Atienza", 4, true), r("away", "Deron Llamas", 4), r("away", "Ram Luna", 3), r("away", "Jake Alpapara", 1), r("away", "John Alpapara", 0), r("away", "Sherwin Reyes", 0), r("away", "Duncan Tan", 0), r("away", "Javi Dimayuga", 0)
    ]
  },
  {
    division: "boys", gameNumber: "22", date: "2026-01-29", homeTeam: "ADU Jrs (ADU)", awayTeam: "ATENEO JRS (ATENEO)",
    rows: [
      r("home", "Jarl Artango", 24, true), r("home", "Chrys Gomez", 13, true), r("home", "Noah Bautista", 10), r("home", "Mac Jenodia", 8, true), r("home", "Francel Flores", 8), r("home", "Kevin Frogoso", 6), r("home", "Keefe Iledan", 4, true), r("home", "Nazi Babad", 3), r("home", "Bill Garcia", 1, true),
      r("away", "Jude Eriobu", 27, true), r("away", "Noah Banal", 11, true), r("away", "Ziv Espinas", 11), r("away", "Jay M Leal", 9), r("away", "Unri Madrangca", 5, true), r("away", "Renzo Gatmaitan", 4), r("away", "EK Kaw", 4), r("away", "Zane Kallos", 2, true), r("away", "YJ Lacsamana", 0), r("away", "ER Reyes", 0), r("away", "Sky Jazul", 0)
    ]
  },
  {
    division: "boys", gameNumber: "23", date: "2026-01-29", homeTeam: "NU Jrs (NU)", awayTeam: "UE Jrs (UE)",
    rows: [
      r("home", "Chad Cartel", 17, true), r("home", "Moussa Diakite", 12, true), r("home", "Corian Cabantog", 10, true), r("home", "Shaun Lucido", 9, true), r("home", "Kurl Figueroa", 9), r("home", "Miekho Natinga", 8), r("home", "Mot Matias", 7, true), r("home", "Rhon-J Matias", 6), r("home", "Ronnie Juan", 4), r("home", "Sofiane Bouzina", 2),
      r("away", "Ethan Aguas", 25, true), r("away", "Jamal Diaz", 9), r("away", "Drei Lorenzo", 9, true), r("away", "Sizco Roquid", 8, true), r("away", "Jolo Pascual", 5), r("away", "JM Edoukou", 5), r("away", "Kyle Timbol", 5), r("away", "Louie Bual", 4, true), r("away", "Eoin Braga", 3), r("away", "Ethan Oraa", 3), r("away", "Gab Delos Reyes", 2), r("away", "Mhico Abellar", 0), r("away", "Brian Orca", 0)
    ]
  },
  {
    division: "boys", gameNumber: "24", date: "2026-01-29", homeTeam: "UST Jrs (UST)", awayTeam: "UPIS Jrs (UP)",
    rows: [
      r("home", "Jetlee Melano", 25, true), r("home", "Kirk Canete", 17, true), r("home", "Ola Ajani", 14, true), r("home", "Joaqi Ludovice", 11, true), r("home", "Liam Acido", 11), r("home", "JC Canapi", 6), r("home", "Dust Bathan", 6), r("home", "Tomas Cruz", 5), r("home", "Carhles Esteban", 4, true), r("home", "Dan Sta. Maria", 3), r("home", "Carsson Vidanes", 3), r("home", "LJ Lapastora", 3), r("home", "Kyle Bandigan", 2), r("home", "Simon Pulongbarit", 2), r("home", "Third Candare", 0), r("home", "Sean Bohol", 0),
      r("away", "Jhustin Hallare", 18, true), r("away", "Bruce Tubongbanua", 11, true), r("away", "John Addatu", 7), r("away", "Zandro Lugatiman", 6, true), r("away", "Matt Rosete", 5, true), r("away", "Kean Poquiz", 4, true), r("away", "Raiven Pascual", 3), r("away", "Peter Hernandez", 3), r("away", "Dominic Labao", 0), r("away", "Yojan Manguerra", 0), r("away", "Daniel Cobico", 0)
    ]
  },
  {
    division: "boys", gameNumber: "25", date: "2026-02-01", homeTeam: "ATENEO JRS (ATENEO)", awayTeam: "UPIS Jrs (UP)",
    rows: [
      r("home", "Jude Eriobu", 31, true), r("home", "EK Kaw", 13), r("home", "Jay M Leal", 11, true), r("home", "Noah Banal", 10, true), r("home", "Unri Madrangca", 8, true), r("home", "Audwyn Tamayo", 7), r("home", "Renzo Gatmaitan", 5), r("home", "Zane Kallos", 3, true), r("home", "ER Reyes", 3), r("home", "Sky Jazul", 2), r("home", "Ziv Espinas", 1), r("home", "JD Juangco", 1), r("home", "Jared Magpoc", 1), r("home", "YJ Lacsamana", 0), r("home", "Aiori Aquino", 0),
      r("away", "Bruce Tubongbanua", 25, true), r("away", "Zandro Lugatiman", 22, true), r("away", "Jhustin Hallare", 9, true), r("away", "Kean Poquiz", 5, true), r("away", "Dominic Labao", 4), r("away", "John Addatu", 3), r("away", "Matt Rosete", 2, true), r("away", "Peter Hernandez", 0), r("away", "Yojan Manguerra", 0), r("away", "MJ Rosete", 0), r("away", "Daniel Cobico", 0), r("away", "Tapel Ryan", 0)
    ]
  },
  {
    division: "boys", gameNumber: "26", date: "2026-02-01", homeTeam: "FEU Jrs (FEU)", awayTeam: "ADU Jrs (ADU)",
    rows: [
      r("home", "Khean Esperanza", 19, true), r("home", "Marc B. Burgos", 19, true), r("home", "Adi Alagaban", 15), r("home", "Cabs Cabonilas", 13, true), r("home", "Sam Hall", 5), r("home", "John dexter Santos", 4), r("home", "Jb Cagurungan", 3, true), r("home", "Pat Sohm", 2), r("home", "Assan Gaye", 2), r("home", "Yosef Raneses", 1, true), r("home", "Jastien Dagcutan", 0), r("home", "Den den Enriquez", 0), r("home", "Mark jade Dulin", 0),
      r("away", "Mac Jenodia", 16, true), r("away", "Keefe Iledan", 16, true), r("away", "Jarl Artango", 13, true), r("away", "Bill Garcia", 9, true), r("away", "Francel Flores", 7), r("away", "Chrys Gomez", 7, true), r("away", "Kevin Frogoso", 5), r("away", "Renzy Saygo", 2), r("away", "Noah Bautista", 1), r("away", "Nazi Babad", 0)
    ]
  },
  {
    division: "boys", gameNumber: "27", date: "2026-02-01", homeTeam: "UE Jrs (UE)", awayTeam: "LA SALLE Jrs (LA SALLE)",
    rows: [
      r("home", "Sizco Roquid", 17), r("home", "Ethan Aguas", 16, true), r("home", "Jolo Pascual", 13), r("home", "Drei Lorenzo", 8), r("home", "Louie Bual", 4, true), r("home", "JM Edoukou", 3), r("home", "Brian Orca", 2), r("home", "Jamal Diaz", 1, true), r("home", "Gab Delos Reyes", 0), r("home", "Mhico Abellar", 0), r("home", "Kyle Timbol", 0, true), r("home", "Eoin Braga", 0, true), r("home", "Ethan Oraa", 0),
      r("away", "Kio Favis", 14), r("away", "Nino Ferrer", 13, true), r("away", "Yusuf Mikailu", 11, true), r("away", "Maco Dabao", 9, true), r("away", "Champ Arejola", 6), r("away", "Jake Alpapara", 3), r("away", "Mark Borrero", 2, true), r("away", "Ken Atienza", 2), r("away", "Deron Llamas", 0), r("away", "Ram Luna", 0)
    ]
  }
];

async function upsertRows(gameRows: GameRows) {
  const start = new Date(`${gameRows.date}T00:00:00.000Z`);
  const end = new Date(`${gameRows.date}T23:59:59.999Z`);
  const gender = gameRows.division === "girls" ? PlayerGender.GIRLS : PlayerGender.BOYS;
  const game = await prisma.game.findFirst({
    where: {
      gameNumber: gameRows.gameNumber,
      gameDate: { gte: start, lte: end },
      homeTeam: { name: gameRows.homeTeam },
      awayTeam: { name: gameRows.awayTeam }
    },
    include: { homeTeam: true, awayTeam: true, season: true }
  });

  if (!game) throw new Error(`Missing game ${gameRows.gameNumber} ${gameRows.date}`);

  let inserted = 0;
  let skipped = 0;
  for (const row of gameRows.rows) {
    const names = splitName(row.name);
    const team = row.team === "home" ? game.homeTeam : game.awayTeam;
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

    if (player.gender !== gender) {
      await prisma.player.update({ where: { id: player.id }, data: { gender } });
    }

    await prisma.playerTeamSeason.upsert({
      where: { playerId_seasonId: { playerId: player.id, seasonId: game.seasonId } },
      update: {},
      create: { playerId: player.id, teamId: team.id, seasonId: game.seasonId }
    });

    const existing = await prisma.gameStat.findUnique({
      where: { gameId_playerId: { gameId: game.id, playerId: player.id } }
    });

    if (existing) {
      await prisma.gameStat.update({
        where: { id: existing.id },
        data: { points: row.pts, teamId: team.id, starter: row.starter ?? existing.starter }
      });
      skipped++;
      continue;
    }

    await prisma.gameStat.create({
      data: {
        gameId: game.id,
        playerId: player.id,
        teamId: team.id,
        starter: Boolean(row.starter),
        points: row.pts,
        rebounds: 0,
        assists: 0
      }
    });
    inserted++;
  }

  const count = await prisma.gameStat.count({ where: { gameId: game.id } });
  const expectedTotal = game.homeScore + game.awayScore;
  const actualTotal = await prisma.gameStat.aggregate({ where: { gameId: game.id }, _sum: { points: true } });
  const pointTotal = actualTotal._sum.points ?? 0;

  if (count >= 8 && pointTotal === expectedTotal) {
    await prisma.game.update({
      where: { id: game.id },
      data: { verificationStatus: VerificationStatus.VERIFIED }
    });
  }

  return { label: `${gameRows.division} game ${gameRows.gameNumber}`, inserted, updated: skipped, count, pointTotal, expectedTotal };
}

async function main() {
  const results = [];
  for (const gameRows of games) {
    results.push(await upsertRows(gameRows));
  }

  const jude = await prisma.player.findFirst({
    where: { displayName: { equals: "Jude Eriobu", mode: "insensitive" } },
    include: { gameStats: { where: { game: { verificationStatus: VerificationStatus.VERIFIED } } } }
  });

  console.log(JSON.stringify({ games: results, judeVerifiedGames: jude?.gameStats.length ?? 0 }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
