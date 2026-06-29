import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const MIGRATION_ENV_KEYS = ["DATABASE_URL_LOCAL", "DATABASE_URL_SUPABASE"] as const;

export type MigrationEnvKey = (typeof MIGRATION_ENV_KEYS)[number];

export type ParsedDatabaseUrl = {
  host: string;
  port: string;
  database: string;
  username: string;
};

/**
 * Load migration-only env vars from `.env.local` / `.env` before Prisma Client is imported.
 * Shell-exported values always win. Only reads DATABASE_URL_LOCAL and DATABASE_URL_SUPABASE —
 * never DATABASE_URL or DIRECT_URL (those may point at Supabase for the Next.js app).
 */
export function loadMigrationEnvVars(): void {
  for (const filename of [".env.local", ".env"]) {
    const filePath = path.join(process.cwd(), filename);
    if (!existsSync(filePath)) continue;

    const content = readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const equalsIndex = trimmed.indexOf("=");
      if (equalsIndex === -1) continue;

      const key = trimmed.slice(0, equalsIndex).trim();
      if (!MIGRATION_ENV_KEYS.includes(key as MigrationEnvKey)) continue;
      if (process.env[key]?.trim()) continue;

      let value = trimmed.slice(equalsIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

/** Parse host, port, database, and username for operator output (never prints password). */
export function parsePostgresUrl(connectionUrl: string): ParsedDatabaseUrl {
  try {
    const normalized = connectionUrl.replace(/^postgresql:/i, "postgres:");
    const url = new URL(normalized);
    const database =
      decodeURIComponent(url.pathname.replace(/^\//, "").split("?")[0] || "") || "(unknown)";
    const username = decodeURIComponent(url.username || "") || "(unknown)";
    const host = url.hostname || "(unknown)";
    const port = url.port || "5432";
    return { host, port, database, username };
  } catch {
    return {
      host: "(unable to parse)",
      port: "(unable to parse)",
      database: "(unable to parse)",
      username: "(unable to parse)",
    };
  }
}

export function redactDatabaseUrl(connectionUrl: string): string {
  try {
    const normalized = connectionUrl.replace(/^postgresql:/i, "postgres:");
    const url = new URL(normalized);
    if (url.password) url.password = "*****";
    return url.toString().replace(/^postgres:/i, "postgresql:");
  } catch {
    return "(unable to parse connection URL)";
  }
}

export function requireDatabaseUrls(): { localUrl: string; supabaseUrl: string } {
  const localUrl = process.env.DATABASE_URL_LOCAL?.trim();
  const supabaseUrl = process.env.DATABASE_URL_SUPABASE?.trim();

  if (!localUrl) {
    throw new Error("DATABASE_URL_LOCAL is required.");
  }
  if (!supabaseUrl) {
    throw new Error("DATABASE_URL_SUPABASE is required.");
  }
  if (localUrl === supabaseUrl) {
    throw new Error("DATABASE_URL_LOCAL and DATABASE_URL_SUPABASE must not be identical.");
  }

  return { localUrl, supabaseUrl };
}

export function printMigrationConnectionPlan(options: {
  localUrl: string;
  supabaseUrl: string;
}): void {
  const local = parsePostgresUrl(options.localUrl);
  const supabase = parsePostgresUrl(options.supabaseUrl);

  console.log("Migration database targets");
  console.log("");
  console.log("LOCAL (DATABASE_URL_LOCAL)");
  console.log(`  Host: ${local.host}`);
  console.log(`  Port: ${local.port}`);
  console.log(`  Database: ${local.database}`);
  console.log(`  Username: ${local.username}`);
  console.log(`  URL: ${redactDatabaseUrl(options.localUrl)}`);
  console.log("");
  console.log("SUPABASE (DATABASE_URL_SUPABASE)");
  console.log(`  Host: ${supabase.host}`);
  console.log(`  Port: ${supabase.port}`);
  console.log(`  Database: ${supabase.database}`);
  console.log(`  Username: ${supabase.username}`);
  console.log(`  URL: ${redactDatabaseUrl(options.supabaseUrl)}`);
  console.log("");
}
