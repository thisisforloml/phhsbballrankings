"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { HomeData, PublicAgeGroup, PublicGender } from "@/lib/public-site-data";
import { HeroSection, LeaderboardPreview, RatingExplainer } from "@/components/sections";
import { EmptyState } from "@/components/ui";

const ageGroups: PublicAgeGroup[] = ["U13", "U16", "U19"];
const genders: PublicGender[] = ["Boys", "Girls"];

export function HomeClient({ data }: { data: HomeData }) {
  const [ageGroup, setAgeGroup] = useState<PublicAgeGroup>("U19");
  const [gender, setGender] = useState<PublicGender>("Boys");
  const rankedPlayers = useMemo(() => {
    if (ageGroup !== "U19") return [];
    return gender === "Girls" ? data.leaderboards.girls : data.leaderboards.boys;
  }, [ageGroup, data.leaderboards.boys, data.leaderboards.girls, gender]);

  return (
    <main>
      <HeroSection data={data} />
      <section className="container-px border-y border-surface-200 bg-white py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {ageGroups.map((group) => (
              <button key={group} onClick={() => setAgeGroup(group)} className={`rounded-full border px-5 py-2 font-mono text-mono-sm transition ${ageGroup === group ? "border-navy-800 bg-navy-800 text-white" : "border-surface-300 bg-white text-ink-600 hover:border-navy-800 hover:text-navy-800"}`}>
                {group}
              </button>
            ))}
          </div>
          <div className="inline-flex w-fit rounded-full border border-surface-300 bg-surface-50 p-1">
            {genders.map((item) => (
              <button key={item} onClick={() => setGender(item)} className={`rounded-full px-5 py-2 font-semibold transition ${gender === item ? "bg-navy-800 text-white" : "text-ink-600 hover:text-navy-800"}`}>
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="container-px section-y bg-surface-50">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label">Leaderboard Preview</p>
            <h2 className="mt-3 font-display text-stat-lg text-ink-900">Top 10 {ageGroup} {gender}</h2>
          </div>
          <Link href={`/rankings?gender=${gender}&age=${ageGroup}`} className="font-mono text-mono-sm uppercase text-navy-800">View Full Rankings</Link>
        </div>
        {rankedPlayers.length ? <LeaderboardPreview players={rankedPlayers} /> : <EmptyState icon="players" title="No players ranked yet" />}
      </section>
      <RatingExplainer />
    </main>
  );
}