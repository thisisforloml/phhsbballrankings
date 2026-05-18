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
      <div className="container-px grid min-h-[calc(100vh-5rem)] items-center gap-12 py-16 lg:grid-cols-[1.25fr_0.75fr]">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
          <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">OnCourt Rankings PH</p>
          <h1 className="mt-5 max-w-4xl font-display text-[clamp(4rem,11vw,8rem)] font-extrabold leading-none">
            OnCourt Rankings Philippines<span className="text-amber-500">.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/70">
            Verified game data. Statistically derived ratings. The national ranking system built on real competition.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/rankings" className="button primary">Explore Rankings</Link>
            <Link href="/about" className="button border-white/40 text-white hover:border-amber-500 hover:text-amber-500">How Ratings Work</Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-8 font-mono text-mono-sm uppercase text-white/70">
            <span><strong ref={ranked.ref} className="block font-display text-stat-sm text-white">{ranked.value.toLocaleString()}</strong> Ranked Players</span>
            <span><strong ref={leagueCount.ref} className="block font-display text-stat-sm text-white">{leagueCount.value.toLocaleString()}</strong> Leagues Covered</span>
            <span><strong ref={games.ref} className="block font-display text-stat-sm text-white">{games.value.toLocaleString()}</strong> Games Logged</span>
          </div>
        </motion.div>
        <motion.article initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-lg border border-amber-500/55 bg-white p-7 text-ink-900 shadow-navy">
          <p className="font-mono text-mono-sm uppercase text-navy-800">Now Leading</p>
          {leader ? (
            <>
              <RatingBadge rating={leader.rating} large />
              <h2 className="font-display text-5xl font-bold"><Link href={getPlayerProfileHref(leader)}>{leader.displayName}</Link></h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-navy-50 px-3 py-1 font-mono text-mono-sm uppercase text-navy-800">{leader.gender}</span>
                <span className="rounded-full bg-navy-50 px-3 py-1 font-mono text-mono-sm uppercase text-navy-800">{leader.ageGroup}</span>
                {leader.position ? <span className="rounded-full bg-navy-50 px-3 py-1 font-mono text-mono-sm uppercase text-navy-800">{leader.position}</span> : null}
              </div>
              <div className="mt-4"><StarRating stars={leader.starRating} /></div>
              <div className="mt-5 grid gap-1">
                <span className="font-mono text-mono-sm uppercase text-ink-500">School/Team</span>
                <span className="text-sm text-ink-600">{leader.currentTeam}</span>
              </div>
            </>
          ) : (
            <div className="mt-5 rounded-md bg-navy-50 p-5 text-ink-600">Data will appear here as verified games are submitted.</div>
          )}
        </motion.article>
      </div>
    </section>
  );
}
