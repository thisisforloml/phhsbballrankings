export type ProgramType = "School" | "Club / Team";

export type ProgramIdentity = {
  programKey: string;
  programFullName: string;
  programAbbreviation: string;
  programType: ProgramType;
  teamDisplayName: string;
  normalizedAlias: string;
};

type ProgramRule = {
  key: string;
  fullName: string;
  abbreviation: string;
  type?: ProgramType;
  aliases: string[];
};

const programRules: ProgramRule[] = [
  { key: "admu", fullName: "Ateneo de Manila University", abbreviation: "ADMU", aliases: ["ADMU", "ATENEO", "ATENEO JRS", "ATENEO BLUE EAGLETS", "ATENEO LADY EAGLETS", "BLUE EAGLETS", "LADY EAGLETS"] },
  { key: "feu", fullName: "Far Eastern University", abbreviation: "FEU", aliases: ["FEU", "FEU JRS", "FEU BABY TAMARAWS", "FAR EASTERN UNIVERSITY"] },
  { key: "feu-d", fullName: "Far Eastern University Diliman", abbreviation: "FEU-D", aliases: ["FEU-D", "FEU DILIMAN", "FEU-DILIMAN", "FAR EASTERN UNIVERSITY DILIMAN"] },
  { key: "dlsz", fullName: "De La Salle Santiago Zobel", abbreviation: "DLSZ", aliases: ["DLSZ", "DLSU", "LA SALLE", "DE LA SALLE", "DE LA SALLE JRS", "DE LA SALLE SANTIAGO ZOBEL", "ZOBEL"] },
  { key: "nuns", fullName: "National University Nazareth School", abbreviation: "NUNS", aliases: ["NU", "NUNS", "NU JRS", "NATIONAL UNIVERSITY", "NATIONAL UNIVERSITY NAZARETH SCHOOL"] },
  { key: "ust", fullName: "University of Santo Tomas", abbreviation: "UST", aliases: ["UST", "UST JRS", "UNIVERSITY OF SANTO TOMAS"] },
  { key: "upis", fullName: "University of the Philippines Integrated School", abbreviation: "UPIS", aliases: ["UP", "UPIS", "UPIS JRS", "UP JUNIOR FIGHTING MAROONS", "UP FIGHTING MAROONS", "UNIVERSITY OF THE PHILIPPINES INTEGRATED SCHOOL"] },
  { key: "ue", fullName: "University of the East", abbreviation: "UE", aliases: ["UE", "UE JRS", "UNIVERSITY OF THE EAST"] },
  { key: "adu", fullName: "Adamson University", abbreviation: "ADU", aliases: ["ADU", "ADU JRS", "ADAMSON", "ADAMSON UNIVERSITY"] },
  { key: "eac", fullName: "Emilio Aguinaldo College", abbreviation: "EAC", aliases: ["EAC", "EMILIO AGUINALDO COLLEGE"] },
  { key: "csb", fullName: "College of Saint Benilde", abbreviation: "CSB", aliases: ["CSB", "BENILDE", "COLLEGE OF SAINT BENILDE", "COLLEGE OF ST BENILDE", "DE LA SALLE-COLLEGE OF SAINT BENILDE"] },
  { key: "lpu", fullName: "Lyceum of the Philippines University", abbreviation: "LPU", aliases: ["LPU", "LYCEUM", "LYCEUM OF THE PHILIPPINES UNIVERSITY"] },
  { key: "uphsd", fullName: "University of Perpetual Help System DALTA", abbreviation: "UPHSD", aliases: ["UPHSD", "PERPETUAL", "UNIVERSITY OF PERPETUAL HELP", "UNIVERSITY OF PERPETUAL HELP SYSTEM DALTA"] },
  { key: "sbu", fullName: "San Beda University", abbreviation: "SBU", aliases: ["SBU", "SAN BEDA", "SAN BEDA UNIVERSITY"] },
  { key: "csjl", fullName: "Colegio de San Juan de Letran", abbreviation: "CSJL", aliases: ["CSJL", "LETRAN", "COLEGIO DE SAN JUAN DE LETRAN"] },
  { key: "sscr", fullName: "San Sebastian College-Recoletos", abbreviation: "SSCR", aliases: ["SSCR", "SSC-R", "SAN SEBASTIAN", "SAN SEBASTIAN COLLEGE", "SAN SEBASTIAN COLLEGE-RECOLETOS"] },
  { key: "au", fullName: "Arellano University", abbreviation: "AU", aliases: ["AU", "ARELLANO", "ARELLANO UNIVERSITY"] },
  { key: "jru", fullName: "Jose Rizal University", abbreviation: "JRU", aliases: ["JRU", "JOSE RIZAL UNIVERSITY", "JOSE RIZAL", "JOSÉ RIZAL UNIVERSITY"] },
  { key: "mapua", fullName: "Mapua University", abbreviation: "MU", aliases: ["MU", "MAPUA", "MAPUA UNIVERSITY", "MAPÚA UNIVERSITY"] },
  { key: "san-beda-alabang-spartans", fullName: "San Beda Alabang Spartans", abbreviation: "San Beda Alabang Spartans", type: "Club / Team", aliases: ["SAN BEDA ALABANG SPARTANS"] },
  { key: "smile-360-bullies", fullName: "SMILE 360 BULLIES", abbreviation: "SMILE 360 BULLIES", type: "Club / Team", aliases: ["SMILE 360 BULLIES", "SMILE 360 BULLIES 16 U", "SMILE 360 BULLIES 16U", "SMILE 360"] },
  { key: "spartans", fullName: "SPARTANS", abbreviation: "SPARTANS", type: "Club / Team", aliases: ["SPARTANS", "SPARTANS 16U", "SPARTANS 16 U"] }
];

