import { writeFileSync } from "node:fs";
import path from "node:path";
import { PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { prepareImportedPlayerName } from "../src/lib/player-import-identity";

const reportPath = path.join("scripts", "reports", "player-alias-seed-report.json");

/** Approved merge alias groups from diagnose-duplicate-players.ts plus JD JUANGCO (formerly hardcoded). */
const PLAYER_ALIAS_SEED_GROUPS = [
  { aliases: ["A. Timbang"], canonical: "Allan Timbang" },
  { aliases: ["B. Garcia"], canonical: "Bill Garcia" },
  { aliases: ["C. Cabantog"], canonical: "Corian Cabantog" },
  { aliases: ["C. Cartel"], canonical: "Chad Cartel" },
  { aliases: ["C. Fongtong", "Craig Fogntong"], canonical: "Craig Fongtong" },
  { aliases: ["C. Gomez"], canonical: "Chrys Gomez" },
  { aliases: ["C. Tulabut"], canonical: "Chester Tulabut" },
  { aliases: ["D. Sison"], canonical: "Denver Sison" },
  { aliases: ["F. Flores"], canonical: "Francel Flores" },
  { aliases: ["J. Artango"], canonical: "Jarl Artango" },
  { aliases: ["J. Eiman"], canonical: "JP Eiman" },
  { aliases: ["K. Figueroa"], canonical: "Kurl Figueroa" },
  { aliases: ["K. Frogoso"], canonical: "Kevin Frogoso" },
  { aliases: ["L. Manding"], canonical: "Lebron Manding" },
  { aliases: ["M. Alcartado"], canonical: "Marco Alcartado" },
  { aliases: ["M. Diakite"], canonical: "Moussa Diakite" },
  { aliases: ["M. Jenodia"], canonical: "Mac Jenodia" },
  { aliases: ["M. Matias"], canonical: "Mot Matias" },
  { aliases: ["M. Matillano"], canonical: "Makoy Matillano" },
  { aliases: ["M. Natinga"], canonical: "Miekho Natinga" },
  { aliases: ["Mark jade Dulin"], canonical: "Mark Jade Dulin" },
  { aliases: ["N. Babad"], canonical: "Nazi Babad" },
  { aliases: ["N. Bautista"], canonical: "Noah Bautista" },
  { aliases: ["R. Celiz"], canonical: "Rob Celiz" },
  { aliases: ["R. Juan"], canonical: "Ronnie Juan" },
  { aliases: ["S. Bouzina"], canonical: "Sofiane Bouzina" },
  { aliases: ["S. Lucido"], canonical: "Shaun Lucido" },
  { aliases: ["S. Mann"], canonical: "Sal Mann" },
  { aliases: ["Q. Molina"], canonical: "Q Molina" },
  { aliases: ["Z. Gonzales"], canonical: "Zyron Gonzales" },
  { aliases: ["JD JUANGCO"], canonical: "JD Juangco" }
] as const;

type SeedRow = {
  rawAlias: string;
  aliasName: string;
  canonicalDisplayName: string;
  playerId: string;
  gender: PlayerGender;
};

type SeedError = {
  rawAlias: string;
  canonicalDisplayName: string;
  error: string;
};

async function findActiveCanonical(canonicalDisplayName: string) {
  return prisma.player.findMany({
    where: { displayName: canonicalDisplayName, deletedAt: null },
    select: { id: true, displayName: true, gender: true },
    orderBy: { createdAt: "asc" }
  });
}

async function validateAliasRow(rawAlias: string, canonicalDisplayName: string, canonical: { id: string; displayName: string; gender: PlayerGender }) {
  const aliasName = prepareImportedPlayerName(rawAlias);

  if (!aliasName) {
    throw new Error("Alias produced an empty post-pipeline string.");
  }

  if (aliasName === canonical.displayName) {
    throw new Error("Alias is identical to canonical displayName; no PlayerAlias row needed.");
  }

  const conflictingActivePlayer = await prisma.player.findFirst({
    where: { displayName: aliasName, gender: canonical.gender, deletedAt: null, NOT: { id: canonical.id } },
    select: { id: true, displayName: true }
  });
  if (conflictingActivePlayer) {
    throw new Error(`Another active player already uses displayName "${aliasName}" (${conflictingActivePlayer.id}).`);
  }

  const existingAlias = await prisma.playerAlias.findUnique({
    where: { aliasName_gender: { aliasName, gender: canonical.gender } },
    select: { id: true, playerId: true }
  });
  if (existingAlias) {
    if (existingAlias.playerId === canonical.id) {
      throw new Error("SKIP_ALREADY_SEEDED");
    }
    throw new Error(`PlayerAlias already exists for "${aliasName}" pointing to a different player.`);
  }

  return { rawAlias, aliasName, canonicalDisplayName, playerId: canonical.id, gender: canonical.gender };
}

async function main() {
  const execute = process.argv.includes("--execute");
  const rows: SeedRow[] = [];
  const skipped: Array<{ rawAlias: string; canonicalDisplayName: string; reason: string }> = [];
  const errors: SeedError[] = [];

  for (const group of PLAYER_ALIAS_SEED_GROUPS) {
    const canonicals = await findActiveCanonical(group.canonical);
    if (canonicals.length === 0) {
      for (const rawAlias of group.aliases) {
        errors.push({ rawAlias, canonicalDisplayName: group.canonical, error: `No active canonical player found for "${group.canonical}".` });
      }
      continue;
    }
    if (canonicals.length > 1) {
      for (const rawAlias of group.aliases) {
        errors.push({
          rawAlias,
          canonicalDisplayName: group.canonical,
          error: `Multiple active canonical players found for "${group.canonical}" (${canonicals.map((player) => player.id).join(", ")}).`
        });
      }
      continue;
    }

    const canonical = canonicals[0];
    for (const rawAlias of group.aliases) {
      try {
        const row = await validateAliasRow(rawAlias, group.canonical, canonical);
        rows.push(row);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === "SKIP_ALREADY_SEEDED") {
          skipped.push({ rawAlias, canonicalDisplayName: group.canonical, reason: message });
          continue;
        }
        if (message.includes("identical to canonical")) {
          skipped.push({ rawAlias, canonicalDisplayName: group.canonical, reason: message });
          continue;
        }
        errors.push({ rawAlias, canonicalDisplayName: group.canonical, error: message });
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: execute ? "execute" : "dry-run",
    groups: PLAYER_ALIAS_SEED_GROUPS.length,
    plannedInserts: rows.length,
    skipped,
    errors,
    rows
  };

  if (errors.length > 0) {
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 1;
    return;
  }

  if (execute) {
    for (const row of rows) {
      await prisma.playerAlias.create({
        data: {
          playerId: row.playerId,
          aliasName: row.aliasName,
          gender: row.gender as PlayerGender,
          source: "approved_merge",
          note: `Seeded from diagnose-duplicate-players group for ${row.canonicalDisplayName}`
        }
      });
    }
    report.plannedInserts = rows.length;
  }

  writeFileSync(reportPath, JSON.stringify({ ...report, executedInserts: execute ? rows.length : 0 }, null, 2));
  console.log(JSON.stringify({ ...report, executedInserts: execute ? rows.length : 0 }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
