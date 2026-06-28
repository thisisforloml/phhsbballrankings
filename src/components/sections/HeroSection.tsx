"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { HomeData } from "@/lib/public-site-data";

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

  return (
    <section className="hero-brand relative isolate overflow-hidden pt-32 text-white">
      <div className="container-px py-14 md:py-16">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-5xl text-center">
          <h1 className="mx-auto max-w-5xl font-display text-[clamp(2.4rem,5.4vw,4.75rem)] font-extrabold leading-[1.05] tracking-tight">
            Elevating PH Basketball Through Data
          </h1>
          <span aria-hidden="true" className="mx-auto mt-5 block h-1 w-24 -skew-x-12 bg-accent-500" />
          <p className="mx-auto mt-5 max-w-2xl text-base font-semibold leading-7 text-white/75 md:text-lg">
            The nationwide basketball player ranking and visibility platform for young Filipino athletes.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/rankings" className="button primary">Player Rankings</Link>
            <Link href="/teams" className="button border-white/40 text-white hover:border-accent-500 hover:text-accent-400">Team Rankings</Link>
            <Link href="/how-we-rank" className="button border-white/40 text-white hover:border-accent-500 hover:text-accent-400">How We Rank</Link>
          </div>
          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-3 border-y border-white/15">
            <span className="border-r border-white/15 py-4 pr-4">
              <strong ref={ranked.ref} className="block font-display text-stat-sm text-white">{ranked.value.toLocaleString()}</strong>
              <small className="text-xs font-bold uppercase tracking-[0.12em] text-white/58">Ranked Players</small>
            </span>
            <span className="border-r border-white/15 px-4 py-4">
              <strong ref={leagueCount.ref} className="block font-display text-stat-sm text-white">{leagueCount.value.toLocaleString()}</strong>
              <small className="text-xs font-bold uppercase tracking-[0.12em] text-white/58">Leagues</small>
            </span>
            <span className="py-4 pl-4">
              <strong ref={games.ref} className="block font-display text-stat-sm text-white">{games.value.toLocaleString()}</strong>
              <small className="text-xs font-bold uppercase tracking-[0.12em] text-white/58">Games</small>
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
