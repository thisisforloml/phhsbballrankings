import { normalizeImportedPlayerNameKey } from "@/lib/player-import-identity";

export function normalizeDuplicateName(value: string) {
  return normalizeImportedPlayerNameKey(value);
}

export function normalizeDuplicateLastName(lastName: string) {
  return normalizeDuplicateName(lastName);
}

function tokenSet(value: string) {
  return new Set(
    normalizeDuplicateName(value)
      .split(/\s+/)
      .filter(Boolean),
  );
}

export function tokenOverlapSimilarity(left: string, right: string) {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  return intersection / Math.max(leftTokens.size, rightTokens.size);
}

function levenshteinDistance(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const matrix = Array.from({ length: left.length + 1 }, () => new Array<number>(right.length + 1).fill(0));
  for (let i = 0; i <= left.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[left.length][right.length];
}

export function levenshteinSimilarity(left: string, right: string) {
  const normalizedLeft = normalizeDuplicateName(left);
  const normalizedRight = normalizeDuplicateName(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;
  const distance = levenshteinDistance(normalizedLeft, normalizedRight);
  const maxLength = Math.max(normalizedLeft.length, normalizedRight.length);
  return maxLength === 0 ? 0 : 1 - distance / maxLength;
}

function jaro(left: string, right: string) {
  if (left === right) return 1;
  if (!left.length || !right.length) return 0;

  const matchDistance = Math.max(Math.floor(Math.max(left.length, right.length) / 2) - 1, 0);
  const leftMatches = new Array<boolean>(left.length).fill(false);
  const rightMatches = new Array<boolean>(right.length).fill(false);

  let matches = 0;
  for (let i = 0; i < left.length; i += 1) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, right.length);
    for (let j = start; j < end; j += 1) {
      if (rightMatches[j] || left[i] !== right[j]) continue;
      leftMatches[i] = true;
      rightMatches[j] = true;
      matches += 1;
      break;
    }
  }

  if (!matches) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < left.length; i += 1) {
    if (!leftMatches[i]) continue;
    while (!rightMatches[k]) k += 1;
    if (left[i] !== right[k]) transpositions += 1;
    k += 1;
  }

  return (
    (matches / left.length + matches / right.length + (matches - transpositions / 2) / matches) / 3
  );
}

export function jaroWinklerSimilarity(left: string, right: string, prefixScale = 0.1) {
  const normalizedLeft = normalizeDuplicateName(left);
  const normalizedRight = normalizeDuplicateName(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;

  const jaroScore = jaro(normalizedLeft, normalizedRight);
  let prefix = 0;
  const maxPrefix = 4;
  for (let i = 0; i < Math.min(maxPrefix, normalizedLeft.length, normalizedRight.length); i += 1) {
    if (normalizedLeft[i] !== normalizedRight[i]) break;
    prefix += 1;
  }

  return jaroScore + prefix * prefixScale * (1 - jaroScore);
}

export function displayNameSimilarity(left: string, right: string) {
  return Math.max(
    jaroWinklerSimilarity(left, right),
    levenshteinSimilarity(left, right),
    tokenOverlapSimilarity(left, right),
  );
}

export function fullNameLabel(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}
