import type { ExternalGameIndex, ExternalGameStatus, ScheduleDiscoveryDiagnostics } from "@/lib/stats-import/types";

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function mapStatus(raw: string | null): ExternalGameStatus {
  if (!raw) return "unknown";
  if (raw.includes("COMPLETE")) return "final";
  if (raw.includes("IN_PROGRESS") || raw.includes("LIVE")) return "live";
  if (raw.includes("SCHEDULED") || raw.includes("UPCOMING")) return "scheduled";
  if (raw.includes("CANCEL")) return "cancelled";
  return "unknown";
}

function parseDateLabel(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value.trim());
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function parseScoreValue(raw: string | undefined): number | null {
  if (!raw) return null;
  const score = Number(raw);
  return Number.isFinite(score) ? score : null;
}

function parseTeamNames(block: string): string[] {
  const primary = [...block.matchAll(/class="team-name-full"[^>]*>([^<]*)/gi)].map((item) =>
    decodeHtmlEntities(stripTags(item[1]))
  );
  if (primary.length >= 2) return primary.slice(0, 2);

  const legacy = [...block.matchAll(/class="team-name"[^>]*>\s*<span>([^<]*)<\/span>/gi)].map((item) =>
    decodeHtmlEntities(stripTags(item[1]))
  );
  if (legacy.length >= 2) return legacy.slice(0, 2);

  return primary.length ? primary : legacy;
}

function parseScores(block: string): { homeScore: number | null; awayScore: number | null } {
  const homeScore = parseScoreValue(block.match(/team-score homescore[\s\S]*?fake-cell">\s*(\d+)/i)?.[1]);
  const awayScore = parseScoreValue(block.match(/team-score awayscore[\s\S]*?fake-cell">\s*(\d+)/i)?.[1]);
  if (homeScore !== null && awayScore !== null) {
    return { homeScore, awayScore };
  }

  const legacyScores = [...block.matchAll(/class="score[^"]*"[^>]*>\s*(\d+)\s*</gi)].map((item) => parseScoreValue(item[1]));
  return {
    homeScore: homeScore ?? legacyScores[0] ?? null,
    awayScore: awayScore ?? legacyScores[1] ?? null
  };
}

function parseDateLabelFromBlock(block: string): string | null {
  const raw =
    block.match(/class="match-time"[\s\S]*?<span>([^<]+)</i)?.[1]?.trim() ??
    block.match(/class="date[^"]*"[^>]*>([^<]+)</i)?.[1]?.trim() ??
    block.match(/class="spls_datefield"[^>]*>([^<]+)</i)?.[1]?.trim() ??
    null;
  return parseDateLabel(raw);
}

function isPlaceholderTeamLabel(label: string, side: "A" | "B", matchId: string) {
  return label === `Team ${side} (${matchId})`;
}

export function parseScheduleHtml(html: string, competitionId: string, _sourceUrl: string): ExternalGameIndex[] {
  const games: ExternalGameIndex[] = [];
  const blockPattern = /<div class="match-wrap ([^"]+)" id\s*=\s*"extfix_(\d+)"[\s\S]*?(?=<div class="match-wrap |$)/gi;
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(html)) !== null) {
    const statusClass = match[1];
    const matchId = match[2];
    const block = match[0];
    const status = mapStatus(statusClass);

    const teamNames = parseTeamNames(block);
    const { homeScore, awayScore } = parseScores(block);

    const homeTeamLabel = teamNames[0] ?? `Team A (${matchId})`;
    const awayTeamLabel = teamNames[1] ?? `Team B (${matchId})`;
    const statsAvailable = status === "final" && homeScore !== null && awayScore !== null;

    games.push({
      providerGameKey: matchId,
      matchId,
      gameNumber: `SH-${competitionId}-${matchId}`,
      gameDate: parseDateLabelFromBlock(block),
      homeTeamLabel,
      awayTeamLabel,
      homeScore,
      awayScore,
      status,
      statsAvailable,
      sourceUrl: `https://www.fibalivestats.com/webcast/PRS/${matchId}/`,
      warnings: statsAvailable ? [] : ["Player stats may be unavailable until the game is final."]
    });
  }

  if (!games.length) {
    const fallbackIds = [...html.matchAll(/extfix_(\d+)/g)].map((item) => item[1]);
    const uniqueIds = Array.from(new Set(fallbackIds));
    for (const matchId of uniqueIds) {
      games.push({
        providerGameKey: matchId,
        matchId,
        gameNumber: `SH-${competitionId}-${matchId}`,
        gameDate: null,
        homeTeamLabel: `Match ${matchId}`,
        awayTeamLabel: "TBD",
        homeScore: null,
        awayScore: null,
        status: "unknown",
        statsAvailable: true,
        sourceUrl: `https://www.fibalivestats.com/webcast/PRS/${matchId}/`,
        warnings: ["Schedule details could not be parsed; verify after import."]
      });
    }
  }

  return games;
}

export function buildScheduleDiagnostics(
  html: string,
  scheduleUrl: string,
  responseBytes: number,
  games: ExternalGameIndex[]
): ScheduleDiscoveryDiagnostics {
  const rawExtfixIds = [...html.matchAll(/extfix_(\d+)/g)].map((item) => item[1]);
  const rawExtfixUnique = Array.from(new Set(rawExtfixIds));
  const matchWrapCount = [...html.matchAll(/<div class="match-wrap/gi)].length;
  const parsedIds = new Set(games.map((game) => game.matchId));
  const countsByStatus: Record<string, number> = {};
  for (const game of games) {
    countsByStatus[game.status] = (countsByStatus[game.status] ?? 0) + 1;
  }

  const discarded: ScheduleDiscoveryDiagnostics["discarded"] = [];
  for (const matchId of rawExtfixUnique) {
    if (!parsedIds.has(matchId)) {
      discarded.push({ matchId, reason: "extfix id present in HTML but not parsed by match-wrap block regex" });
    }
  }

  return {
    scheduleUrl,
    responseBytes,
    htmlBytes: html.length,
    rawExtfixCount: rawExtfixIds.length,
    rawExtfixUniqueCount: rawExtfixUnique.length,
    matchWrapCount,
    parsedMatchCount: games.length,
    countsByStatus,
    discarded,
    discoveredMatches: games.length,
    matchesWithTeams: games.filter(
      (game) =>
        !isPlaceholderTeamLabel(game.homeTeamLabel, "A", game.matchId) &&
        !isPlaceholderTeamLabel(game.awayTeamLabel, "B", game.matchId)
    ).length,
    matchesWithScores: games.filter((game) => game.homeScore !== null && game.awayScore !== null).length,
    matchesWithDates: games.filter((game) => game.gameDate !== null).length
  };
}

export function singleGameIndex(matchId: string, sourceUrl: string): ExternalGameIndex {
  return {
    providerGameKey: matchId,
    matchId,
    gameNumber: `SH-MATCH-${matchId}`,
    gameDate: null,
    homeTeamLabel: "Loading…",
    awayTeamLabel: "Loading…",
    homeScore: null,
    awayScore: null,
    status: "unknown",
    statsAvailable: true,
    sourceUrl: sourceUrl.includes("fibalivestats") ? sourceUrl : `https://www.fibalivestats.com/webcast/PRS/${matchId}/`,
    warnings: []
  };
}
