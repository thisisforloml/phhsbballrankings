import Link from "next/link";

import type { PublicLeagueRow } from "@/lib/public-site-data";

export function LeagueCard({ league }: { league: PublicLeagueRow }) {
  return (
    <Link href={`/leagues/${league.id}`} className="group grid gap-3 border-b border-line-500 bg-white px-3 py-3 transition last:border-b-0 hover:bg-paper-500 md:grid-cols-[minmax(18rem,1fr)_8rem_7rem_7rem_10rem] md:items-center">
      <span className="min-w-0">
        <strong className="block truncate text-base font-bold leading-tight text-court-900 group-hover:text-hardwood-600" title={league.name}>{league.name}</strong>
        <small className="mt-1 block text-xs font-semibold text-court-500">{league.city}, {league.region}</small>
      </span>
      <span className="w-fit border border-court-900 bg-court-900 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-white">
          {league.ageGroup} {league.gender}
      </span>
      <LeagueMetric label="Teams" value={league.teamCount} />
      <LeagueMetric label="Games" value={league.gameCount} />
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-court-500 md:text-right">View league</span>
    </Link>
  );
}

function LeagueMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="md:text-center">
      <strong className="block font-display text-stat-sm font-bold leading-none text-court-900">{value}</strong>
      <small className="mt-1 block text-[0.62rem] font-bold uppercase tracking-[0.12em] text-court-400">{label}</small>
    </span>
  );
}
