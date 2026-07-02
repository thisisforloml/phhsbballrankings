"use client";

import { useInView } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { StarRating } from "@/components/ui";
import { getPlayerProfileHref } from "@/lib/format";
import { formatPublicRank } from "@/lib/public-rank-display";
import type { HomeData, HomeLeaderboardRow } from "@/lib/public-site-data";
import { getProgramDisplayName } from "@/lib/uaap-school-display";

function CountUpSpan({ target }: { target: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView || !ref.current) return;
    const el = ref.current;
    let frame = 0;
    const total = 90;
    let rafId = 0;
    const tick = () => {
      frame += 1;
      const progress = 1 - Math.pow(1 - frame / total, 3);
      el.textContent = Math.round(target * Math.min(1, progress)).toLocaleString();
      if (frame < total) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [inView, target]);

  return (
    <span ref={ref} className="font-numeric" suppressHydrationWarning>
      0
    </span>
  );
}

function featuredProspect(data: HomeData): HomeLeaderboardRow | null {
  return data.weeklyBestPerformer ?? data.leaderboardsByAge.U19.boys[0] ?? data.leader ?? null;
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

  return (
    <section className="relative isolate overflow-hidden border-b border-white/10 bg-scout-900 pt-24 text-white md:pt-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(233,138,18,0.14),transparent_55%)]"
      />
      <div className="container-px relative py-7 md:py-16">
        <div className="mx-auto grid max-w-[74rem] grid-cols-1 items-center gap-6 md:grid-cols-2 md:gap-10">
          <div className="animate-hero-enter">
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
              <CountUpSpan target={rankedPlayers} /> ranked players · <CountUpSpan target={verifiedLeagues} /> leagues ·{" "}
              <CountUpSpan target={gamesLogged} /> verified games
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/rankings"
                className="home-mobile-tap-btn inline-flex items-center gap-2 rounded-sm bg-scout-orange px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-white transition-colors duration-200 hover:bg-scout-orange-bright"
              >
                View Rankings →
              </Link>
              <Link
                href="/players/search"
                className="home-mobile-tap-btn inline-flex items-center gap-2 rounded-sm border border-white/15 bg-scout-800 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-scout-50 transition-colors duration-200 hover:border-scout-orange/40"
              >
                Search Players
              </Link>
            </div>
          </div>

          {featured ? (
            <div className="animate-hero-enter-delayed">
              <Link
                href={getPlayerProfileHref(featured)}
                aria-label={`${featured.displayName}, best performer of the week, rated ${featured.rating.toFixed(1)}`}
                className="home-mobile-tap-card group relative block overflow-hidden rounded-sm border border-white/[0.08] bg-scout-800 text-left transition-colors duration-200 hover:border-scout-orange/40"
              >
                <div className="absolute left-2.5 top-2.5 z-10 md:left-3 md:top-3">
                  <span className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-scout-orange-bright">
                    Best Performer of the Week
                  </span>
                </div>
                <div className="prospect-portrait-frame relative h-[22rem] overflow-hidden sm:h-96 md:h-[26rem]">
                  {featured.photoUrl ? (
                    <Image
                      src={featured.photoUrl}
                      alt=""
                      fill
                      priority
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="home-mobile-featured-photo absolute inset-x-0 z-[1] max-md:top-0 max-md:h-[80%] max-md:object-cover max-md:object-[center_18%] md:bottom-0 md:object-contain md:object-bottom"
                    />
                  ) : (
                    <span className="absolute inset-x-0 top-0 z-[1] grid h-[80%] place-items-center font-display text-6xl font-bold text-white/10 md:inset-0 md:h-full">
                      {initials(featured.displayName)}
                    </span>
                  )}
                  <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-court-900/95 via-court-900/25 to-transparent max-md:from-30% max-md:via-court-900/35 max-md:via-45%" />
                  <div className="absolute inset-x-0 bottom-0 z-[3] p-3.5 md:p-5">
                    <div className="mb-2 flex items-end justify-between gap-2 md:mb-3 md:gap-3">
                      <div className="min-w-0">
                        <div className="mb-0.5 flex flex-wrap items-center gap-1.5 md:mb-1 md:gap-2">
                          {featured.rank > 0 ? (
                            <span className="font-numeric text-4xl font-normal leading-none text-scout-orange-bright md:text-5xl">
                              {formatPublicRank(featured.rank)}
                            </span>
                          ) : null}
                          {featured.position ? (
                            <span className="rounded-sm border border-white/15 bg-scout-900/60 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-scout-50 md:px-2 md:text-[0.65rem]">
                              {featured.position}
                            </span>
                          ) : null}
                        </div>
                        <h2 className="font-display text-xl font-bold uppercase leading-tight text-white md:text-2xl">
                          {featured.displayName}
                        </h2>
                        <p className="mt-0.5 text-[0.65rem] font-semibold text-scout-500 md:text-[0.7rem]">
                          {getProgramDisplayName(featured.currentTeam)}
                          {featured.classYearLabel ? ` · ${featured.classYearLabel}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-numeric text-[2.75rem] font-normal italic leading-none text-white md:text-4xl">
                          {featured.rating.toFixed(1)}
                        </div>
                        <div className="mt-0.5 text-[0.55rem] font-bold uppercase tracking-[0.12em] text-scout-500 md:mt-1 md:text-[0.65rem]">
                          Rating
                        </div>
                        <div className="mt-1 flex justify-end md:hidden">
                          <StarRating stars={featured.starRating as 1 | 2 | 3 | 4 | 5} />
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-white/10 pt-2 md:flex md:items-center md:justify-between md:pt-3">
                      <div className="hidden md:block">
                        <StarRating stars={featured.starRating as 1 | 2 | 3 | 4 | 5} />
                      </div>
                      <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-sm border border-white/15 bg-scout-900/80 px-3 py-2 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-scout-orange-bright md:w-auto md:border-transparent md:bg-transparent md:px-0 md:py-0 md:text-xs md:font-semibold md:opacity-0 md:transition md:group-hover:opacity-100">
                        View Profile
                        <span aria-hidden="true">→</span>
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
