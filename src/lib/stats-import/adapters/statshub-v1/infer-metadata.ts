import { inferCompetitionGender, normalizeCompetitionDisplayName } from "@/lib/competition-naming";

export function inferAgeGroupFromText(text: string): string {
  const upper = text.toUpperCase();
  if (/\b(10U|11U|12U|13U|U13|8U)\b/.test(upper)) return "U13";
  if (/\b(14U|15U|16U|U14|U15|U16)\b/.test(upper)) return "U16";
  if (/\b(17U|18U|19U|U17|U18|U19|20U)\b/.test(upper)) return "U19";
  return "U16";
}

export function inferSeasonYear(text: string): number {
  const match = text.match(/\b(20\d{2})\b/);
  if (match) return Number(match[1]);
  return new Date().getFullYear();
}

export function inferSeasonName(text: string, seasonYear: number): string {
  const seasonMatch = text.match(/season\s*(\d+)/i);
  if (seasonMatch) return `Season ${seasonMatch[1]}`;
  return `Season ${seasonYear}`;
}

export function normalizeLeagueName(title: string): string {
  return normalizeCompetitionDisplayName(title) || title.trim();
}

export function inferGender(title: string): "BOYS" | "GIRLS" {
  return inferCompetitionGender(undefined, title);
}
