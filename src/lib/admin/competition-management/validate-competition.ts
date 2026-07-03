import {
  AgeGroup,
  CompetitionSeasonType,
  CompetitionSport,
  CompetitionStatus,
  PlayerGender,
  SeasonStatus,
} from "@prisma/client";

const AGE_GROUPS = new Set<string>([AgeGroup.U13, AgeGroup.U16, AgeGroup.U19]);
const GENDERS = new Set<string>([PlayerGender.BOYS, PlayerGender.GIRLS]);
const SEASON_TYPES = new Set<string>(Object.values(CompetitionSeasonType));
const SPORTS = new Set<string>(Object.values(CompetitionSport));
const COMPETITION_STATUSES = new Set<string>(Object.values(CompetitionStatus));
const SEASON_STATUSES = new Set<string>(Object.values(SeasonStatus));

export function readRequiredString(formData: FormData, key: string, label: string, maxLength: number) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${label} is required.`);
  if (value.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  return value;
}

export function readOptionalString(formData: FormData, key: string, maxLength: number) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) return null;
  if (value.length > maxLength) throw new Error(`Value must be ${maxLength} characters or fewer.`);
  return value;
}

export function readOptionalUrl(formData: FormData, key: string) {
  const value = readOptionalString(formData, key, 500);
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("URL must start with http:// or https://.");
    }
  } catch {
    throw new Error("Website must be a valid URL.");
  }
  return value;
}

export function readEnumValue<T extends string>(formData: FormData, key: string, allowed: Set<string>, label: string) {
  const value = String(formData.get(key) ?? "").trim().toUpperCase();
  if (!allowed.has(value)) throw new Error(`${label} is invalid.`);
  return value as T;
}

export function readOptionalEnumValue<T extends string>(
  formData: FormData,
  key: string,
  allowed: Set<string>,
) {
  const value = String(formData.get(key) ?? "").trim().toUpperCase();
  if (!value) return null;
  if (!allowed.has(value)) throw new Error("Invalid selection.");
  return value as T;
}

export function readAgeGroups(formData: FormData) {
  const values = formData.getAll("defaultAgeGroups").map((value) => String(value).trim().toUpperCase());
  const unique = Array.from(new Set(values.filter(Boolean)));
  for (const value of unique) {
    if (!AGE_GROUPS.has(value)) throw new Error("Default age groups must be U13, U16, or U19.");
  }
  return unique as AgeGroup[];
}

export function readGenders(formData: FormData) {
  const values = formData.getAll("defaultGenders").map((value) => String(value).trim().toUpperCase());
  const unique = Array.from(new Set(values.filter(Boolean)));
  for (const value of unique) {
    if (!GENDERS.has(value)) throw new Error("Default genders must be BOYS or GIRLS.");
  }
  return unique as PlayerGender[];
}

export function readInt(formData: FormData, key: string, label: string, min: number, max: number) {
  const value = Number(String(formData.get(key) ?? "").trim());
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be an integer from ${min} to ${max}.`);
  }
  return value;
}

export function readOptionalInt(formData: FormData, key: string, label: string, min: number, max: number) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  return readInt(formData, key, label, min, max);
}

export function readDate(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${label} is required.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a valid date.`);
  }
  return date;
}

export function readOptionalDate(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime())) {
    throw new Error("End date must be a valid date.");
  }
  return date;
}

export function readCompetitionStatus(formData: FormData) {
  return readEnumValue<CompetitionStatus>(formData, "status", COMPETITION_STATUSES, "Status");
}

export function readSeasonType(formData: FormData) {
  return readOptionalEnumValue<CompetitionSeasonType>(formData, "seasonType", SEASON_TYPES);
}

export function readSport(formData: FormData) {
  return readOptionalEnumValue<CompetitionSport>(formData, "sport", SPORTS) ?? CompetitionSport.BASKETBALL;
}

export function readSeasonStatus(formData: FormData) {
  return readEnumValue<SeasonStatus>(formData, "status", SEASON_STATUSES, "Season status");
}

export function readOptionalAgeGroup(formData: FormData, key: string) {
  return readOptionalEnumValue<AgeGroup>(formData, key, AGE_GROUPS);
}

export function readOptionalGender(formData: FormData, key: string) {
  return readOptionalEnumValue<PlayerGender>(formData, key, GENDERS);
}
