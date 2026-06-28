export type CompetitionGender = "BOYS" | "GIRLS";

function compactName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizedName(value: string) {
  return compactName(value).toUpperCase();
}

export function isPybcCompetitionName(value: string | null | undefined) {
  const normalized = normalizedName(value ?? "");
  return /\bPYBC\b/.test(normalized)
    || /PHILIPPINE\s+YOUTH\s+BASKETBALL\s+CHAMPIONSHIP/.test(normalized);
}

export function normalizeCompetitionDisplayName(value: string | null | undefined) {
  const cleaned = compactName(value ?? "");
  if (isPybcCompetitionName(cleaned) && /\b(?:15U|U15|U16|16U)\b/.test(normalizedName(cleaned))) return "PYBC 15U";
  return cleaned;
}

export function inferCompetitionGender(genderValue: string | null | undefined, contextText: string): CompetitionGender {
  const normalizedGender = normalizedName(genderValue ?? "");
  const normalizedContext = normalizedName(contextText);
  if (normalizedGender.includes("GIRL") || normalizedContext.includes("GIRL")) return "GIRLS";
  if (
    normalizedGender.includes("BOY")
    || /\bBOYS\b|\bJUNIORS?\b|JUNIOR'S|\bJRB\b/.test(normalizedContext)
    || isPybcCompetitionName(normalizedContext)
  ) {
    return "BOYS";
  }
  return "BOYS";
}

export function hasExplicitBoysCompetitionContext(value: string | null | undefined) {
  const normalized = value ?? "";
  return /\bboys\b|\bjuniors?\b|junior's|\bjrb\b/i.test(normalized) || isPybcCompetitionName(normalized);
}
