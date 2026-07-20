import { ArrowRight, Mail, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PublicPageShell } from "@/components/public/PublicPageShell";
import { BRAND_CONTACT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Member Access Coming Soon",
  description: "Peach Basket PH member accounts and premium tools are being prepared for a future release.",
};

export default function ComingSoonPage() {
  return (
    <PublicPageShell variant="scout">
      <section className="container-px flex min-h-[calc(100vh-4.5rem)] items-center py-24 lg:min-h-[calc(100vh-5rem)]">
        <div className="grid w-full gap-10 border-y border-white/15 py-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end lg:py-14">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-hardwood-500">Member Access</p>
            <h1 className="mt-4 font-display text-5xl font-bold leading-[0.95] text-white sm:text-6xl lg:text-7xl">
              Member tools are coming soon.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
              Rankings and profiles remain public during the private preview. Accounts and Premium Access will open after the member experience is ready.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/rankings" className="button primary">
                View Player Rankings <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a href={"mailto:" + BRAND_CONTACT_EMAIL + "?subject=Peach%20Basket%20PH%20access"} className="button secondary border-white/40 text-white hover:bg-white hover:text-court-900">
                <Mail className="h-4 w-4" aria-hidden="true" /> Contact Darwin
              </a>
            </div>
          </div>
          <aside className="border-l-2 border-hardwood-500 pl-5">
            <ShieldCheck className="h-6 w-6 text-hardwood-500" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-bold text-white">Organizer access remains available.</h2>
            <p className="mt-2 text-sm leading-6 text-white/65">Authorized organizers can continue submitting and reviewing official game data.</p>
            <Link href="/portal/login" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-hardwood-400 hover:text-white">
              Organizer Portal <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </aside>
        </div>
      </section>
    </PublicPageShell>
  );
}
