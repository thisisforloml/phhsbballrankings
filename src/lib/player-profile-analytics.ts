/**
 * Client-safe analytics helpers for player profiles.
 * No Prisma, fs, or other server-only imports — safe for "use client" components.
 */

export type BenchmarkGranularity = "week" | "month";

/**
 * Minimum logged minutes for a game to count toward league benchmark averages.
 * NBA/NCAA leaderboards use season game-count rules; for per-game league pools,
 * a ~10-minute floor is a common way to drop garbage-time rows (see rotation-minute
 * filters in college/NBA rate-stat practice). Youth halves are shorter, so 10 min
 * is a practical HS/college single-game floor when minutes are logged.
 */
export const BENCHMARK_QUALIFYING_MINUTES = 10;

export function gameQualifiesForBenchmark(minutes: number | null): boolean {
  return minutes !== null && minutes >= BENCHMARK_QUALIFYING_MINUTES;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const FOUR_MONTHS_MS = 122 * DAY_MS;

function startOfUtcWeek(ms: number) {
  const date = new Date(ms);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + diff);
}

export function benchmarkGranularityFromSpan(minMs: number, maxMs: number): BenchmarkGranularity {
  return maxMs - minMs < FOUR_MONTHS_MS ? "week" : "month";
}

export function periodKeyForDate(iso: string, granularity: BenchmarkGranularity): string {
  const ms = new Date(iso).getTime();
  if (granularity === "month") {
    const date = new Date(ms);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return new Date(startOfUtcWeek(ms)).toISOString().slice(0, 10);
}

export function benchmarkGranularityFromGames(dates: string[]): BenchmarkGranularity {
  if (dates.length < 2) return "week";
  const times = dates.map((iso) => new Date(iso).getTime());
  return benchmarkGranularityFromSpan(Math.min(...times), Math.max(...times));
}
