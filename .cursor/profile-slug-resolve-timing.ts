import { performance } from "node:perf_hooks";
import { prisma } from "../src/lib/prisma";
import { slugify } from "../src/lib/format";

async function main() {
  const t0 = performance.now();
  const candidates = await prisma.player.findMany({
    where: { deletedAt: null },
    select: { id: true, displayName: true },
  });
  const queryMs = Math.round(performance.now() - t0);
  const t1 = performance.now();
  const slug = "jude-eriobu";
  const matches = candidates.filter((p) => slugify(p.displayName) === slug);
  const cpuMs = Math.round(performance.now() - t1);
  console.log(JSON.stringify({ candidates: candidates.length, queryMs, slugifyCpuMs: cpuMs, matches: matches.length }, null, 2));
  await prisma.$disconnect();
}

main();
