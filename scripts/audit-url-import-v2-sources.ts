/**
 * Read-only URL Import V2 source audit for match 2743092.
 * Usage: npx tsx scripts/audit-url-import-v2-sources.ts
 */
import { fetchJson, fetchText } from "@/lib/stats-import/fetch-json";
import { fibaPlayerDisplayName } from "@/lib/stats-import/adapters/statshub-v1/fetch-match-data";
import { buildGeniusScheduleUrl } from "@/lib/stats-import/adapters/statshub-v1/resolve-competition";

const MATCH_ID = "2743092";
const COMPETITION_ID = "47340";
const STATSHUB_GAME_URL =
  "https://www.statshubph.info/pybc-13u?WHurl=%2Fcompetition%2F47340%2Fmatch%2F2743092%2Fboxscore%3F";
const GENIUS_EMBEDNF_BASE = "https://hosted.dcd.shared.geniussports.com/embednf/PRS/en";

type ProbeResult = {
  name: string;
  url: string;
  accessible: boolean;
  responseType: "JSON" | "HTML" | "unknown";
  error?: string;
  notes: string[];
};

const IDENTITY_FIELDS = [
  "cName",
  "name",
  "scoreboardName",
  "firstName",
  "familyName",
  "internationalFirstName",
  "internationalFamilyName",
  "firstNameInitial",
  "familyNameInitial",
  "playerCode",
  "personId",
  "pno",
  "shirtNumber",
  "comp"
] as const;

function pickIdentity(player: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of IDENTITY_FIELDS) {
    if (player[key] !== undefined && player[key] !== null && player[key] !== "") out[key] = player[key];
  }
  return out;
}

function hasFullName(identity: Record<string, unknown>) {
  const first = String(identity.firstName ?? identity.internationalFirstName ?? "").trim();
  const last = String(identity.familyName ?? identity.internationalFamilyName ?? "").trim();
  if (first.length > 2 && last.length > 2 && !first.endsWith(".") && !last.endsWith(".")) return true;
  const cName = String(identity.cName ?? "").trim();
  if (cName.split(/\s+/).length >= 2 && !/^[A-Z]\./.test(cName)) return true;
  const name = String(identity.name ?? "").trim();
  if (name.split(/\s+/).length >= 2 && !/^[A-Z]\./.test(name)) return true;
  return false;
}

async function probe(name: string, url: string, responseType: "JSON" | "HTML"): Promise<{ probe: ProbeResult; body?: unknown }> {
  try {
    const text = await fetchText(url);
    const probe: ProbeResult = {
      name,
      url,
      accessible: true,
      responseType,
      notes: [`bytes=${Buffer.byteLength(text, "utf8")}`]
    };
    if (responseType === "JSON") {
      return { probe, body: JSON.parse(text) };
    }
    return { probe, body: text };
  } catch (error) {
    return {
      probe: {
        name,
        url,
        accessible: false,
        responseType,
        error: error instanceof Error ? error.message : String(error),
        notes: []
      }
    };
  }
}

function findPlayersInHtml(html: string, needles: string[]) {
  const hits: Record<string, boolean> = {};
  for (const needle of needles) {
    hits[needle] = html.includes(needle);
  }
  return hits;
}

function summarizeDataJson(data: Record<string, unknown>) {
  const tm = data.tm as Record<string, Record<string, unknown>> | undefined;
  const home = tm?.["1"] ?? {};
  const away = tm?.["2"] ?? {};
  const homePlayers = Object.values((home.pl as Record<string, Record<string, unknown>>) ?? {});
  const awayPlayers = Object.values((away.pl as Record<string, Record<string, unknown>>) ?? {});

  return {
    compName: data.compName,
    matchTime: data.matchTime,
    homeTeam: {
      code: home.code,
      shortName: home.shortName,
      name: home.name,
      score: home.score,
      playerCount: homePlayers.length
    },
    awayTeam: {
      code: away.code,
      shortName: away.shortName,
      name: away.name,
      score: away.score,
      playerCount: awayPlayers.length
    },
    sampleHomePlayer: homePlayers[0] ? pickIdentity(homePlayers[0]) : null,
    sampleAwayPlayer: awayPlayers[0] ? pickIdentity(awayPlayers[0]) : null,
    importedNameSample: homePlayers.slice(0, 3).map((p) => fibaPlayerDisplayName(p))
  };
}

function extractPlayersFromEmbed(body: unknown) {
  const text = JSON.stringify(body);
  const players: Array<Record<string, unknown>> = [];

  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    const obj = node as Record<string, unknown>;
    const keys = Object.keys(obj);
    const looksLikePlayer =
      ("firstName" in obj || "familyName" in obj || "scoreboardName" in obj || "cName" in obj) &&
      ("sPoints" in obj || "points" in obj || "shirtNumber" in obj || "playingPosition" in obj);
    if (looksLikePlayer) players.push(obj);
    for (const value of Object.values(obj)) walk(value);
  }

  walk(body);
  return { textLength: text.length, playerCount: players.length, sample: players.slice(0, 3).map(pickIdentity) };
}

