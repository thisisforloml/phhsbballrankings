"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { HomeData, PublicAgeGroup, PublicGender } from "@/lib/public-site-data";
import { HeroSection, LeaderboardPreview, RatingExplainer } from "@/components/sections";
import { EmptyState } from "@/components/ui";
import { SectionHeader } from "@/components/public/SectionHeader";

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
      <section className="container-px border-y border-line-500 bg-white py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {ageGroups.map((group) => (
              <button key={group} onClick={() => setAgeGroup(group)} className={`border px-5 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${ageGroup === group ? "border-court-900 bg-court-900 text-white" : "border-line-500 bg-white text-court-600 hover:border-court-900 hover:text-court-900"}`}>
                {group}
              </button>
            ))}
          </div>
          <div className="inline-flex w-fit border border-line-500 bg-paper-500 p-1">
            {genders.map((item) => (
              <button key={item} onClick={() => setGender(item)} className={`px-5 py-2 text-sm font-black uppercase tracking-[0.08em] transition ${gender === item ? "bg-court-900 text-white" : "text-court-600 hover:text-court-900"}`}>
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="container-px section-y bg-paper-500">
        <div className="mb-8">
          <SectionHeader
            eyebrow="Recruiting Board"
            title={`Top 10 ${ageGroup} ${gender}`}
            description="A quick scan of the current public board, built from official game submissions and Formula v1 ratings."
            action={<Link href={`/rankings?gender=${gender}&age=${ageGroup}`} className="button secondary">View Full Rankings</Link>}
          />
        </div>
        {rankedPlayers.length ? <LeaderboardPreview players={rankedPlayers} /> : <EmptyState icon="players" title="No players ranked yet" />}
      </section>
      <RatingExplainer />
    </main>
  );
}
