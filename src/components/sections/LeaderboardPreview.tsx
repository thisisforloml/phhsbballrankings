"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { HomeLeaderboardRow } from "@/lib/public-site-data";
import { formatHeight, getPlayerProfileHref } from "@/lib/format";
import { RatingBadge, StarRating } from "@/components/ui";

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
        className="overflow-hidden rounded-lg border border-surface-200 bg-white shadow-sm"
      >
        <div className="hidden grid-cols-[5rem_minmax(18rem,1.7fr)_9rem_7rem_9rem] border-b border-surface-200 px-4 py-3 font-mono text-mono-sm uppercase text-ink-500 lg:grid">
          <span>Rank</span><span>Athlete</span><span>Height</span><span>Position</span><span>Rating</span>
        </div>
        {!players.length ? <div className="p-6 text-ink-500">No eligible players match this view yet.</div> : null}
        {players.map((player, index) => (
          <motion.div
            key={player.playerId}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="grid gap-3 border-b border-l-0 border-surface-200 px-4 py-4 transition-all duration-150 last:border-b-0 hover:border-l-[3px] hover:border-l-navy-800 hover:bg-navy-50 lg:grid-cols-[5rem_minmax(18rem,1.7fr)_9rem_7rem_9rem] lg:items-center"
          >
            <span className="font-mono">
              <strong className="block text-lg text-navy-800">#{player.rank}</strong>
            </span>
            <Link href={getPlayerProfileHref(player)} className="grid grid-cols-[auto_1fr] items-center gap-3">
              <span className="grid size-11 place-items-center overflow-hidden rounded-full border border-amber-500 bg-navy-50 font-display font-extrabold text-navy-800">
                {player.photoUrl ? <img src={player.photoUrl} alt="" className="h-full w-full object-cover" /> : initials(player.displayName)}
              </span>
              <span>
                <strong className="block text-ink-900">{player.displayName}</strong>
                <small className="block text-ink-500">{player.city}</small>
                <small className="block text-ink-500">{player.currentTeam}</small>
              </span>
            </Link>
            <span className="text-ink-700">{formatHeight(player.heightCm)}</span>
            <span>{player.position ? <span className="rounded-full bg-surface-100 px-2.5 py-1 font-mono text-mono-sm text-ink-600">{player.position}</span> : <span className="text-ink-400">Not listed</span>}</span>
            <span className="flex flex-wrap items-center gap-2">
              <RatingBadge rating={player.rating} />
              <StarRating stars={player.starRating} />
            </span>
          </motion.div>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
