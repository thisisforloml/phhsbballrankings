/**
 * Verify cached getPlayerProfileBySlug returns identical output to uncached loader.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/verify-player-profile-cache-parity.ts [slug]
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

function loadDotEnv() {
  try {
    const text = readFileSync(path.join(process.cwd(), ".env"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* no .env */
  }
}

async function main() {
  loadDotEnv();
  const slug = process.argv[2] ?? "jude-eriobu";
  const { loadPlayerProfileBySlugUncached, getPlayerProfileBySlug } = await import("../src/lib/player-profile");
  const { prisma } = await import("../src/lib/prisma");

  const uncached = await loadPlayerProfileBySlugUncached(slug);
  const cached = await getPlayerProfileBySlug(slug);

  const uncachedJson = JSON.stringify(uncached);
  const cachedJson = JSON.stringify(cached);
  const identical = uncachedJson === cachedJson;

  const report = { slug, identical, uncachedBytes: uncachedJson.length, cachedBytes: cachedJson.length };
  const outDir = path.join(process.cwd(), ".cursor", "player-profile-cache-benchmark");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "parity.json"), JSON.stringify(report, null, 2), "utf8");

  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();

  if (!identical) {
    console.error("Profile output mismatch between uncached and cached loaders.");
    process.exit(1);
  }
  console.log("Profile output identical.");
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
