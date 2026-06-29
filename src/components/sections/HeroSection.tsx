"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { HomeData, HomeLeaderboardRow } from "@/lib/public-site-data";
import { formatPublicRank } from "@/lib/public-rank-display";
import { getPlayerProfileHref } from "@/lib/format";
import { getProgramDisplayName } from "@/lib/uaap-school-display";
import { StarRating } from "@/components/ui";

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

function featuredProspect(data: HomeData): HomeLeaderboardRow | null {
  return data.leaderboardsByAge.U19.boys[0] ?? data.leader ?? null;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function HeroSection({ data }: { data: HomeData }) {
  const featured = featuredProspect(data);
  const { rankedPlayers, verifiedLeagues, gamesLogged } = data.counts;
  const ranked = useCountUp(rankedPlayers);
  const leagues = useCountUp(verifiedLeagues);
  const games = useCountUp(gamesLogged);

  return (
    <section className="relative isolate overflow-hidden border-b border-white/10 bg-scout-900 pt-28 text-white md:pt-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(233,138,18,0.14),transparent_55%)]"
      />
      <div className="container-px relative py-12 md:py-16">
        <div className="mx-auto grid max-w-[74rem] grid-cols-1 items-center gap-10 md:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-scout-orange-bright">
              <span aria-hidden="true" className="inline-block h-4 w-1 bg-scout-orange" />
              Philippine youth basketball
            </p>
            <h1 className="mt-4 font-display text-[clamp(2.25rem,5vw,3.75rem)] font-bold uppercase leading-[1.02] tracking-tight text-white">
              The Home of
              <br />
              <span className="text-scout-orange-bright">Philippine</span>
              <br />
              Basketball Prospects
            </h1>
            <p className="mt-5 max-w-lg text-sm font-medium leading-7 text-scout-500">
              <span ref={ranked.ref} className="font-numeric">
                {ranked.value.toLocaleString()}
              </span>{" "}
              ranked players ·{" "}
              <span ref={leagues.ref} className="font-numeric">
                {leagues.value.toLocaleString()}
              </span>{" "}
              leagues ·{" "}
              <span ref={games.ref} className="font-numeric">
                {games.value.toLocaleString()}
              </span>{" "}
              verified games
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/rankings"
                className="inline-flex items-center gap-2 rounded-sm bg-scout-orange px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-white transition hover:bg-scout-orange-bright"
              >
                View Rankings →
              </Link>
              <Link
                href="/players/search"
                className="inline-flex items-center gap-2 rounded-sm border border-white/15 bg-scout-800 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-scout-50 transition hover:border-scout-orange/40"
              >
                Search Players
              </Link>
            </div>
          </motion.div>

          {featured ? (
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
              <Link
                href={getPlayerProfileHref(featured)}
                className="group relative block overflow-hidden rounded-sm border border-white/[0.08] bg-scout-800 text-left transition hover:border-scout-orange/40"
              >
                <div className="absolute left-3 top-3 z-10">
                  <span className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-scout-orange-bright">
                    Featured Prospect
                  </span>
                </div>
                <div className="prospect-portrait-frame relative h-80 overflow-hidden sm:h-96 md:h-[26rem]">
                  {featured.photoUrl ? (
                    <Image
                      src={featured.photoUrl}
                      alt=""
                      fill
                      priority
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="absolute inset-x-0 bottom-0 z-[1] object-contain object-bottom"
                    />
                  ) : (
                    <span className="absolute inset-0 z-[1] grid place-items-center font-display text-6xl font-bold text-white/10">
                      {initials(featured.displayName)}
                    </span>
                  )}
                  <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-court-900/95 via-court-900/25 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 z-[3] p-5">
                    <div className="mb-3 flex items-end justify-between gap-3">
                      <div>
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="font-numeric text-5xl font-normal leading-none text-scout-orange-bright">
                            {formatPublicRank(featured.rank)}
                          </span>
                          {featured.position ? (
                            <span className="rounded-sm border border-white/15 bg-scout-900/60 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-scout-50">
                              {featured.position}
                            </span>
                          ) : null}
                        </div>
                        <h2 className="font-display text-2xl font-bold uppercase leading-tight text-white">
                          {featured.displayName}
                        </h2>
                        <p className="mt-0.5 text-[0.7rem] font-semibold text-scout-500">
                          {getProgramDisplayName(featured.currentTeam)}
                          {featured.classYearLabel ? ` · ${featured.classYearLabel}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-numeric text-4xl font-normal italic leading-none text-white">
                          {featured.rating.toFixed(1)}
                        </div>
                        <div className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-scout-500">Rating</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/10 pt-3">
                      <StarRating stars={featured.starRating as 1 | 2 | 3 | 4 | 5} />
                      <span className="text-xs font-semibold text-scout-orange-bright opacity-0 transition group-hover:opacity-100">
                        View profile →
                      </span>
                    </div>
                    </div>
                </div>
              </Link>
            </motion.div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
