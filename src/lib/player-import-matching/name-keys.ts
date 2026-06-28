import { normalizeImportedPlayerNameKey } from "@/lib/player-import-identity";

const SUFFIX_PATTERN = /\s+((?:jr|sr)\.?|ii|iii|iv)$/i;

export function foldDiacritics(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ñ/gi, "n");
}

export function stripNameSuffix(value: string) {
  let result = value.trim();
  let previous = "";
  while (result !== previous) {
    previous = result;
    result = result.replace(SUFFIX_PATTERN, "").trim();
  }
  return result;
}

export function normalizeNameForKeys(value: string) {
  return stripNameSuffix(foldDiacritics(value));
}

export function generatePlayerMatchKeys(cleanedName: string): string[] {
  const normalized = normalizeNameForKeys(cleanedName);
  const keys = new Set<string>();
  const primary = normalizeImportedPlayerNameKey(normalized);
  if (primary) keys.add(primary);

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    const first = tokens[0].replace(/\.$/, "");
    const last = tokens[tokens.length - 1];
    keys.add(normalizeImportedPlayerNameKey(`${first} ${last}`));
    const initial = first.charAt(0);
    if (initial) {
      keys.add(normalizeImportedPlayerNameKey(`${initial} ${last}`));
      keys.add(normalizeImportedPlayerNameKey(`${initial}. ${last}`));
    }
  }

  return Array.from(keys);
}

export function sharedMatchKey(left: string, right: string) {
  const leftKeys = new Set(generatePlayerMatchKeys(left));
  for (const key of generatePlayerMatchKeys(right)) {
    if (leftKeys.has(key)) return key;
  }
  return null;
}

export function isFirstLastOnlyMatch(importedName: string, candidateName: string) {
  const importedKeys = new Set(generatePlayerMatchKeys(importedName));
  const normalized = normalizeNameForKeys(candidateName);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return false;
  const firstLastKey = normalizeImportedPlayerNameKey(`${tokens[0].replace(/\.$/, "")} ${tokens[tokens.length - 1]}`);
  return importedKeys.has(firstLastKey);
}

export function isInitialLastMatch(importedName: string, candidateName: string) {
  const importedKeys = new Set(generatePlayerMatchKeys(importedName));
  const normalized = normalizeNameForKeys(candidateName);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return false;
  const last = tokens[tokens.length - 1];
  const initial = tokens[0].replace(/\.$/, "").charAt(0);
  if (!initial) return false;
  return (
    importedKeys.has(normalizeImportedPlayerNameKey(`${initial} ${last}`)) ||
    importedKeys.has(normalizeImportedPlayerNameKey(`${initial}. ${last}`))
  );
}
