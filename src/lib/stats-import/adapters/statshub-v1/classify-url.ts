const STATSHUB_HOST_PATTERN = /(^|\.)statshubph\.info$/i;
const WEBCAST_PATTERN = /fibalivestats\.(?:com|dcd\.shared\.geniussports\.com)\/webcast\/PRS\/(\d+)/i;
const MATCH_PATH_PATTERN = /\/match\/(\d+)/i;
const COMPETITION_PATH_PATTERN = /\/competition\/(\d+)/i;

export type ClassifiedStatsUrl = {
  provider: "statshub-v1";
  canonicalUrl: string;
  pageType: "competition" | "game" | "unknown";
  statsHubOrigin: string | null;
  statsHubSlug: string | null;
  matchId: string | null;
  competitionId: string | null;
  /** Genius embed path from WHurl, e.g. /competition/47340/schedule?phaseName=Eliminations */
  geniusPagePath: string | null;
};

export function normalizeGeniusPagePath(value: string): string {
  let path = value.trim();
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.replace(/&+$/, "");
  return path;
}

export function geniusPagePathFromWhUrl(rawWhUrl: string | null): string | null {
  if (!rawWhUrl) return null;
  try {
    const decoded = decodeURIComponent(rawWhUrl);
    const path = normalizeGeniusPagePath(decoded);
    return path.length > 1 ? path : null;
  } catch {
    return null;
  }
}

export function classifyStatsImportUrl(input: string): ClassifiedStatsUrl {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("URL is required.");

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Enter a valid URL.");
  }

  const canonicalUrl = parsed.toString();
  const webcastMatch = trimmed.match(WEBCAST_PATTERN);
  if (webcastMatch) {
    return {
      provider: "statshub-v1",
      canonicalUrl,
      pageType: "game",
      statsHubOrigin: null,
      statsHubSlug: null,
      matchId: webcastMatch[1],
      competitionId: null,
      geniusPagePath: null
    };
  }

  const pathMatchId = trimmed.match(MATCH_PATH_PATTERN);
  if (pathMatchId && !STATSHUB_HOST_PATTERN.test(parsed.hostname)) {
    return {
      provider: "statshub-v1",
      canonicalUrl,
      pageType: "game",
      statsHubOrigin: null,
      statsHubSlug: null,
      matchId: pathMatchId[1],
      competitionId: trimmed.match(COMPETITION_PATH_PATTERN)?.[1] ?? null,
      geniusPagePath: null
    };
  }

  if (STATSHUB_HOST_PATTERN.test(parsed.hostname)) {
    const slug = parsed.pathname.replace(/^\/+|\/+$/g, "") || null;
    const competitionIdFromUrl = trimmed.match(COMPETITION_PATH_PATTERN)?.[1] ?? null;
    const geniusPagePath = geniusPagePathFromWhUrl(parsed.searchParams.get("WHurl"));
    const whMatchId = geniusPagePath?.match(MATCH_PATH_PATTERN)?.[1] ?? null;
    const isGameWhUrl = Boolean(whMatchId && geniusPagePath?.includes("/match/"));

    if (isGameWhUrl && whMatchId) {
      return {
        provider: "statshub-v1",
        canonicalUrl,
        pageType: "game",
        statsHubOrigin: parsed.origin,
        statsHubSlug: slug,
        matchId: whMatchId,
        competitionId: geniusPagePath?.match(COMPETITION_PATH_PATTERN)?.[1] ?? competitionIdFromUrl,
        geniusPagePath
      };
    }

    if (geniusPagePath?.includes("/schedule")) {
      return {
        provider: "statshub-v1",
        canonicalUrl,
        pageType: "competition",
        statsHubOrigin: parsed.origin,
        statsHubSlug: slug,
        matchId: null,
        competitionId: geniusPagePath.match(COMPETITION_PATH_PATTERN)?.[1] ?? competitionIdFromUrl,
        geniusPagePath
      };
    }

    return {
      provider: "statshub-v1",
      canonicalUrl,
      pageType: slug ? "competition" : "unknown",
      statsHubOrigin: parsed.origin,
      statsHubSlug: slug,
      matchId: null,
      competitionId: competitionIdFromUrl,
      geniusPagePath
    };
  }

  throw new Error("Unsupported URL. Use a StatsHub tournament page or FIBA LiveStats webcast link.");
}
