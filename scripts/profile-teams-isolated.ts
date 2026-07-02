import { performance } from "node:perf_hooks";
import { prisma } from "../src/lib/prisma";
import { loadManagedTeams, loadManagedTeamsActivityBundle, loadManagedTeamsBaseRows } from "../src/lib/admin/load-managed-teams";

async function main() {
  for (let i = 1; i <= 5; i++) {
    const start = performance.now();
    await loadManagedTeams();
    console.log(`loadManagedTeams run ${i}: ${(performance.now() - start).toFixed(1)}ms`);
  }

  const baseStart = performance.now();
  await loadManagedTeamsBaseRows();
  console.log(`base only: ${(performance.now() - baseStart).toFixed(1)}ms`);

  const bundleStart = performance.now();
  await loadManagedTeamsActivityBundle();
  console.log(`bundle only: ${(performance.now() - bundleStart).toFixed(1)}ms`);

  await prisma.$disconnect();
}

main();
