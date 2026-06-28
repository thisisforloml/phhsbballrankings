const EDITION_PREFIX = /^(\d+(?:st|nd|rd|th))\s+(.+)$/i;

export type CanonicalLeagueImport = {
  leagueName: string;
  seasonName: string;
  editionLabel: string | null;
};

export function resolveCanonicalLeagueImport(input: {
  leagueName: string;
  seasonName: string;
}): CanonicalLeagueImport {
  const rawLeagueName = input.leagueName.trim();
  const rawSeasonName = input.seasonName.trim() || "Season 1";
  const editionMatch = rawLeagueName.match(EDITION_PREFIX);

  if (!editionMatch) {
    return { leagueName: rawLeagueName, seasonName: rawSeasonName, editionLabel: null };
  }

  const editionLabel = `${editionMatch[1]} Edition`;
  const canonicalLeagueName = editionMatch[2].trim();
  const seasonName = /edition/i.test(rawSeasonName) ? rawSeasonName : `${editionLabel} — ${rawSeasonName}`;

  return { leagueName: canonicalLeagueName, seasonName, editionLabel };
}
