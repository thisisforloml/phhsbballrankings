"use client";

import { motion } from "framer-motion";
import type { Player } from "@/lib/mock-data";
import { formatPlayerName } from "@/lib/mock-data";
import { PlayerAvatar, RatingBadge, StarRating, StatCard, VerifiedBadge } from "@/components/ui";

export function PlayerHero({ player }: { player: Player }) {
  const graduationClass = player.birthYear ? player.birthYear + 18 : null;
  const positionText = player.position ? `${player.position} · ` : "";
  const rankCards = [
    ["National Rank", `#${player.nationalRank}`],
    ["Regional Rank", `#${player.regionalRank}`],
    ["Position Rank", player.positionRank && player.position ? `${player.position} #${player.positionRank}` : "â€”"],
    ["City Rank", `#${player.cityRank}`]
  ];

  return (
    <section className="hero-brand pt-32 text-white">
      <div className="container-px grid gap-10 py-14 lg:grid-cols-[1fr_auto_0.85fr] lg:items-center">
        <div className="flex flex-col gap-5">
          <PlayerAvatar player={player} size="lg" />
          <div>
            <h1 className="font-display text-stat-md">{formatPlayerName(player)}</h1>
            <p className="mt-3 text-white/75">{positionText}{player.city} · {player.region} · {player.ageGroup}</p>
            <div className="mt-3 flex flex-wrap gap-2 font-mono text-mono-sm uppercase text-white/65">
              <span>{player.birthYear ? `Born ${player.birthYear}` : "Birth year not on record"}</span>
              {graduationClass ? <span>Class of {graduationClass}</span> : null}
              <span>{player.ageGroup} bracket</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {player.isVerified ? <VerifiedBadge /> : <span className="rounded-full bg-white/15 px-3 py-1 font-mono text-mono-sm uppercase">Unverified</span>}
            <span className="font-mono text-mono-sm uppercase text-white/75"><span className="text-amber-500">#{player.nationalRank}</span> Nationally</span>
          </div>
        </div>
        <span className="hidden h-52 w-px bg-white/20 lg:block" aria-hidden="true" />
        <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} className="text-left lg:text-right">
          <RatingBadge rating={player.rating} large />
          <div className="mt-3 flex lg:justify-end"><StarRating stars={player.stars} /></div>
          <p className="mt-3 font-mono text-mono-sm uppercase text-white/60">out of 100</p>
        </motion.div>
      </div>
      <div className="container-px grid gap-4 pb-10 md:grid-cols-3">
        <StatCard label="PPG" value={player.avgPoints} />
        <StatCard label="RPG" value={player.avgRebounds ?? "â€”"} />
        <StatCard label="APG" value={player.avgAssists ?? "â€”"} />
      </div>
      <div className="container-px grid gap-4 pb-10 md:grid-cols-4">
        {rankCards.map(([label, value]) => (
          <StatCard key={label} label={label} value={value} />
        ))}
      </div>
    </section>
  );
}