async function main() {
  const endpoints = [
    {
      name: "FIBA LiveStats data.json (current import source)",
      url: `https://fibalivestats.dcd.shared.geniussports.com/data/${MATCH_ID}/data.json`,
      type: "JSON" as const
    },
    {
      name: "Genius embednf boxscore",
      url: `${GENIUS_EMBEDNF_BASE}/competition/${COMPETITION_ID}/match/${MATCH_ID}/boxscore`,
      type: "JSON" as const
    },
    {
      name: "Genius embednf schedule (Eliminations)",
      url: buildGeniusScheduleUrl(`/competition/${COMPETITION_ID}/schedule?phaseName=Eliminations`),
      type: "JSON" as const
    },
    {
      name: "FIBA LiveStats webcast page",
      url: `https://www.fibalivestats.com/webcast/PRS/${MATCH_ID}/`,
      type: "HTML" as const
    },
    {
      name: "StatsHub tournament page (WP JSON)",
      url: "https://www.statshubph.info/wp-json/wp/v2/pages?slug=pybc-13u&_fields=title,content",
      type: "JSON" as const
    },
    {
      name: "StatsHub game URL (browser page)",
      url: STATSHUB_GAME_URL,
      type: "HTML" as const
    }
  ];

  const probes: ProbeResult[] = [];
  let dataJson: Record<string, unknown> | null = null;
  let boxscoreJson: unknown = null;
  let scheduleEnvelope: unknown = null;
  let webcastHtml = "";
  let statshubHtml = "";

  for (const endpoint of endpoints) {
    const result = await probe(endpoint.name, endpoint.url, endpoint.type);
    probes.push(result.probe);
    if (!result.probe.accessible) continue;
    if (endpoint.name.includes("data.json")) dataJson = result.body as Record<string, unknown>;
    if (endpoint.name.includes("boxscore")) boxscoreJson = result.body;
    if (endpoint.name.includes("schedule")) scheduleEnvelope = result.body;
    if (endpoint.name.includes("webcast")) webcastHtml = String(result.body ?? "");
    if (endpoint.name.includes("StatsHub game URL")) statshubHtml = String(result.body ?? "");
  }

  console.log("=== SOURCE PROBE ===");
  for (const p of probes) {
    console.log(`\n[${p.accessible ? "OK" : "FAIL"}] ${p.name}`);
    console.log(`  URL: ${p.url}`);
    console.log(`  Type: ${p.responseType}`);
    if (p.error) console.log(`  Error: ${p.error}`);
    if (p.notes.length) console.log(`  Notes: ${p.notes.join(", ")}`);
  }

  if (dataJson) {
    console.log("\n=== data.json SUMMARY ===");
    console.log(JSON.stringify(summarizeDataJson(dataJson), null, 2));
  }

  if (boxscoreJson) {
    console.log("\n=== embednf boxscore SUMMARY ===");
    const envelope = boxscoreJson as { html?: string };
    if (envelope.html) {
      console.log(`html bytes=${Buffer.byteLength(envelope.html, "utf8")}`);
      console.log("html player name hits:", findPlayersInHtml(envelope.html, ["J. Cruz", "Chester Cruz", "L. Santos", "E. Araneta"]));
    } else {
      console.log(JSON.stringify(extractPlayersFromEmbed(boxscoreJson), null, 2));
    }
  }

  if (scheduleEnvelope) {
    const html = (scheduleEnvelope as { html?: string }).html ?? "";
    console.log("\n=== embednf schedule SUMMARY ===");
    console.log(`html bytes=${Buffer.byteLength(html, "utf8")}`);
    console.log(`contains match ${MATCH_ID}:`, html.includes(MATCH_ID));
  }

  if (webcastHtml) {
    console.log("\n=== webcast HTML name hits ===");
    console.log(findPlayersInHtml(webcastHtml, ["J. Cruz", "Chester Cruz", "L. Santos", "E. Araneta", "Cardenas", "Depano"]));
  }

  if (statshubHtml) {
    console.log("\n=== StatsHub game page name hits ===");
    console.log(findPlayersInHtml(statshubHtml, ["J. Cruz", "Chester Cruz", "L. Santos", "E. Araneta", "Cardenas", "Depano"]));
  }

  if (dataJson) {
    const tm = dataJson.tm as Record<string, { pl?: Record<string, Record<string, unknown>> }>;
    const allPlayers = [
      ...Object.values(tm?.["1"]?.pl ?? {}),
      ...Object.values(tm?.["2"]?.pl ?? {})
    ];

    const targets = ["Cruz", "Santos", "Araneta"];
    console.log("\n=== PLAYER IDENTITY TRACE (data.json) ===");
    for (const target of targets) {
      const matches = allPlayers.filter((p) => {
        const id = pickIdentity(p);
        return JSON.stringify(id).toLowerCase().includes(target.toLowerCase());
      });
      console.log(`\n-- family contains '${target}' (${matches.length} rows) --`);
      for (const player of matches.slice(0, 4)) {
        const identity = pickIdentity(player);
        console.log({
          importedViaCurrentHelper: fibaPlayerDisplayName(player),
          identity,
          hasFullName: hasFullName(identity)
        });
      }
    }

    console.log("\n=== NAME FIELD COVERAGE (all players) ===");
    let withScoreboard = 0;
    let withFirstLast = 0;
    let withFullFirstLast = 0;
    let withCName = 0;
    for (const player of allPlayers) {
      const id = pickIdentity(player);
      if (id.scoreboardName) withScoreboard++;
      if (id.firstName && id.familyName) withFirstLast++;
      if (hasFullName(id)) withFullFirstLast++;
      if (id.cName) withCName++;
    }
    console.log({
      totalPlayers: allPlayers.length,
      withCName,
      withScoreboardName: withScoreboard,
      withFirstAndFamily: withFirstLast,
      withFullFirstAndFamily: withFullFirstLast
    });
  }

  // Parse boxscore HTML deeply
  if (boxscoreJson) {
    const html = (boxscoreJson as { html?: string }).html ?? "";
    const teamFull = [...html.matchAll(/team-name-full[^>]*>([^<]+)/g)].map((m) => m[1].trim());
    const teamShort = [...html.matchAll(/team-name-abbr[^>]*>([^<]+)/g)].map((m) => m[1].trim());
    const onclickPlayers = [...html.matchAll(/data-player-name=\"([^\"]+)\"/g)].map((m) => m[1]);
    const thPlayers = [...html.matchAll(/<th[^>]*class=\"[^\"]*player[^\"]*\"[^>]*>([^<]+)/gi)].map((m) => m[1].trim());
    console.log("\n=== embednf boxscore HTML PARSE ===");
    console.log({ teamFull: teamFull.slice(0, 4), teamShort: teamShort.slice(0, 4), onclickPlayers: onclickPlayers.slice(0, 8), thPlayers: thPlayers.slice(0, 8) });
    console.log("contains Ethan Suangco:", html.includes("Ethan Suangco"));
    console.log("contains Enzo Araneta:", html.includes("Enzo Araneta"));
    console.log("contains E. Suangco:", html.includes("E. Suangco"));
  }

  if (dataJson) {
    console.log("\n=== data.json STRUCTURE ===");
    console.log("top-level keys:", Object.keys(dataJson).slice(0, 30));
    const home = (dataJson.tm as Record<string, Record<string, unknown>>)?.["1"] ?? {};
    console.log("home team keys:", Object.keys(home));
    const samplePlayer = Object.values((home.pl as Record<string, Record<string, unknown>>) ?? {})[0] ?? {};
    console.log(
      "player identity/stat keys:",
      Object.keys(samplePlayer).filter((k) => !k.startsWith("s") && !k.startsWith("eff_"))
    );
    console.log("has quarter data keys:", Object.keys(dataJson).filter((k) => /period|quarter|q[1-4]/i.test(k)));
  }

  // Find J. Cruz / L. Santos in another Aces Solar game
  console.log("\n=== CROSS-MATCH PLAYER TRACE (Aces Solar examples) ===");
  const acesMatchIds = ["2743093", "2743094", "2743095"];
  for (const matchId of acesMatchIds) {
    try {
      const data = await fetchJson<Record<string, unknown>>(`https://fibalivestats.dcd.shared.geniussports.com/data/${matchId}/data.json`);
      const tm = data.tm as Record<string, { pl?: Record<string, Record<string, unknown>>; name?: string }>;
      const players = [...Object.values(tm?.["1"]?.pl ?? {}), ...Object.values(tm?.["2"]?.pl ?? {})];
      for (const needle of ["Cruz", "Santos"]) {
        const hit = players.find((p) => String(p.familyName ?? "").includes(needle));
        if (hit) {
          const identity = pickIdentity(hit);
          console.log(`match ${matchId}:`, {
            teamHome: tm?.["1"]?.name,
            teamAway: tm?.["2"]?.name,
            needle,
            importedViaCurrentHelper: fibaPlayerDisplayName(hit),
            identity,
            canonicalFullName: `${identity.firstName ?? ""} ${identity.familyName ?? ""}`.trim()
          });
        }
      }
    } catch (error) {
      console.log(`match ${matchId} failed`, error instanceof Error ? error.message : error);
    }
  }
  const alternates = [
    `https://fibalivestats.dcd.shared.geniussports.com/data/${MATCH_ID}/game.json`,
    `https://fibalivestats.dcd.shared.geniussports.com/data/${MATCH_ID}/players.json`,
    `https://fibalivestats.dcd.shared.geniussports.com/data/${MATCH_ID}/boxscore.json`,
    `https://hosted.dcd.shared.geniussports.com/embednf/PRS/en/match/${MATCH_ID}/boxscore`
  ];
  console.log("\n=== ALTERNATE ENDPOINT PROBE ===");
  for (const url of alternates) {
    const result = await probe(url, url, "JSON");
    console.log(`[${result.probe.accessible ? "OK" : "FAIL"}] ${url}${result.probe.error ? ` (${result.probe.error})` : ""}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
