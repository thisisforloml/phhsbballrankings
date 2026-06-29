import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { parsePostgresUrl } from "./env";
import type { TablePlanEntry } from "./table-plan";

export { parsePostgresUrl, requireDatabaseUrls } from "./env";
export type { ParsedDatabaseUrl } from "./env";

export type MigrationCliOptions = {
  dryRun: boolean;
  resume: boolean;
  batchSize: number;
};

export type MigrationState = {
  version: 1;
  startedAt: string;
  updatedAt: string;
  completedPgTables: string[];
};

export type TableMigrationResult = {
  pgTable: string;
  label: string;
  sourceCount: number;
  destinationCountBefore: number;
  destinationCountAfter: number;
  rowsInserted: number;
  /** Rows expected to insert (source − destination before copy). */
  rowsToInsert: number;
  elapsedMs: number;
  skipped: boolean;
};

export type MigrationSummary = {
  dryRun: boolean;
  tablesProcessed: number;
  tablesSkipped: number;
  totalRowsMigrated: number;
  totalSourceRows: number;
  totalDestinationRows: number;
  totalRowsToInsert: number;
  elapsedMs: number;
  warnings: string[];
  tableResults: TableMigrationResult[];
};

const STATE_FILE = path.join(process.cwd(), "scripts", "reports", "migrate-local-to-supabase-state.json");

export function parseCliArgs(argv: string[]): MigrationCliOptions {
  let dryRun = false;
  let resume = false;
  let batchSize = 500;

  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--resume") resume = true;
    else if (arg.startsWith("--batch-size=")) {
      const parsed = Number(arg.split("=")[1]);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5000) {
        throw new Error("--batch-size must be an integer between 1 and 5000.");
      }
      batchSize = parsed;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { dryRun, resume, batchSize };
}

function printHelp() {
  console.log(`Usage: tsx scripts/migrate-local-to-supabase.ts [options]

Options:
  --dry-run            Analyze row counts; no inserts (never aborts on count differences)
  --resume             Skip tables already verified in state file
  --batch-size=500     Rows per createMany batch (default 500)
  -h, --help           Show this help

Required environment variables:
  DATABASE_URL_LOCAL     Source PostgreSQL (local production DB)
  DATABASE_URL_SUPABASE  Destination PostgreSQL (Supabase)
`);
}

export type DatabaseTarget = "LOCAL" | "SUPABASE";

function isAuthenticationFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const prismaCode = (error as Error & { code?: string }).code;
  if (prismaCode === "P1000") return true;

  const message = error.message.toLowerCase();
  return (
    message.includes("authentication failed") ||
    message.includes("password authentication failed") ||
    message.includes("invalid authorization specification") ||
    message.includes("invalid password") ||
    (message.includes("credentials") && message.includes("not valid"))
  );
}

function printAuthenticationFailureMessage(
  target: DatabaseTarget,
  envVar: "DATABASE_URL_LOCAL" | "DATABASE_URL_SUPABASE",
  connectionUrl: string
) {
  const headline = target === "LOCAL" ? "LOCAL PostgreSQL" : "SUPABASE";
  const { host, port, database, username } = parsePostgresUrl(connectionUrl);

  console.error(`Unable to connect to ${headline}.`);
  console.error("");
  console.error(`Check ${envVar}.`);
  console.error("");
  console.error(`Host: ${host}`);
  console.error(`Port: ${port}`);
  console.error(`Database: ${database}`);
  console.error(`Username: ${username}`);
  console.error("");
  console.error("Password may be incorrect.");
}

function printGenericConnectionFailureMessage(
  target: DatabaseTarget,
  envVar: "DATABASE_URL_LOCAL" | "DATABASE_URL_SUPABASE",
  connectionUrl: string,
  error: unknown
) {
  const headline = target === "LOCAL" ? "LOCAL PostgreSQL" : "SUPABASE";
  const { host, port, database, username } = parsePostgresUrl(connectionUrl);
  const detail = error instanceof Error ? error.message : String(error);

  console.error(`Unable to connect to ${headline}.`);
  console.error("");
  console.error(`Check ${envVar}.`);
  console.error("");
  console.error(`Host: ${host}`);
  console.error(`Port: ${port}`);
  console.error(`Database: ${database}`);
  console.error(`Username: ${username}`);
  console.error("");
  console.error(detail);
}

/**
 * Verify both databases are reachable before any migration work begins.
 * Authentication failures print a concise operator message (no Prisma stack trace).
 */
