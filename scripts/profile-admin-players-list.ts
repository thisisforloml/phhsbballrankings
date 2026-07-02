import { performance } from "node:perf_hooks";
import { ProgramType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadManagedPlayerListPage, ADMIN_PLAYER_PAGE_SIZE } from "@/lib/admin/load-managed-player-list";
import { managedPlayerListSelect } from "@/lib/admin/serialize-managed-player";

async function time<T>(label: string, fn: () => Promise<T>) {
  const start = performance.now();
  const result = await fn();
  const ms = Math.round(performance.now() - start);
  return { label, ms, result };
}

async function main() {
  const runs = 3;
  const samples: Array<{ label: string; ms: number; rows?: number }> = [];

  for (let i = 0; i < runs; i++) {
    const full = await time("LEGACY full list findMany", () =>
      prisma.player.findMany({
        where: { deletedAt: null },
        select: managedPlayerListSelect,
        orderBy: { displayName: "asc" },
      }),
    );
    samples.push({ label: full.label, ms: full.ms, rows: full.result.length });

    const page = await time("paginated SQL page load", () =>
      loadManagedPlayerListPage({ search: "", program: "All", gender: "All", ageBracket: "All" }, 1),
    );
    samples.push({ label: page.label, ms: page.ms, rows: page.result.players.length });

    const filtered = await time("paginated SQL + gender=BOYS", () =>
      loadManagedPlayerListPage({ search: "", program: "All", gender: "BOYS", ageBracket: "All" }, 1),
    );
    samples.push({ label: filtered.label, ms: filtered.ms, rows: filtered.result.players.length });

    const programs = await time("school programs (edit panel)", () =>
      prisma.program.findMany({
        where: { deletedAt: null, type: ProgramType.SCHOOL },
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
      }),
    );
    samples.push({ label: programs.label, ms: programs.ms, rows: programs.result.length });
  }

  const avg = (label: string) => {
    const matching = samples.filter((sample) => sample.label === label);
    const mean = Math.round(matching.reduce((sum, sample) => sum + sample.ms, 0) / matching.length);
    return { label, ms: mean, rows: matching[0]?.rows };
  };

  console.log("Admin players list benchmark (avg of", runs, "warm runs)");
  console.log("Page size:", ADMIN_PLAYER_PAGE_SIZE);
  console.table([
    avg("LEGACY full list findMany"),
    avg("paginated SQL page load"),
    avg("paginated SQL + gender=BOYS"),
    avg("school programs (edit panel)"),
  ]);

  const pageAvg = avg("paginated SQL page load").ms;
  const programsAvg = avg("school programs (edit panel)").ms;
  console.log("\nEstimated initial RSC load (page + programs, parallel):", Math.max(pageAvg, programsAvg), "ms");

  const isolated = await time("isolated paginated load", () =>
    loadManagedPlayerListPage({ search: "", program: "All", gender: "All", ageBracket: "All" }, 1),
  );
  console.log("Isolated run:", isolated.ms, "ms");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
