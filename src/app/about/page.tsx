import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { PageBand } from "@/components/public/PageBand";
import { SectionHeader } from "@/components/public/SectionHeader";

export const metadata: Metadata = {
  title: "About Peach Basket Rankings PH",
  description: "Mission, vision, and platform overview for Peach Basket Rankings PH."
};

const audiences = ["Players", "Parents", "Coaches", "Scouts and recruiters", "Leagues and organizers", "Media"];

export default function AboutPage() {
  return (
    <PublicPageShell className="pb-16 pt-24">
      <PageBand
        eyebrow="About Peach Basket Rankings PH"
        title="Philippine youth basketball, made visible."
        description="A public home for youth basketball rankings, team records, game logs, and player profiles."
      />

      <section className="container-px grid gap-7 py-8">
        <div className="grid gap-6 border-b border-line-500 pb-7 lg:grid-cols-2">
          <StatementCard title="Mission">
            To identify the best youth basketball talent in the Philippines through objective, data-based rankings while giving Filipino athletes greater visibility and exposure.
          </StatementCard>
          <StatementCard title="Vision">
            To become the trusted national platform for Philippine youth basketball visibility, where players from every region can be discovered, recognized, and supported through credible game data.
          </StatementCard>
        </div>

        <section>
          <SectionHeader title="What We Do" variant="content" />
          <p className="mt-3 max-w-5xl text-base font-semibold leading-7 text-court-700">
            Peach Basket Rankings PH publishes player rankings, team records, player profiles, game logs, league history, and reviewed box-score data in one public basketball database.
          </p>
        </section>

        <section>
          <SectionHeader title="Built For" variant="content" />
          <p className="mt-3 max-w-5xl text-base font-semibold leading-7 text-court-700">
            Built for {audiences.join(", ")}.
          </p>
        </section>

        <section className="border border-court-900 bg-court-900 p-5 text-white">
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
