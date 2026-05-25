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
        className="overflow-hidden border border-line-500 bg-white"
      >
        <div className="hidden grid-cols-[5.5rem_minmax(18rem,1.7fr)_9rem_7rem_10rem] border-b border-court-900 bg-court-900 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-white/70 lg:grid">
          <span>Rank</span><span>Athlete</span><span>Height</span><span>Position</span><span>Rating</span>
        </div>
        {!players.length ? <div className="p-6 text-ink-500">No eligible players match this view yet.</div> : null}
        {players.map((player, index) => (
          <motion.div
            key={player.playerId}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="grid gap-3 border-b border-line-500 px-4 py-4 transition last:border-b-0 hover:bg-paper-500 lg:grid-cols-[5.5rem_minmax(18rem,1.7fr)_9rem_7rem_10rem] lg:items-center"
          >
            <span>
              <strong className="block text-[2rem] font-black leading-none text-court-900">#{player.rank}</strong>
            </span>
            <Link href={getPlayerProfileHref(player)} className="grid grid-cols-[auto_1fr] items-center gap-3">
              <span className="grid size-11 place-items-center overflow-hidden border border-court-900 bg-court-900 font-display font-extrabold text-gold-500">
                {player.photoUrl ? <img src={player.photoUrl} alt="" className="h-full w-full object-cover" /> : initials(player.displayName)}
              </span>
              <span>
                <strong className="block text-lg font-black leading-tight text-court-900">{player.displayName}</strong>
                <small className="block text-sm font-semibold text-court-500">{player.currentTeam}</small>
                <small className="block text-xs uppercase tracking-[0.08em] text-court-400">{player.city}</small>
              </span>
            </Link>
            <span className="text-sm font-semibold text-court-700">{formatHeight(player.heightCm)}</span>
            <span>{player.position ? <span className="border border-line-500 bg-paper-500 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.08em] text-court-700">{player.position}</span> : <span className="text-court-400">Not listed</span>}</span>
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
