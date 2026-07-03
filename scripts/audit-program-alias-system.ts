/**
 * Read-only audit of program alias rules in uaap-school-display.ts
 * Usage: npx tsx scripts/audit-program-alias-system.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  getProgramDisplayName,
  getProgramAbbreviation,
  normalizeProgramAlias,
  resolveProgramIdentity
} from "../src/lib/uaap-school-display";
import { prisma } from "../src/lib/prisma";

type Priority = "Critical" | "High" | "Medium" | "Low";

// Mirror of programRules from uaap-school-display.ts (keep in sync for audit)
const programRules = [
  { key: "admu", fullName: "Ateneo de Manila University", abbreviation: "ADMU", aliases: ["ADMU", "ATENEO", "ATENEO JRS", "ATENEO BLUE EAGLETS", "ATENEO LADY EAGLETS", "BLUE EAGLETS", "LADY EAGLETS"] },
  { key: "feu", fullName: "Far Eastern University", abbreviation: "FEU", aliases: ["FEU", "FEU JRS", "FEU BABY TAMARAWS", "FAR EASTERN UNIVERSITY"] },
  { key: "feu-d", fullName: "Far Eastern University Diliman", abbreviation: "FEU-D", aliases: ["FEU-D", "FEU DILIMAN", "FEU-DILIMAN", "FAR EASTERN UNIVERSITY DILIMAN"] },
  { key: "dlsz", fullName: "De La Salle Santiago Zobel", abbreviation: "DLSZ", aliases: ["DLSZ", "DE LA SALLE SANTIAGO ZOBEL", "SANTIAGO ZOBEL", "ZOBEL"] },
  { key: "lsgh", fullName: "La Salle Green Hills", abbreviation: "LSGH", aliases: ["LSGH", "LA SALLE GREEN HILLS", "GREEN HILLS"] },
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
  { key: "san-pedro-spartans", fullName: "San Pedro Spartans", abbreviation: "San Pedro Spartans", type: "Club / Team", aliases: ["SPARTANS", "SPARTANS 16U", "SPARTANS 16 U", "SAN PEDRO SPARTANS"] }
] as const;

const reviewSchools = [
  "Ateneo de Manila University",
  "Ateneo de Manila High School",
  "Ateneo Grade School",
  "Ateneo de Naga",
  "De La Salle Santiago Zobel",
  "La Salle Green Hills",
  "De La Salle University",
  "De La Salle Lipa",
  "De La Salle Araneta",
  "College of Saint Benilde",
  "San Beda University",
  "San Beda Alabang",
  "San Beda Rizal",
  "San Beda Alabang Spartans",
  "Xavier School",
  "Xavier School Nuvali",
  "Chiang Kai Shek College",
  "National University",
  "National University Nazareth School",
  "NU Bullpups",
  "Sacred Heart Academy",
  "Sacred Heart School-Ateneo de Cebu",
  "Hope Christian High School",
  "Immaculate Conception Academy",
  "ICA Greenhills",
  "Miriam College",
  "Assumption College San Lorenzo",
  "Assumption Iloilo",
  "FEU Diliman",
  "Far Eastern University",
  "University of the Philippines",
  "UP Integrated School",
  "Blue Eaglelets",
  "Lady Eaglelets",
  "Green Hills",
  "LSGH Greenies",
  "Zobel Junior Archers",
  "Spartans",
  "Spartans 16U",
  "Benilde",
  "Letran",
  "Perpetual Help",
  "Lyceum"
];

function resolve(input: string) {
  const identity = resolveProgramIdentity(input);
  return {
    input,
    normalized: normalizeProgramAlias(input),
    programKey: identity.programKey,
    programFullName: identity.programFullName,
    abbreviation: identity.programAbbreviation,
    viaGetProgramDisplayName: getProgramDisplayName(input)
  };
}

function auditRules() {
  const perRule = programRules.map((rule) => {
    const normalizedAliases = rule.aliases.map((alias) => ({
      alias,
      normalized: normalizeProgramAlias(alias)
    }));

    const shortAliases = normalizedAliases.filter((row) => row.normalized.length < 4);
    const genericAliases = normalizedAliases.filter((row) =>
      ["ATENEO", "BENILDE", "LETRAN", "LYCEUM", "PERPETUAL", "SAN BEDA", "SPARTANS", "ZOBEL", "GREEN HILLS", "BLUE EAGLETS", "LADY EAGLETS", "NU", "UP", "MU", "AU", "UE", "UST", "FEU", "ADU", "EAC", "CSB", "LPU", "SBU", "ADMU", "DLSZ", "LSGH", "NUNS", "UPHSD", "CSJL", "SSCR", "JRU"].includes(row.normalized)
    );

    return {
      key: rule.key,
      fullName: rule.fullName,
      abbreviation: rule.abbreviation,
      aliases: rule.aliases,
      normalizedAliases,
      shortAliases: shortAliases.map((row) => row.alias),
      genericAliases: genericAliases.map((row) => row.alias)
    };
  });

  // Duplicate normalized aliases across rules
  const aliasOwners = new Map<string, string[]>();
  for (const rule of programRules) {
    for (const alias of rule.aliases) {
      const key = normalizeProgramAlias(alias);
      const owners = aliasOwners.get(key) ?? [];
      owners.push(rule.key);
      aliasOwners.set(key, owners);
    }
  }
  const duplicateNormalizedAliases = [...aliasOwners.entries()]
    .filter(([, owners]) => owners.length > 1)
    .map(([normalized, owners]) => ({ normalized, owners }));

  // Duplicate abbreviations
  const abbrevMap = new Map<string, string[]>();
  for (const rule of programRules) {
    const owners = abbrevMap.get(rule.abbreviation) ?? [];
    owners.push(rule.key);
    abbrevMap.set(rule.abbreviation, owners);
  }
  const duplicateAbbreviations = [...abbrevMap.entries()]
    .filter(([, owners]) => owners.length > 1)
    .map(([abbreviation, owners]) => ({ abbreviation, owners }));

  return { perRule, duplicateNormalizedAliases, duplicateAbbreviations };
}

function auditSubstringCollisions() {
  const collisions: Array<{
    probe: string;
    expectedKey: string | null;
    matchedKey: string;
    matchedFullName: string;
    priority: Priority;
    reason: string;
  }> = [];

  for (const probe of reviewSchools) {
    const result = resolve(probe);
    const expected = probe.toLowerCase();
    let expectedKey: string | null = null;
    if (expected.includes("green hills") || expected.includes("lsgh")) expectedKey = "lsgh";
    else if (expected.includes("zobel") || expected.includes("santiago zobel")) expectedKey = "dlsz";
    else if (expected.includes("benilde")) expectedKey = "csb";
    else if (expected.includes("san beda alabang")) expectedKey = "san-beda-alabang-spartans";
    else if (expected.includes("san beda")) expectedKey = "sbu";
    else if (expected.includes("feu diliman") || expected.includes("feu-d")) expectedKey = "feu-d";
    else if (expected.includes("far eastern")) expectedKey = "feu";
    else if (expected.includes("ateneo de manila") || expected.includes("blue eaglet") || expected.includes("lady eaglet")) expectedKey = "admu";
    else if (expected.includes("nazareth") || expected.includes("nuns")) expectedKey = "nuns";
    else if (expected.includes("national university") || expected === "nu bullpups") expectedKey = "nuns";

    if (expectedKey && result.programKey !== expectedKey) {
      collisions.push({
        probe,
        expectedKey,
        matchedKey: result.programKey,
        matchedFullName: result.programFullName,
        priority: ["lsgh", "dlsz", "sbu", "san-beda-alabang-spartans", "feu", "feu-d", "nuns", "admu"].includes(expectedKey) ? "High" : "Medium",
        reason: `Expected ${expectedKey}, got ${result.programKey}`
      });
    }
  }

  // Pairwise alias substring: alias A from rule X contained in probe for school Y
  const crossHits: Array<{ alias: string; aliasRule: string; probe: string; matchedRule: string; matchedFullName: string }> = [];
  for (const rule of programRules) {
    for (const alias of rule.aliases) {
      const normalizedAlias = normalizeProgramAlias(alias);
      if (normalizedAlias.length < 5) continue;
      for (const other of programRules) {
        if (other.key === rule.key) continue;
        for (const probeAlias of other.aliases) {
          const probe = normalizeProgramAlias(probeAlias);
          if (probe.length < 5) continue;
          if (probe.includes(normalizedAlias) && normalizedAlias !== probe) {
            const matched = resolve(probeAlias);
            if (matched.programKey !== rule.key) {
              crossHits.push({
                alias,
                aliasRule: rule.key,
                probe: probeAlias,
                matchedRule: matched.programKey,
                matchedFullName: matched.programFullName
              });
            }
          }
        }
      }
    }
  }

  return { collisions, crossHits };
}

function ambiguousAliasReport() {
  const findings: Array<{
    rule: string;
    alias: string;
    issue: string;
    priority: Priority;
    recommendation: string;
  }> = [];

  const add = (rule: string, alias: string, issue: string, priority: Priority, recommendation: string) => {
    findings.push({ rule, alias, issue, priority, recommendation });
  };

  add("admu", "ATENEO", "Generic — matches any Ateneo-branded school (Cebu, Naga, etc.)", "Critical", "Require ATENEO DE MANILA or drop generic ATENEO; add campus-specific rules if needed");
  add("admu", "BLUE EAGLETS", "Mascot-only — could appear in non-ADMU contexts", "High", "Keep only with ATENEO prefix aliases");
  add("admu", "LADY EAGLETS", "Mascot-only", "High", "Keep only with ATENEO prefix aliases");
  add("nuns", "NU", "Two-letter — matches unrelated NU tokens", "High", "Prefer NUNS; use NU only with NAZARETH or BULLPUPS context");
  add("nuns", "NATIONAL UNIVERSITY", "Collides with collegiate NU vs Nazareth School", "Critical", "Split collegiate NU from NUNS; add separate NU Manila rule if needed");
  add("upis", "UP", "Two-letter — extremely generic", "Critical", "Remove standalone UP; require UPIS or UNIVERSITY OF THE PHILIPPINES INTEGRATED SCHOOL");
  add("upis", "UP FIGHTING MAROONS", "Collegiate UP label on HS program rule", "High", "Move collegiate UP to separate rule or restrict to integrated school variants");
  add("sbu", "SAN BEDA", "Matches San Beda Alabang/Rizal/campus teams", "High", "Add SBU Mendiola-specific aliases; add San Beda Rizal / Alabang campus rules");
  add("san-pedro-spartans", "SPARTANS", "Generic mascot — San Beda Alabang also Spartans", "Critical", "Remove bare SPARTANS; require SAN PEDRO or SAN BEDA ALABANG prefix");
  add("san-beda-alabang-spartans", "(missing)", "Only one alias — bare SPARTANS routes to San Pedro", "High", "Add SAN BEDA ALABANG, SBU ALABANG, BEDAN SPARTANS");
  add("csb", "BENILDE", "Single-token mascot/name shared with CSB only but substring risk low", "Low", "Keep; monitor");
  add("lsgh", "GREEN HILLS", "Geographic name — Green Hills Mall/area", "Medium", "Prefer LA SALLE GREEN HILLS or LSGH as primary");
  add("feu", "FAR EASTERN UNIVERSITY", "Substring of FEU-D full alias", "Medium", "FEU-D longest-match should win for Diliman-specific strings");
  add("sscr", "SAN SEBASTIAN", "Could match San Sebastian parish schools", "Medium", "Prefer full SAN SEBASTIAN COLLEGE-RECOLETOS");
  add("uphsd", "PERPETUAL", "Generic — multiple Perpetual campuses", "High", "Require UPHSD or SYSTEM DALTA in alias");
  add("jru", "JOSE RIZAL", "Person name — not unique to JRU", "Medium", "Prefer JOSE RIZAL UNIVERSITY full string");
  add("mapua", "MU", "Two-letter abbreviation collision risk", "Medium", "Prefer MAPUA token in imports");

  // Missing schools from user list
  const missing = [
    { name: "Xavier School / Xavier Nuvali", priority: "High" as Priority },
    { name: "Chiang Kai Shek College", priority: "High" as Priority },
    { name: "Sacred Heart (multiple campuses)", priority: "Medium" as Priority },
    { name: "Hope Christian High School", priority: "Medium" as Priority },
    { name: "Immaculate Conception Academy (ICA)", priority: "High" as Priority },
    { name: "Miriam College", priority: "High" as Priority },
    { name: "Assumption (San Lorenzo / Iloilo)", priority: "High" as Priority },
    { name: "Ateneo de Cebu / other Ateneo campuses", priority: "High" as Priority },
    { name: "De La Salle Lipa / Araneta / University (collegiate)", priority: "High" as Priority },
    { name: "San Beda Rizal", priority: "Medium" as Priority },
    { name: "National University (collegiate, non-NUNS)", priority: "High" as Priority },
    { name: "DLSU (collegiate Taft)", priority: "Medium" as Priority }
  ];

  return { findings, missing };
}

async function auditDatabaseLabels() {
  const [programs, teams] = await Promise.all([
    prisma.program.findMany({
      where: { deletedAt: null },
      select: { id: true, fullName: true, abbreviation: true, type: true }
    }),
    prisma.team.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, program: { select: { fullName: true, abbreviation: true } } }
    })
  ]);

  const programResolution = programs.map((program) => {
    const resolved = resolve(program.fullName);
    return {
      dbFullName: program.fullName,
      dbAbbreviation: program.abbreviation,
      dbType: program.type,
      resolvedKey: resolved.programKey,
      resolvedDisplay: resolved.programFullName,
      mismatch: resolved.programFullName !== program.fullName
    };
  });

  const teamResolution = teams.map((team) => {
    const fromName = resolve(team.name);
    const fromProgram = team.program ? resolve(team.program.fullName) : null;
    return {
      teamName: team.name,
      dbProgram: team.program?.fullName ?? null,
      resolvedFromTeamName: fromName.programFullName,
      resolvedFromDbProgram: fromProgram?.programFullName ?? null,
      teamNameMismatchDbProgram:
        team.program && fromName.programFullName !== team.program.fullName && fromName.programKey !== fallbackKeyFromName(team.program.fullName)
    };
  });

  return {
    programResolution: programResolution.filter((row) => row.mismatch),
    teamResolution: teamResolution.filter((row) => row.teamNameMismatchDbProgram)
  };
}

function fallbackKeyFromName(fullName: string) {
  return normalizeProgramAlias(fullName).toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

async function main() {
  const ruleAudit = auditRules();
  const substringAudit = auditSubstringCollisions();
  const ambiguous = ambiguousAliasReport();
  const reviewResults = reviewSchools.map((school) => resolve(school));
  const dbAudit = await auditDatabaseLabels();

  const report = {
    generatedAt: new Date().toISOString(),
    ruleCount: programRules.length,
    normalizationBehavior: {
      steps: [
        "trim",
        "strip parentheticals",
        "strip youth age tokens (10U-19U, UNDER N)",
        "strip BOYS/GIRLS/HS/HIGH SCHOOL",
        "normalize JUNIOR variants to JRS",
        "collapse whitespace",
        "uppercase"
      ],
      matchingOrder: ["exact normalized alias map", "substring match with longest alias wins (min length 3)"]
    },
    perRule: ruleAudit.perRule,
    duplicateNormalizedAliases: ruleAudit.duplicateNormalizedAliases,
    duplicateAbbreviations: ruleAudit.duplicateAbbreviations,
    reviewSchoolResults: reviewResults,
    misclassifiedReviewSchools: substringAudit.collisions,
    crossAliasSubstringHits: substringAudit.crossHits,
    ambiguousRules: ambiguous.findings,
    missingMajorSchools: ambiguous.missing,
    dbProgramMismatches: dbAudit.programResolution,
    dbTeamNameMismatches: dbAudit.teamResolution
  };

  const outDir = join(process.cwd(), "scripts", "reports");
  mkdirSync(outDir, { recursive: true });
  const jsonPath = join(outDir, "program-alias-system-audit.json");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");

  console.log(JSON.stringify({ jsonPath, summary: {
    duplicateAliases: ruleAudit.duplicateNormalizedAliases.length,
    misclassifiedProbes: substringAudit.collisions.length,
    crossHits: substringAudit.crossHits.length,
    ambiguousFindings: ambiguous.findings.length,
    missingSchools: ambiguous.missing.length,
    dbProgramMismatches: dbAudit.programResolution.length,
    dbTeamMismatches: dbAudit.teamResolution.length
  }}, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
