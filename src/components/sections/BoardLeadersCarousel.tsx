"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { HomeData, HomeLeaderboardRow, PublicAgeGroup, PublicGender } from "@/lib/public-site-data";
import { getPlayerProfileHref } from "@/lib/format";
import { getProgramDisplayName } from "@/lib/uaap-school-display";
import { RatingBadge, StarRating } from "@/components/ui";

const ageGroups: PublicAgeGroup[] = ["U13", "U16", "U19"];
const genders: PublicGender[] = ["Boys", "Girls"];

function leaderForBoard(data: HomeData, ageGroup: PublicAgeGroup, gender: PublicGender) {
  const board = data.leaderboardsByAge[ageGroup];
  const rows = gender === "Girls" ? board.girls : board.boys;
  return rows[0] ?? null;
}

function BoardLeaderSlide({ leader }: { leader: HomeLeaderboardRow }) {
  return (
    <article className="min-w-[min(100%,22rem)] snap-center border border-line-500 bg-white p-5 shadow-[6px_6px_0_#d97706]">
      <div className="mb-3 flex items-center justify-between border-b border-line-500 pb-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-hardwood-600">
          #{leader.rank} {leader.ageGroup} {leader.gender}
        </p>
        <span className="bg-court-900 px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.1em] text-white">Board Leader</span>
      </div>
      <RatingBadge rating={leader.rating} large />
      <h3 className="mt-2 font-display text-3xl font-black leading-none text-court-900">
        <Link href={getPlayerProfileHref(leader)}>{leader.displayName}</Link>
      </h3>
      <p className="mt-2 text-sm font-semibold text-court-600">{getProgramDisplayName(leader.currentTeam)}</p>
      <div className="mt-3">
        <StarRating stars={leader.starRating} />
      </div>
      <Link href={getPlayerProfileHref(leader)} className="button secondary mt-5 inline-flex">
        View Profile
      </Link>
    </article>
  );
}

export function BoardLeadersCarousel({ data }: { data: HomeData }) {
  const [ageGroup, setAgeGroup] = useState<PublicAgeGroup>("U19");
  const [gender, setGender] = useState<PublicGender>("Boys");

  const leader = useMemo(() => leaderForBoard(data, ageGroup, gender), [ageGroup, data, gender]);
  const featured = useMemo(() => {
    const picks: HomeLeaderboardRow[] = [];
    for (const age of ageGroups) {
      for (const item of genders) {
        const row = leaderForBoard(data, age, item);
        if (row) picks.push(row);
      }
    }
    return picks.length ? picks : data.boardLeaders;
  }, [data]);

  return (
    <section className="container-px border-b border-line-500 bg-paper-500 py-7 md:py-9">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-hardwood-600">National board leaders</p>
          <h2 className="mt-2 font-display text-3xl font-black text-court-900 md:text-4xl">Top-ranked players by board</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {ageGroups.map((group) => (
            <button
              key={group}
              type="button"
              onClick={() => setAgeGroup(group)}
              className={`border px-4 py-2 text-xs font-black uppercase tracking-[0.1em] transition ${ageGroup === group ? "border-court-900 bg-court-900 text-white" : "border-line-500 bg-white text-court-600 hover:border-court-900 hover:text-court-900"}`}
            >
              {group}
            </button>
          ))}
          {genders.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setGender(item)}
              className={`border px-4 py-2 text-xs font-black uppercase tracking-[0.1em] transition ${gender === item ? "border-court-900 bg-court-900 text-white" : "border-line-500 bg-white text-court-600 hover:border-court-900 hover:text-court-900"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      {leader ? (
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
          <BoardLeaderSlide leader={leader} />
          {featured
            .filter((row) => row.playerId !== leader.playerId)
            .slice(0, 4)
            .map((row) => (
              <BoardLeaderSlide key={`${row.playerId}-${row.ageGroup}-${row.gender}`} leader={row} />
            ))}
        </div>
      ) : (
        <div className="border border-line-500 bg-white px-6 py-10 text-center text-sm font-semibold text-court-600">
          Board leaders will appear here as verified rankings are published for this age group.
        </div>
      )}
    </section>
  );
}
