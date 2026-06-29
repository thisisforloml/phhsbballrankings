#!/usr/bin/env tsx
/**
 * Copy all application data from local PostgreSQL to Supabase.
 *
 * Safety: data-only — never runs migrations, truncates, deletes, or schema changes.
 *
 * Required env:
 *   DATABASE_URL_LOCAL
 *   DATABASE_URL_SUPABASE
 */
import { loadMigrationEnvVars, printMigrationConnectionPlan, requireDatabaseUrls } from "./migrate-local-to-supabase/env";
import type { MigrationSummary, TableMigrationResult } from "./migrate-local-to-supabase/helpers";

loadMigrationEnvVars();

async function main() {
  const helpers = await import("./migrate-local-to-supabase/helpers");
  const { MIGRATION_TABLE_PLAN } = await import("./migrate-local-to-supabase/table-plan");

  const options = helpers.parseCliArgs(process.argv.slice(2));
  const { localUrl, supabaseUrl } = requireDatabaseUrls();
  printMigrationConnectionPlan({ localUrl, supabaseUrl });

  const { localDb, supabaseDb } = helpers.createMigrationClients();

  try {
    await helpers.validateDatabaseConnections({ localDb, supabaseDb, localUrl, supabaseUrl });
    const exitCode = await runMigration(helpers, MIGRATION_TABLE_PLAN, localDb, supabaseDb, options);
    process.exitCode = exitCode;
  } catch (error) {
    console.error("\nUnexpected migration error:");
    if (error instanceof Error) {
      console.error(error.message);
      if (error.stack) console.error(error.stack);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  } finally {
    await helpers.disconnectClients(localDb, supabaseDb);
  }
}

async function runMigration(
  helpers: typeof import("./migrate-local-to-supabase/helpers"),
  MIGRATION_TABLE_PLAN: typeof import("./migrate-local-to-supabase/table-plan").MIGRATION_TABLE_PLAN,
  localDb: import("@prisma/client").PrismaClient,
  supabaseDb: import("@prisma/client").PrismaClient,
  options: ReturnType<typeof helpers.parseCliArgs>
): Promise<number> {
  const {
    MigrationAbortError,
    countTableRows,
    createInitialState,
    formatDuration,
    formatRowsPerSecond,
    loadMigrationState,
    migrateTableData,
    plannedInsertCount,
    printDryRunTableReport,
    printFinalReport,
    saveMigrationState,
    syncSequencesForTable,
  } = helpers;

  const migrationStartedAt = Date.now();
  const warnings: string[] = [];
  const tableResults: TableMigrationResult[] = [];
  let tablesProcessed = 0;
  let tablesSkipped = 0;
  let totalRowsInserted = 0;
  let totalSourceRows = 0;
  let totalDestinationRows = 0;
  let totalRowsToInsert = 0;

  const state = options.resume ? loadMigrationState() ?? createInitialState() : createInitialState();

  console.log("Peach Basket — local → Supabase data migration");
  console.log(`Mode: ${options.dryRun ? "DRY RUN (analysis only)" : "LIVE"}`);
  console.log(`Batch size: ${options.batchSize}`);
  console.log(`Resume: ${options.resume ? "yes" : "no"}`);
  console.log(`Tables: ${MIGRATION_TABLE_PLAN.length}`);
  console.log("");

  for (let index = 0; index < MIGRATION_TABLE_PLAN.length; index += 1) {
    const table = MIGRATION_TABLE_PLAN[index]!;
    const remaining = MIGRATION_TABLE_PLAN.length - index - 1;
    const tableStartedAt = Date.now();

    try {
      const sourceCount = await countTableRows(localDb, table.pgTable);
      const destinationCountBefore = await countTableRows(supabaseDb, table.pgTable);
      const rowsToInsert = plannedInsertCount(sourceCount, destinationCountBefore);

      totalSourceRows += sourceCount;
      totalDestinationRows += destinationCountBefore;
      totalRowsToInsert += rowsToInsert;

      if (!options.dryRun && destinationCountBefore > sourceCount) {
        throw new MigrationAbortError(
          `Destination row count (${destinationCountBefore}) exceeds source (${sourceCount}) for ${table.pgTable}. Aborting to avoid overwriting unknown data.`,
          table
        );
      }

      if (options.dryRun && destinationCountBefore > sourceCount) {
        warnings.push(
          `${table.label}: destination (${destinationCountBefore}) exceeds source (${sourceCount}).`
        );
      }

      const alreadyVerified =
        !options.dryRun &&
        options.resume &&
        state.completedPgTables.includes(table.pgTable) &&
        destinationCountBefore === sourceCount;

      if (alreadyVerified) {
        const elapsedMs = Date.now() - tableStartedAt;
        console.log(`Migrating ${table.label}...`);
        console.log(`  skipped (resume) — ${sourceCount.toLocaleString()} rows verified`);
        console.log(`  remaining tables: ${remaining} | ${formatDuration(elapsedMs)}`);
        console.log("");
        tablesSkipped += 1;
        tableResults.push({
          pgTable: table.pgTable,
          label: table.label,
          sourceCount,
          destinationCountBefore,
          destinationCountAfter: destinationCountBefore,
          rowsInserted: 0,
          rowsToInsert,
          elapsedMs,
          skipped: true,
        });
        continue;
      }

      if (options.dryRun) {
        const elapsedMs = Date.now() - tableStartedAt;
        printDryRunTableReport(table.label, sourceCount, destinationCountBefore, elapsedMs, remaining);
        tablesProcessed += 1;
        tableResults.push({
          pgTable: table.pgTable,
          label: table.label,
          sourceCount,
          destinationCountBefore,
          destinationCountAfter: destinationCountBefore,
          rowsInserted: 0,
          rowsToInsert,
          elapsedMs,
          skipped: false,
        });
        continue;
      }

      console.log(`Migrating ${table.label}...`);
      console.log(`Source: ${sourceCount.toLocaleString()}`);
      console.log(`Destination: ${destinationCountBefore.toLocaleString()}`);
      console.log(`Will insert: ${rowsToInsert.toLocaleString()}`);

      let rowsInserted = 0;
      let destinationCountAfter = destinationCountBefore;

      if (sourceCount > 0) {
        const migrationResult = await migrateTableData({
          localDb,
          supabaseDb,
          table,
          batchSize: options.batchSize,
        });
        rowsInserted = migrationResult.rowsInserted;
        destinationCountAfter = migrationResult.destinationCountAfter;
      } else {
        destinationCountAfter = await countTableRows(supabaseDb, table.pgTable);
      }

      if (destinationCountAfter !== sourceCount) {
        throw new MigrationAbortError(
          `Post-migration count mismatch on ${table.pgTable}: source=${sourceCount}, destination=${destinationCountAfter}`,
          table
        );
      }

      const sequencesSynced = await syncSequencesForTable(supabaseDb, table.pgTable);
      if (sequencesSynced > 0) {
        warnings.push(`${table.label}: synchronized ${sequencesSynced} PostgreSQL sequence(s).`);
      }

      const elapsedMs = Date.now() - tableStartedAt;
      totalRowsInserted += rowsInserted;
      tablesProcessed += 1;

      console.log(`  inserted: ${rowsInserted.toLocaleString()} (skipDuplicates enabled)`);
      console.log(`  verified: OK (${destinationCountAfter.toLocaleString()} rows)`);
      console.log(
        `  remaining tables: ${remaining} | ${formatDuration(elapsedMs)} | ${formatRowsPerSecond(rowsInserted, elapsedMs)}`
      );
      console.log("");

      tableResults.push({
        pgTable: table.pgTable,
        label: table.label,
        sourceCount,
        destinationCountBefore,
        destinationCountAfter,
        rowsInserted,
        rowsToInsert,
        elapsedMs,
        skipped: false,
      });

      if (!state.completedPgTables.includes(table.pgTable)) {
        state.completedPgTables.push(table.pgTable);
      }
      state.updatedAt = new Date().toISOString();
      saveMigrationState(state);
    } catch (error) {
      if (error instanceof MigrationAbortError) {
        console.error(`\nMigration aborted at ${error.table.label} (${error.table.pgTable}).`);
        console.error(error.message);
        if (error.row) {
          console.error("Row:", JSON.stringify(error.row, null, 2));
        }
        return 1;
      }

      console.error(`\nMigration failed at ${table.label} (${table.pgTable}).`);
      if (error instanceof Error) {
        console.error(error.message);
        if (error.stack) console.error(error.stack);
      } else {
        console.error(String(error));
      }
      return 1;
    }
  }

  const summary: MigrationSummary = {
    dryRun: options.dryRun,
    tablesProcessed,
    tablesSkipped,
    totalRowsMigrated: totalRowsInserted,
    totalSourceRows,
    totalDestinationRows,
    totalRowsToInsert,
    elapsedMs: Date.now() - migrationStartedAt,
    warnings,
    tableResults,
  };

  printFinalReport(summary);

  if (!options.dryRun) {
    console.log(`\nState file: scripts/reports/migrate-local-to-supabase-state.json`);
  }

  return 0;
}

void main();
