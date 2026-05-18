const schoolNames: Record<string, string> = {
  ADMU: "Ateneo de Manila University",
  ATENEO: "Ateneo de Manila University",
  "ATENEO JRS": "Ateneo de Manila University",
  DLSZ: "De La Salle Santiago Zobel",
  DLSU: "De La Salle Santiago Zobel",
  "LA SALLE": "De La Salle Santiago Zobel",
  "DE LA SALLE JRS": "De La Salle Santiago Zobel",
  UE: "University of the East",
  "UE JRS": "University of the East",
  NU: "National University Nazareth School",
  NUNS: "National University Nazareth School",
  "NU JRS": "National University Nazareth School",
  UST: "University of Santo Tomas",
  "UST JRS": "University of Santo Tomas",
  UP: "University of the Philippines Integrated School",
  UPIS: "University of the Philippines Integrated School",
  "UPIS JRS": "University of the Philippines Integrated School",
  ADU: "Adamson University",
  "ADU JRS": "Adamson University",
  FEU: "Far Eastern University",
  "FEU JRS": "Far Eastern University"
};

export const approvedUaapSchoolNames = Array.from(new Set(Object.values(schoolNames))).sort();

export function normalizeSchoolAlias(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ").toUpperCase();
  const parentheticalAlias = normalized.match(/\(([^)]+)\)$/)?.[1];
  return parentheticalAlias ? parentheticalAlias.trim() : normalized;
}

export function getUaapSchoolDisplayName(value: string | null | undefined): string {
  if (!value) return "Team not listed";
  const key = normalizeSchoolAlias(value);
  return schoolNames[key] ?? value;
}

export function isApprovedUaapSchool(value: string | null | undefined): boolean {
  return approvedUaapSchoolNames.includes(getUaapSchoolDisplayName(value));
}