export async function validateDatabaseConnections(options: {
  localDb: PrismaClient;
  supabaseDb: PrismaClient;
  localUrl: string;
  supabaseUrl: string;
}): Promise<void> {
  try {
    await options.localDb.$queryRaw`SELECT 1`;
  } catch (error) {
    if (isAuthenticationFailure(error)) {
      printAuthenticationFailureMessage("LOCAL", "DATABASE_URL_LOCAL", options.localUrl);
    } else {
      printGenericConnectionFailureMessage("LOCAL", "DATABASE_URL_LOCAL", options.localUrl, error);
    }
    process.exit(1);
  }

  try {
    await options.supabaseDb.$queryRaw`SELECT 1`;
  } catch (error) {
    if (isAuthenticationFailure(error)) {
      printAuthenticationFailureMessage("SUPABASE", "DATABASE_URL_SUPABASE", options.supabaseUrl);
    } else {
      printGenericConnectionFailureMessage("SUPABASE", "DATABASE_URL_SUPABASE", options.supabaseUrl, error);
    }
    process.exit(1);
  }
}


/**
 * Build a Prisma client for migration without inheriting app `.env` DATABASE_URL / DIRECT_URL.
 * prisma/schema.prisma declares directUrl = env("DIRECT_URL"); without scoping both env vars
 * to the migration target at construction time, the engine can connect to Supabase instead
 * of local Postgres even when datasources.db.url is overridden.
 */
function createLocalMigrationClient(): PrismaClient {
  const connectionUrl = process.env.DATABASE_URL_LOCAL?.trim();
  if (!connectionUrl) {
    throw new Error("DATABASE_URL_LOCAL is required.");
  }

  return createIsolatedMigrationClient(connectionUrl, process.env.DATABASE_URL_LOCAL!);
}

function createSupabaseMigrationClient(): PrismaClient {
  const connectionUrl = process.env.DATABASE_URL_SUPABASE?.trim();
  if (!connectionUrl) {
    throw new Error("DATABASE_URL_SUPABASE is required.");
  }

  return createIsolatedMigrationClient(connectionUrl, process.env.DATABASE_URL_SUPABASE!);
}

function createIsolatedMigrationClient(connectionUrl: string, datasourceUrl: string): PrismaClient {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousDirectUrl = process.env.DIRECT_URL;

  process.env.DATABASE_URL = connectionUrl;
  process.env.DIRECT_URL = connectionUrl;

  const client = new PrismaClient({
    datasources: {
      db: {
        url: datasourceUrl,
      },
    },
    log: [],
  });

  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;

  if (previousDirectUrl === undefined) delete process.env.DIRECT_URL;
  else process.env.DIRECT_URL = previousDirectUrl;

  return client;
}

export function createMigrationClients() {
  return {
    localDb: createLocalMigrationClient(),
    supabaseDb: createSupabaseMigrationClient(),
  };
}

export async function disconnectClients(localDb: PrismaClient, supabaseDb: PrismaClient) {
  await Promise.allSettled([localDb.$disconnect(), supabaseDb.$disconnect()]);
}

