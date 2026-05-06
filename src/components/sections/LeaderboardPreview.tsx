"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { AgeGroup, Gender, Player } from "@/lib/mock-data";
import { formatPlayerName } from "@/lib/mock-data";
import { PlayerAvatar, RatingBadge, StarRating } from "@/components/ui";

const stat = (value?: number) => value === undefined ? "â€”" : value;

export function LeaderboardPreview({
  players,
  ageGroup,
  gender,
  showPositionRank = false
}: {
  players: Player[];
  ageGroup: AgeGroup;
  gender?: Gender;
  showPositionRank?: boolean;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${ageGroup}-${gender ?? "All"}-${players.length}-${showPositionRank}`}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -24 }}
        className="overflow-hidden rounded-lg border border-surface-200 bg-white shadow-sm"
      >
        <div className="hidden grid-cols-[5rem_minmax(13rem,1.5fr)_5rem_minmax(9rem,1fr)_8rem_6rem_6rem_4rem_4rem_4rem] border-b border-surface-200 px-4 py-3 font-mono text-mono-sm uppercase text-ink-500 lg:grid">
          <span>Rank</span><span>Player</span><span>Pos</span><span>School</span><span>City</span><span>Rating</span><span>Stars</span><span>PPG</span><span>APG</span><span>RPG</span>
        </div>
        {!players.length ? <div className="p-6 text-ink-500">No eligible players match this view yet.</div> : null}
        {players.map((player, index) => (
          <motion.div
            key={player.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            tabIndex={0}
            className="group grid gap-3 border-b border-l-0 border-surface-200 px-4 py-4 transition-all duration-150 last:border-b-0 hover:border-l-[3px] hover:border-l-navy-800 hover:bg-navy-50 focus:border-l-[3px] focus:border-l-navy-800 focus:bg-navy-50 lg:grid-cols-[5rem_minmax(13rem,1.5fr)_5rem_minmax(9rem,1fr)_8rem_6rem_6rem_4rem_4rem_4rem] lg:items-center"
          >
            <span className="font-mono">
              <strong className="block text-lg text-navy-800">#{player.nationalRank}</strong>
              {showPositionRank && player.position ? <small className="block text-ink-500">{player.position} #{player.positionRank ?? index + 1}</small> : null}
            </span>
            <Link href={`/players/${player.id}`} className="grid grid-cols-[auto_1fr] items-center gap-3">
              <PlayerAvatar player={player} size="sm" />
              <span>
                <strong className="block text-ink-900">{formatPlayerName(player)}</strong>
                <small className="text-ink-500">{player.city} · {player.region}</small>
              </span>
            </Link>
            <span>{player.position ? <span className="rounded-full bg-surface-100 px-2.5 py-1 font-mono text-mono-sm text-ink-600">{player.position}</span> : null}</span>
            <span className="truncate text-ink-600" title={player.school}>{player.school ?? "â€”"}</span>
            <span className="text-ink-600">{player.city}</span>
            <RatingBadge rating={player.rating} />
            <StarRating stars={player.stars} />
            <span className="font-display text-stat-sm text-ink-900">{stat(player.avgPoints)}</span>
            <span className="font-display text-stat-sm text-ink-900">{stat(player.avgAssists)}</span>
            <span className="font-display text-stat-sm text-ink-900">{stat(player.avgRebounds)}</span>
          </motion.div>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
