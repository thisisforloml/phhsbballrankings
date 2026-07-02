import Link from "next/link";

import type { HomeData } from "@/lib/public-site-data";

export function BoardReport({ data }: { data: HomeData }) {
  const topBoy = data.leaderboardsByAge.U19.boys[0];
  const topGirl = data.leaderboardsByAge.U19.girls[0];

  return (
    <article className="rounded-sm border border-white/[0.08] bg-scout-800/80 p-5 md:p-6">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-scout-orange-bright">Board Report</p>
      <h2 className="mt-2 font-display text-2xl font-bold uppercase tracking-tight text-white">U19 national board snapshot</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-scout-500">
        Peach Basket tracks {data.counts.rankedPlayers} publicly ranked players across verified official games.
        {topBoy ? (
          <>
            {" "}
            The U19 Boys board is led by{" "}
            <Link href={`/players/${topBoy.slug}`} className="font-bold text-scout-orange-bright hover:text-scout-orange">
              {topBoy.displayName}
            </Link>{" "}
            at <span className="font-numeric italic">{topBoy.rating.toFixed(1)}</span>.
          </>
        ) : null}
        {topGirl ? (
          <>
            {" "}
            On the U19 Girls board,{" "}
            <Link href={`/players/${topGirl.slug}`} className="font-bold text-scout-orange-bright hover:text-scout-orange">
              {topGirl.displayName}
            </Link>{" "}
            leads at <span className="font-numeric italic">{topGirl.rating.toFixed(1)}</span>.
          </>
        ) : null}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/rankings?gender=Boys&age=U19"
          className="inline-flex rounded-sm border border-white/15 bg-scout-900 px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-scout-50 transition hover:border-scout-orange/40"
        >
          U19 Boys board
        </Link>
        <Link
          href="/rankings?gender=Girls&age=U19"
          className="inline-flex rounded-sm border border-white/15 bg-scout-900 px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-scout-50 transition hover:border-scout-orange/40"
        >
          U19 Girls board
        </Link>
        <Link href="/how-we-rank" className="text-sm font-bold text-scout-orange-bright hover:text-scout-orange">
          Read methodology
        </Link>
      </div>
    </article>
  );
}
