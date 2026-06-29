"use client";

import Link from "next/link";

export function HighlightsPlaceholder() {
  return (
    <section className="rounded-md border border-line-500 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-court-500">Highlights</p>
      <h3 className="mt-2 font-display text-xl font-black text-court-900">Video highlights coming soon</h3>
      <p className="mt-2 text-sm leading-7 text-court-600">
        Peach Basket will support verified highlight embeds on player profiles as media partnerships roll out.
      </p>
      <Link href="/claim" className="mt-4 inline-flex text-sm font-bold text-hardwood-600 hover:underline">
        Claim your profile to be ready
      </Link>
    </section>
  );
}
