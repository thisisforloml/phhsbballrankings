export function normalizeIdentityTokens(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function firstLastIdentityKey(value: string) {
  const tokens = normalizeIdentityTokens(value);
  if (tokens.length < 2) return null;
  return `${tokens[0]}|${tokens[tokens.length - 1]}`;
}

export function isMiddleNameVariant(left: string, right: string) {
  const leftTokens = normalizeIdentityTokens(left);
  const rightTokens = normalizeIdentityTokens(right);
  if (leftTokens.length < 2 || rightTokens.length < 2) return false;
  if (leftTokens[0] !== rightTokens[0] || leftTokens.at(-1) !== rightTokens.at(-1)) return false;
  if (leftTokens.join("|") === rightTokens.join("|")) return false;

  const shorter = leftTokens.length <= rightTokens.length ? leftTokens : rightTokens;
  const longer = leftTokens.length <= rightTokens.length ? rightTokens : leftTokens;
  const longerSet = new Set(longer);
  return shorter.every((token) => longerSet.has(token));
}