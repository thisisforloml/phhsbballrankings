import Link from "next/link";
import type { PublicLeagueRow } from "@/lib/public-site-data";
import { VerifiedBadge } from "@/components/ui";

export function LeagueCard({ league }: { league: PublicLeagueRow }) {
  return (
    <Link href={`/leagues/${league.id}`} className="group grid min-h-full border border-line-500 bg-white p-5 transition hover:border-court-900 hover:bg-paper-500">
      <div className="flex items-start justify-between gap-4">
        <span className="border border-court-900 bg-court-900 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-white">
          {league.ageGroup} {league.gender}
        </span>
        {league.isVerified ? <VerifiedBadge label="" /> : null}
      </div>
      <h2 className="mt-5 font-display text-3xl font-black leading-tight text-court-900 group-hover:text-hardwood-600">{league.name}</h2>
      <p className="mt-2 text-sm font-semibold text-court-500">{league.city}, {league.region}</p>
      <div className="mt-6 grid grid-cols-3 border-y border-line-500">
        <LeagueMetric label="Teams" value={league.teamCount} />
        <LeagueMetric label="Games" value={league.gameCount} />
        <LeagueMetric label="Quality" value={league.qualityScore} />
      </div>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-court-500">Open competition hub</p>
    </Link>
  );
}

function LeagueMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="border-r border-line-500 py-4 pr-3 last:border-r-0 last:pl-3 [&:not(:first-child)]:pl-3">
      <strong className="block font-display text-stat-sm font-black leading-none text-court-900">{value}</strong>
      <small className="mt-1 block text-[0.62rem] font-black uppercase tracking-[0.12em] text-court-400">{label}</small>
    </span>
  );
}

