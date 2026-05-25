"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { HomeData } from "@/lib/public-site-data";
import { RatingBadge, StarRating } from "@/components/ui";
import { getPlayerProfileHref } from "@/lib/format";

function useCountUp(target: number) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let frame = 0;
    const total = 90;
    const tick = () => {
      frame += 1;
      const progress = 1 - Math.pow(1 - frame / total, 3);
      setValue(Math.round(target * Math.min(1, progress)));
      if (frame < total) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, target]);

  return { ref, value };
}

export function HeroSection({ data }: { data: HomeData }) {
  const ranked = useCountUp(data.counts.rankedPlayers);
  const leagueCount = useCountUp(data.counts.verifiedLeagues);
  const games = useCountUp(data.counts.gamesLogged);
  const leader = data.leader;

  return (
    <section className="hero-brand relative isolate overflow-hidden pt-32 text-white">
      <div className="container-px grid min-h-[calc(100vh-5rem)] items-center gap-12 py-16 lg:grid-cols-[1.15fr_0.85fr]">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-500">Philippine Youth Basketball Rankings</p>
          <h1 className="mt-5 max-w-5xl font-display text-[clamp(3.5rem,10vw,8rem)] font-black leading-none">
            The recruiting board for verified hoops.
          </h1>
          <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-white/72">
            OnCourt turns official box scores from Philippine youth competitions into player ratings, team context, and national rankings scouts can scan fast.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/rankings" className="button primary">Explore Rankings</Link>
            <Link href="/how-we-rank" className="button border-white/40 text-white hover:border-gold-500 hover:text-gold-500">How Ratings Work</Link>
          </div>
          <div className="mt-10 grid max-w-3xl grid-cols-3 border-y border-white/15">
            <span className="border-r border-white/15 py-4 pr-4">
              <strong ref={ranked.ref} className="block font-display text-stat-sm text-white">{ranked.value.toLocaleString()}</strong>
              <small className="text-xs font-bold uppercase tracking-[0.12em] text-white/58">Ranked Players</small>
            </span>
            <span className="border-r border-white/15 px-4 py-4">
              <strong ref={leagueCount.ref} className="block font-display text-stat-sm text-white">{leagueCount.value.toLocaleString()}</strong>
              <small className="text-xs font-bold uppercase tracking-[0.12em] text-white/58">Leagues Covered</small>
            </span>
            <span className="py-4 pl-4">
              <strong ref={games.ref} className="block font-display text-stat-sm text-white">{games.value.toLocaleString()}</strong>
              <small className="text-xs font-bold uppercase tracking-[0.12em] text-white/58">Official Games</small>
            </span>
          </div>
        </motion.div>
        <motion.article initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="border border-gold-500 bg-paper-500 p-6 text-court-900 shadow-[8px_8px_0_#d97706]">
          <div className="mb-5 flex items-center justify-between border-b border-line-500 pb-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-hardwood-600">Current Board Leader</p>
            <span className="bg-court-900 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-white">Live Board</span>
          </div>
          {leader ? (
            <>
              <RatingBadge rating={leader.rating} large />
              <h2 className="mt-1 font-display text-5xl font-black leading-none"><Link href={getPlayerProfileHref(leader)}>{leader.displayName}</Link></h2>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.1em]">
                <span className="border border-line-500 bg-white px-3 py-1">{leader.gender}</span>
                <span className="border border-line-500 bg-white px-3 py-1">{leader.ageGroup}</span>
                {leader.position ? <span className="border border-line-500 bg-white px-3 py-1">{leader.position}</span> : null}
              </div>
              <div className="mt-4"><StarRating stars={leader.starRating} /></div>
              <div className="mt-6 border-t border-line-500 pt-4">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-court-500">Program</span>
                <span className="mt-1 block text-sm font-semibold text-court-700">{leader.currentTeam}</span>
              </div>
            </>
          ) : (
            <div className="mt-5 border border-line-500 bg-white p-5 text-court-600">Data will appear here as verified games are submitted.</div>
          )}
        </motion.article>
      </div>
    </section>
  );
}
