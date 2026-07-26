export function getLeagueFamilyName(name: string, organizerName?: string | null) {
  const value = name.trim();
  if (/philippine youth basketball championship|\bpybc\b/i.test(value)) {
    return "Philippine Youth Basketball Championship";
  }
  if (/\bjunior mpbl\b/i.test(value)) return "Junior MPBL";
  if (/\bstallion cup\b/i.test(value)) return "Stallion Cup";
  if (/\buaap\b/i.test(value)) return "UAAP";
  if (/\bncaa\b/i.test(value)) return "NCAA Philippines";

  const organizer = organizerName?.trim();
  if (organizer && organizer.length > 2 && !/^\d+(?:st|nd|rd|th)?$/i.test(organizer)) {
    return organizer;
  }

  return value
    .replace(/\bseason\s+\d+\b/gi, "")
    .replace(/\b(?:U\s*)?1[3-9]\s*U?\b/gi, "")
    .replace(/\b(?:boys|girls|basketball|juniors?|teens?)\b/gi, "")
    .replace(/[\u2013\u2014-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || value;
}

export function getCompetitionBracketLabel(name: string, ageGroup: string) {
  const normalized = name.toUpperCase();
  const ageMatch = normalized.match(/\bU\s*(1[3-9])\b/) ?? normalized.match(/\b(1[3-9])\s*U\b/);
  const age = ageMatch ? "U" + ageMatch[1] : ageGroup.toUpperCase();
  const gender = /\bGIRLS?\b|\bLADY\b|\bTIGRESS/i.test(name)
    ? "Girls"
    : /\bBOYS?\b|\bHS\b|\bJUNIOR/i.test(name)
      ? "Boys"
      : "";
  return [age, gender].filter(Boolean).join(" ");
}

export function rankingAgeGroupForBracket(bracketLabel: string) {
  const match = bracketLabel.toUpperCase().match(/1[3-9]/);
  const age = match ? Number(match[0]) : null;
  if (age !== null && age <= 13) return "U13" as const;
  if (age !== null && age <= 16) return "U16" as const;
  return "U19" as const;
}