const aliasToRule = new Map<string, ProgramRule>();
for (const rule of programRules) {
  for (const alias of rule.aliases) aliasToRule.set(normalizeProgramAlias(alias), rule);
}

export const approvedUaapSchoolNames = Array.from(new Set(programRules.slice(0, 9).map((rule) => rule.fullName))).sort();
export const knownProgramNames = Array.from(new Set(programRules.map((rule) => rule.fullName))).sort();

export function normalizeProgramAlias(value: string): string {
  return value
    .trim()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(?:U|UNDER)[ -]?(?:13|16|19)\b/gi, " ")
    .replace(/\b(?:13U|16U|19U)\b/gi, " ")
    .replace(/\b(?:BOYS|GIRLS|HS|HIGH SCHOOL)\b/gi, " ")
    .replace(/\b(?:JUNIORS|JUNIOR'S|JUNIOR)\b/gi, " JRS ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function normalizeSchoolAlias(value: string): string {
  return normalizeProgramAlias(value);
}

function cleanedTeamDisplayName(value: string | null | undefined): string {
  return (value ?? "Team not listed").trim().replace(/\s+/g, " ");
}

function cleanedProgramFallbackName(value: string): string {
  return value
    .replace(/\b(?:U|UNDER)[ -]?(?:13|16|19)\s*(?:BOYS|GIRLS)?\b/gi, " ")
    .replace(/\b(?:13U|16U|19U)\s*(?:BOYS|GIRLS)?\b/gi, " ")
    .replace(/\b(?:BOYS|GIRLS)\b$/gi, " ")
    .replace(/\s+/g, " ")
    .trim() || value;
}

function fallbackKey(value: string) {
  return normalizeProgramAlias(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "team-not-listed";
}

function findProgramRule(value: string): ProgramRule | null {
  const normalized = normalizeProgramAlias(value);
  const exact = aliasToRule.get(normalized);
  if (exact) return exact;

  const compact = ` ${normalized} `;
  return programRules.find((rule) => rule.aliases.some((alias) => {
    const normalizedAlias = normalizeProgramAlias(alias);
    return normalizedAlias.length >= 3 && compact.includes(` ${normalizedAlias} `);
  })) ?? null;
}

export function resolveProgramIdentity(value: string | null | undefined): ProgramIdentity {
  const teamDisplayName = cleanedTeamDisplayName(value);
  const normalizedAlias = normalizeProgramAlias(teamDisplayName);
  const rule = findProgramRule(teamDisplayName);

  if (rule) {
    return {
      programKey: rule.key,
      programFullName: rule.fullName,
      programAbbreviation: rule.abbreviation,
      programType: rule.type ?? "School",
      teamDisplayName,
      normalizedAlias
    };
  }

  return {
    programKey: fallbackKey(teamDisplayName),
    programFullName: cleanedProgramFallbackName(teamDisplayName),
    programAbbreviation: cleanedProgramFallbackName(teamDisplayName),
    programType: "Club / Team",
    teamDisplayName,
    normalizedAlias
  };
}

export function getProgramDisplayName(value: string | null | undefined): string {
  return resolveProgramIdentity(value).programFullName;
}

export function getProgramAbbreviation(value: string | null | undefined): string {
  return resolveProgramIdentity(value).programAbbreviation;
}

export function getTeamDisplayName(value: string | null | undefined): string {
  return resolveProgramIdentity(value).teamDisplayName;
}

export function getUaapSchoolDisplayName(value: string | null | undefined): string {
  return getProgramDisplayName(value);
}

export function isApprovedUaapSchool(value: string | null | undefined): boolean {
  return approvedUaapSchoolNames.includes(getUaapSchoolDisplayName(value));
}

export function getInternalTeamName(submittedTeamName: string | null | undefined, ageGroup: string | null | undefined, gender: string | null | undefined): string {
  const identity = resolveProgramIdentity(submittedTeamName);
  const normalizedAgeGroup = ageGroup?.trim().toUpperCase() || "AgeGroup";
  const normalizedGender = gender === "GIRLS" ? "Girls" : gender === "BOYS" ? "Boys" : "Team";
  return `${identity.programAbbreviation} ${normalizedAgeGroup} ${normalizedGender}`;
}

export function getUaapInternalTeamName(submittedTeamName: string | null | undefined, ageGroup: string | null | undefined, gender: string | null | undefined): string {
  return getInternalTeamName(submittedTeamName, ageGroup, gender);
}