export function loadMigrationState(): MigrationState | null {
  try {
    const raw = readFileSync(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as MigrationState;
    if (parsed.version !== 1 || !Array.isArray(parsed.completedPgTables)) {
      throw new Error("Invalid state file shape.");
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export function saveMigrationState(state: MigrationState) {
  mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

export function createInitialState(): MigrationState {
  const now = new Date().toISOString();
  return {
    version: 1,
    startedAt: now,
    updatedAt: now,
    completedPgTables: [],
  };
}

export async function countTableRows(db: PrismaClient, pgTable: string): Promise<number> {
  const rows = await db.$queryRaw<Array<{ count: bigint }>>(
    Prisma.sql`SELECT COUNT(*)::bigint AS count FROM ${Prisma.raw(`"${pgTable}"`)}`
  );
  return Number(rows[0]?.count ?? 0);
}

type PrismaDelegate = {
  findMany: (args: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
  createMany: (args: {
    data: Array<Record<string, unknown>>;
    skipDuplicates?: boolean;
  }) => Promise<Prisma.BatchPayload>;
};

function getCursorField(table: TablePlanEntry): string {
  return table.cursorField ?? "id";
}

function getDelegate(db: PrismaClient, model: string): PrismaDelegate {
  const delegate = (db as unknown as Record<string, PrismaDelegate | undefined>)[model];
  if (!delegate?.findMany || !delegate?.createMany) {
    throw new Error(`Prisma delegate not found for model "${model}".`);
  }
  return delegate;
}

export async function migrateTableData(options: {
  localDb: PrismaClient;
  supabaseDb: PrismaClient;
  table: TablePlanEntry;
  batchSize: number;
}): Promise<{ rowsInserted: number; destinationCountAfter: number }> {
  const { localDb, supabaseDb, table, batchSize } = options;
  const localDelegate = getDelegate(localDb, table.model);
  const cursorField = getCursorField(table);

  let rowsInserted = 0;
  let cursor: string | undefined;

  while (true) {
    const batch = await localDelegate.findMany({
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { [cursorField]: cursor } } : {}),
      orderBy: { [cursorField]: "asc" },
    });

    if (batch.length === 0) break;

    try {
      await supabaseDb.$transaction(async (tx) => {
        const txDelegate = getDelegate(tx as PrismaClient, table.model);
        const result = await txDelegate.createMany({
          data: batch,
          skipDuplicates: true,
        });
        rowsInserted += result.count;
      });
    } catch (error) {
      throw new MigrationAbortError(
        error instanceof Error ? error.message : String(error),
        table,
        batch[0]
      );
    }

    const lastRow = batch[batch.length - 1];
    const nextCursor = lastRow?.[cursorField];
    if (typeof nextCursor !== "string") {
      throw new Error(`Cursor field "${cursorField}" missing on last row for table ${table.pgTable}.`);
    }
    cursor = nextCursor;
    if (batch.length < batchSize) break;
  }

  const destinationCountAfter = await countTableRows(supabaseDb, table.pgTable);
  return { rowsInserted, destinationCountAfter };
}

export async function syncSequencesForTable(db: PrismaClient, pgTable: string): Promise<number> {
  const sequences = await db.$queryRaw<
    Array<{ column_name: string; sequence_name: string | null }>
  >(Prisma.sql`
    SELECT
      a.attname AS column_name,
      pg_get_serial_sequence(quote_ident(c.relname), a.attname) AS sequence_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relname = ${pgTable}
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND pg_get_serial_sequence(quote_ident(c.relname), a.attname) IS NOT NULL
  `);

  let synced = 0;
  for (const row of sequences) {
    if (!row.sequence_name) continue;
    await db.$executeRawUnsafe(`
      SELECT setval(
        '${row.sequence_name.replace(/'/g, "''")}',
        COALESCE((SELECT MAX("${row.column_name}") FROM "${pgTable}"), 1),
        (SELECT MAX("${row.column_name}") IS NOT NULL FROM "${pgTable}")
      )
    `);
    synced += 1;
  }
  return synced;
}

export function plannedInsertCount(sourceCount: number, destinationCountBefore: number): number {
  return Math.max(0, sourceCount - destinationCountBefore);
}

export function printDryRunTableReport(
  label: string,
  sourceCount: number,
  destinationCount: number,
  elapsedMs: number,
  remaining: number
) {
  const willInsert = plannedInsertCount(sourceCount, destinationCount);
  console.log(label);
  console.log(`Source: ${sourceCount.toLocaleString()}`);
  console.log(`Destination: ${destinationCount.toLocaleString()}`);
  console.log(`Will insert: ${willInsert.toLocaleString()}`);
  console.log(`  remaining tables: ${remaining} | ${formatDuration(elapsedMs)}`);
  console.log("");
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${minutes}m ${rem.toFixed(0)}s`;
}

export function formatRowsPerSecond(rows: number, ms: number): string {
  if (ms <= 0) return "n/a";
  return `${(rows / (ms / 1000)).toFixed(1)} rows/sec`;
}

export function printFinalReport(summary: MigrationSummary) {
  console.log("\n=== Migration summary ===");
  console.log(`Mode: ${summary.dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Tables ${summary.dryRun ? "checked" : "processed"}: ${summary.tablesProcessed}`);
  if (summary.tablesSkipped > 0) {
    console.log(`Tables skipped (resume): ${summary.tablesSkipped}`);
  }
  console.log(`Rows in source: ${summary.totalSourceRows.toLocaleString()}`);
  console.log(`Rows in destination: ${summary.totalDestinationRows.toLocaleString()}`);
  console.log(`Rows to insert: ${summary.totalRowsToInsert.toLocaleString()}`);
  if (!summary.dryRun) {
    console.log(`Total rows inserted: ${summary.totalRowsMigrated.toLocaleString()}`);
    console.log(`Throughput: ${formatRowsPerSecond(summary.totalRowsMigrated, summary.elapsedMs)}`);
  }
  console.log(`Elapsed: ${formatDuration(summary.elapsedMs)}`);

  if (!summary.dryRun) {
    console.log("\nVerification:");
    for (const result of summary.tableResults) {
      const status = result.sourceCount === result.destinationCountAfter ? "OK" : "MISMATCH";
      console.log(
        `  [${status}] ${result.label}: source=${result.sourceCount.toLocaleString()} dest=${result.destinationCountAfter.toLocaleString()} inserted=${result.rowsInserted.toLocaleString()}`
      );
    }
  }

  if (summary.warnings.length > 0) {
    console.log("\nWarnings:");
    for (const warning of summary.warnings) {
      console.log(`  - ${warning}`);
    }
  }
}

export class MigrationAbortError extends Error {
  constructor(
    message: string,
    readonly table: TablePlanEntry,
    readonly row?: Record<string, unknown>
  ) {
    super(message);
    this.name = "MigrationAbortError";
  }
}
