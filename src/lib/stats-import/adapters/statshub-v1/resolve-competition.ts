import { fetchJson, fetchText } from "@/lib/stats-import/fetch-json";

const GENIUS_EMBEDNF_BASE = "https://hosted.dcd.shared.geniussports.com/embednf/PRS/en";

type WpPage = {
  title?: { rendered?: string };
  content?: { rendered?: string };
};

const COMPETITION_PAGE_PATTERN = /\/competition\/(\d+)\//;
const SPIl_PAGE_PATTERN = /"page"\s*:\s*"([^"]+)"/;

export async function resolveStatsHubCompetition(_sourceUrl: string, statsHubOrigin: string, slug: string | null) {
  if (!slug) throw new Error("StatsHub tournament slug could not be determined from the URL.");

  const pages = await fetchJson<WpPage[]>(
    `${statsHubOrigin}/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&_fields=title,content`
  );
  const page = pages[0];
  if (!page?.content?.rendered) {
    throw new Error(`StatsHub page not found for slug "${slug}".`);
  }

  const content = page.content.rendered;
  const competitionMatch = content.match(COMPETITION_PAGE_PATTERN);
  if (!competitionMatch) {
    throw new Error("No Genius Sports competition ID found on this StatsHub page.");
  }

  const spilPageMatch = content.match(SPIl_PAGE_PATTERN);
  const defaultGeniusPagePath = spilPageMatch?.[1]?.replace(/\\\//g, "/") ?? `/competition/${competitionMatch[1]}/schedule`;

  return {
    competitionId: competitionMatch[1],
    competitionTitle: decodeHtmlEntities(page.title?.rendered ?? slug),
    defaultGeniusPagePath: defaultGeniusPagePath.startsWith("/") ? defaultGeniusPagePath : `/${defaultGeniusPagePath}`
  };
}

export function buildGeniusScheduleUrl(geniusPagePath: string): string {
  const path = geniusPagePath.startsWith("/") ? geniusPagePath : `/${geniusPagePath}`;
  return `${GENIUS_EMBEDNF_BASE}${path}`;
}

export async function fetchGeniusEmbedSchedule(geniusPagePath: string): Promise<{ html: string; scheduleUrl: string; responseBytes: number }> {
  const scheduleUrl = buildGeniusScheduleUrl(geniusPagePath);
  const raw = await fetchText(scheduleUrl);
  const envelope = JSON.parse(raw) as { html?: string };
  if (!envelope.html) throw new Error("Schedule response did not include HTML.");
  return { html: envelope.html, scheduleUrl, responseBytes: Buffer.byteLength(raw, "utf8") };
}

/** @deprecated Use fetchGeniusEmbedSchedule with explicit page path. */
export async function fetchCompetitionScheduleHtml(competitionId: string): Promise<string> {
  const result = await fetchGeniusEmbedSchedule(`/competition/${competitionId}/schedule`);
  return result.html;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    .trim();
}
