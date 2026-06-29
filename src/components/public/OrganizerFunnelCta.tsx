"use client";

import Link from "next/link";

export function OrganizerFunnelCta() {
  return (
    <section className="container-px border-y border-line-500 bg-court-900 py-8 text-white">
      <div className="mx-auto flex max-w-[74rem] flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-gold-500">For organizers</p>
          <h2 className="mt-2 font-display text-2xl font-black">Submit official games to the national record</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-white/72">
            Verified league results feed national boards, player profiles, and team standings on Peach Basket.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/portal/login" className="rounded-sm border border-white/65 bg-white/10 px-4 py-3 text-sm font-bold uppercase tracking-[0.04em] text-white hover:bg-white hover:text-court-900">
            Organizer portal
          </Link>
          <Link href="/admin/submissions" className="rounded-sm border border-hardwood-600 bg-hardwood-600 px-4 py-3 text-sm font-bold uppercase tracking-[0.04em] text-white hover:border-hardwood-700 hover:bg-hardwood-700">
            Submit stats
          </Link>
        </div>
      </div>
    </section>
  );
}
