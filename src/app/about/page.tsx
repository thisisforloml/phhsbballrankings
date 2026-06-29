import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { PageBand } from "@/components/public/PageBand";
import { SectionHeader } from "@/components/public/SectionHeader";
import { InfoPageNav } from "@/components/public/InfoPageNav";

export const metadata: Metadata = {
  title: "About Peach Basket Rankings PH",
  description: "Mission, vision, and platform overview for Peach Basket Rankings PH.",
};

const audiences = [
  { label: "Players", detail: "Public profiles, game logs, and verified production history." },
  { label: "Parents", detail: "Clear context on where and how their athlete is performing." },
  { label: "Coaches", detail: "Roster context, competition splits, and trend visibility." },
  { label: "Scouts and recruiters", detail: "Searchable boards with eligibility and confidence signals." },
  { label: "Leagues and organizers", detail: "A trusted public record after reviewed imports." },
  { label: "Media", detail: "Credible rankings and game history for coverage." },
];

const pillars = [
  {
    title: "Verified game data",
    description: "Rankings come from reviewed box scores and official game results — not social buzz or self-reported hype.",
  },
  {
    title: "Public by default",
    description: "Player profiles, team records, league history, and national boards live in one searchable database.",
  },
  {
    title: "Transparent methodology",
    description: "Eligibility rules, age groups, and rating inputs are documented so users know what the numbers mean.",
  },
];

export default function AboutPage() {
  return (
    <PublicPageShell className="pb-16 pt-24">
      <PageBand
        eyebrow="About Peach Basket Rankings PH"
        title="Philippine youth basketball, made visible."
        description="A public home for youth basketball rankings, team records, game logs, and player profiles built from verified competition data."
      />

      <section className="container-px py-6">
        <InfoPageNav current="about" />
      </section>

      <section className="container-px grid gap-8 py-4">
        <div className="grid gap-6 border-b border-line-500 pb-8 lg:grid-cols-2">
          <StatementCard title="Mission">
            To identify the best youth basketball talent in the Philippines through objective, data-based rankings while giving Filipino athletes greater visibility and exposure.
          </StatementCard>
          <StatementCard title="Vision">
            To become the trusted national platform for Philippine youth basketball visibility, where players from every region can be discovered, recognized, and supported through credible game data.
          </StatementCard>
        </div>

        <section>
          <SectionHeader title="What We Publish" variant="content" />
          <p className="mt-3 max-w-5xl text-base font-semibold leading-7 text-court-700">
            Peach Basket Rankings PH publishes national player rankings, team standings, player profiles, game logs, league directories, and reviewed box-score data in one public basketball database.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {pillars.map((item) => (
              <article key={item.title} className="sports-module p-5">
                <h2 className="font-display text-xl font-bold text-court-900">{item.title}</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-court-600">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <SectionHeader title="Built For" variant="content" />
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {audiences.map((item) => (
              <li key={item.label} className="border border-line-500 bg-white px-4 py-3">
                <strong className="block text-sm font-black uppercase tracking-[0.06em] text-court-900">{item.label}</strong>
                <p className="mt-1 text-sm font-semibold leading-6 text-court-600">{item.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-4 border border-line-500 bg-white p-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="font-display text-xl font-bold text-court-900">Want the methodology?</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-court-600">
              Read how ratings, eligibility, and team boards are calculated on our methodology page.
            </p>
          </div>
          <Link href="/how-we-rank" className="button inline-flex justify-center px-4 py-2 text-sm font-bold">
            How We Rank
          </Link>
        </section>

        <section className="border border-court-900 bg-court-900 p-6 text-white md:p-8">
          <h2 className="font-display text-2xl font-bold leading-tight md:text-3xl">Data supports judgment. It does not replace it.</h2>
          <p className="mt-3 max-w-5xl leading-7 text-white/75">
            Peach Basket Rankings PH does not replace coaches, scouts, organizers, or player development work. It gives them cleaner context: who played, where they played, and how they produced in official games.
          </p>
        </section>
      </section>
    </PublicPageShell>
  );
}

function StatementCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article>
      <h2 className="font-display text-2xl font-bold leading-tight text-court-900">{title}</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-court-700 md:text-base">{children}</p>
    </article>
  );
}
