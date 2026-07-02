"use client";

import Link from "next/link";
import { useMemo } from "react";

import { getPlayerProfileHref } from "@/lib/format";
import { formatBoardRank } from "@/lib/public-rank-display";
import type { HomeData, HomeLeaderboardRow, PublicAgeGroup, PublicGender } from "@/lib/public-site-data";
import { getProgramAbbreviation } from "@/lib/uaap-school-display";

const ageGroups: PublicAgeGroup[] = ["U13", "U16", "U19"];
const genders: PublicGender[] = ["Boys", "Girls"];

function leaderForBoard(data: HomeData, ageGroup: PublicAgeGroup, gender: PublicGender) {
  const board = data.leaderboardsByAge[ageGroup];
  const rows = gender === "Girls" ? board.girls : board.boys;
  return rows[0] ?? null;
}

/** Compact cross-board leaders strip — embedded in the National Board chapter. */
export function DivisionLeadersStrip({
  data,
  ageGroup,
  gender,
}: {
  data: HomeData;
  ageGroup: PublicAgeGroup;
  gender: PublicGender;
}) {
  const others = useMemo(() => {
    const picks: HomeLeaderboardRow[] = [];
    for (const age of ageGroups) {
      for (const item of genders) {
        if (age === ageGroup && item === gender) continue;
        const row = leaderForBoard(data, age, item);
        if (row) picks.push(row);
      }
    }
    if (!picks.length && data.boardLeaders.length) {
      return data.boardLeaders.filter(
        (row) => !(row.ageGroup === ageGroup && row.gender === gender && row.rank === 1)
      );
    }
    return picks;
  }, [ageGroup, data, gender]);

  if (!others.length) return null;

  return (
    <div className="mb-5 border-b border-white/[0.06] pb-5">
      <p className="mb-3 text-xs font-semibold text-scout-500">Leaders on other boards</p>
      <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1">
        {others.map((leader) => (
          <Link
            key={`${leader.playerId}-${leader.ageGroup}-${leader.gender}`}
            href={getPlayerProfileHref(leader)}
            className="min-w-[11rem] snap-start rounded-sm border border-white/[0.08] bg-scout-900/60 px-3 py-2.5 transition hover:border-scout-orange/40"
          >
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-scout-orange-bright">
              {leader.ageGroup} {leader.gender}
            </p>
            <p className="mt-1 truncate text-xs font-bold uppercase text-scout-50">{leader.displayName}</p>
            <p className="mt-0.5 flex items-baseline justify-between gap-2 text-[0.65rem] font-semibold text-scout-500">
              <span className="truncate">{getProgramAbbreviation(leader.currentTeam)}</span>
              <span className="font-numeric shrink-0 italic text-scout-50">{leader.rating.toFixed(1)}</span>
            </p>
            <p className="mt-0.5 font-numeric text-[0.65rem] text-scout-500">{formatBoardRank(leader.rank)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
