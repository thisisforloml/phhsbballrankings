"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import type { PublicLeagueRow } from "@/lib/public-site-data";
import { VerifiedBadge } from "@/components/ui";

function QualityBar({ value }: { value: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const width = Math.max(0, Math.min(100, value));

  return (
    <div ref={ref} className="mt-6 h-2 overflow-hidden rounded-full bg-surface-100">
      <motion.span initial={{ width: 0 }} animate={{ width: inView ? `${width}%` : 0 }} transition={{ duration: 0.8 }} className="block h-full rounded-full bg-navy-800" />
    </div>
  );
}

export function LeagueGrid({ leagues }: { leagues: PublicLeagueRow[] }) {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {leagues.map((league) => (
        <Link key={league.id} href={`/leagues/${league.id}`} className="rounded-lg border border-surface-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-[3px] hover:border-navy-800 hover:shadow-navy" style={{ borderTopColor: "#0F2044", borderTopWidth: 4 }}>
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-display text-3xl font-bold text-ink-900">{league.name}</h2>
          </div>
          <p className="mt-2 font-mono text-mono-sm uppercase text-ink-500">{league.city}, {league.region}</p>
          <p className="mt-1 text-ink-600">{league.ageGroup} {league.gender}</p>
          {league.isVerified ? <div className="mt-4"><VerifiedBadge label="Verified League" /></div> : null}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <span><strong className="block font-display text-stat-sm text-navy-800">{league.teamCount}</strong><small className="font-mono text-mono-sm text-ink-500">Programs / Teams</small></span>
            <span><strong className="block font-display text-stat-sm text-navy-800">{league.gameCount}</strong><small className="font-mono text-mono-sm text-ink-500">Official Games</small></span>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <div className="min-w-0 flex-1"><QualityBar value={league.qualityScore} /></div>
            <strong className="font-display text-stat-sm text-navy-800">{league.qualityScore}</strong>
          </div>
        </Link>
      ))}
    </div>
  );
}


