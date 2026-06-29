"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { HomeLeaderboardRow } from "@/lib/public-site-data";
import { formatBoardRank } from "@/lib/public-rank-display";
import { formatHeight, getPlayerProfileHref } from "@/lib/format";
import { getProgramAbbreviation } from "@/lib/uaap-school-display";
import { StarRating } from "@/components/ui";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function LeaderboardPreview({ players }: { players: HomeLeaderboardRow[] }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={players.map((player) => player.playerId).join("-")}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -24 }}
        className="overflow-hidden rounded-sm border border-white/[0.08] bg-scout-800/80"
      >
        <div className="hidden grid-cols-[4rem_minmax(0,1fr)_5rem] gap-3 border-b border-white/[0.08] px-4 py-2.5 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-scout-500 lg:grid">
          <span>Rank</span>
          <span>Player</span>
          <span className="text-right">RTG</span>
        </div>
        {!players.length ? <div className="p-6 text-scout-500">No eligible players match this view yet.</div> : null}
        {players.map((player, index) => (
          <motion.div
            key={player.playerId}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Link
              href={getPlayerProfileHref(player)}
              className="grid grid-cols-[4rem_minmax(0,1fr)_5rem] items-center gap-3 border-b border-white/[0.06] px-4 py-3 transition last:border-b-0 hover:bg-scout-800"
            >
              <span
                className={`font-numeric text-lg font-normal leading-none ${
                  player.rank <= 3 ? "text-scout-orange-bright" : "text-scout-500"
                }`}
              >
                {formatBoardRank(player.rank)}
              </span>
              <span className="grid min-w-0 grid-cols-[auto_1fr] items-center gap-3">
                <span className="grid size-10 place-items-center overflow-hidden rounded-sm border border-white/10 bg-scout-700 font-display text-sm font-bold text-scout-orange-bright">
                  {player.photoUrl ? (
                    <img src={player.photoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials(player.displayName)
                  )}
                </span>
                <span className="min-w-0">
                  <strong className="block truncate text-sm font-bold leading-tight text-scout-50">{player.displayName}</strong>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    {player.position ? (
                      <span className="rounded-sm border border-white/10 bg-scout-900/50 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-scout-500">
                        {player.position}
                      </span>
                    ) : null}
                    <span className="truncate text-[0.65rem] font-semibold text-scout-500">
                      {getProgramAbbreviation(player.currentTeam)}
                    </span>
                    {player.heightCm ? (
                      <span className="text-[0.65rem] font-semibold text-scout-500">{formatHeight(player.heightCm)}</span>
                    ) : null}
                  </span>
                </span>
              </span>
              <span className="text-right">
                <span className="font-numeric block text-sm font-normal italic text-scout-50">{player.rating.toFixed(1)}</span>
                <span className="mt-0.5 flex justify-end">
                  <StarRating stars={player.starRating as 1 | 2 | 3 | 4 | 5} />
                </span>
              </span>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
