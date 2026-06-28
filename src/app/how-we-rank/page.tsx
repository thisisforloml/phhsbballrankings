import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { PageBand } from "@/components/public/PageBand";
import { SectionHeader } from "@/components/public/SectionHeader";

export const metadata: Metadata = {
  title: "How We Rank",
  description: "How Peach Basket Rankings PH uses official game statistics, ratings, team records, and competition context."
};

const ratingInputs = [
  "Production: points, rebounds, assists, steals, blocks, and box-score contribution.",
  "Efficiency: shooting results, missed shots, turnovers, and fouls.",
  "All-around impact: scoring, playmaking, rebounding, and defense.",
  "Availability: larger official samples carry more confidence.",
  "Competition context: age group, gender, league, season, opponent, and team context."
];

const starBands = [
  ["90-100", "5 stars"],
  ["80-89", "4 stars"],
  ["70-79", "3 stars"],
  ["60-69", "2 stars"],
  ["Below 60", "1 star"]
];

export default function HowWeRankPage() {
  return (
    <PublicPageShell className="pb-16 pt-24">
      <PageBand
        eyebrow="Methodology"
        title="Data first. No guesswork."
        description="Peach Basket Rankings PH turns official box scores into player rankings, team records, and profile history."
      />

      <section className="container-px grid gap-8 py-8">
        <MethodBlock title="What Data We Use">
          <div className="grid gap-3 md:grid-cols-3">
            <DefinitionCard title="Official stats" description="Box scores, stat sheets, and published game results." />
            <DefinitionCard title="Organizer uploads" description="Submitted files reviewed before they become official records." />
            <DefinitionCard title="Corrections" description="Approved fixes for names, teams, duplicate records, and stat errors." />
          </div>
        </MethodBlock>

        <MethodBlock title="Player Ratings">
          <p className="max-w-4xl text-sm font-semibold leading-6 text-court-700 md:text-base">
            Each player receives a 0-100 rating based on verified box-score production, efficiency, availability, and competition context.
          </p>
          <ul className="mt-4 grid gap-2 text-sm font-semibold leading-6 text-court-700 md:grid-cols-2">
            {ratingInputs.map((item) => <li key={item} className="border-l-4 border-hardwood-600 bg-white px-3 py-2">{item}</li>)}
          </ul>
        </MethodBlock>

        <MethodBlock title="Age Groups and Boards">
          <p className="max-w-4xl text-sm font-semibold leading-6 text-court-700 md:text-base">
            Public boards are organized by U13, U16, and U19, with boys and girls boards separated. Players are ranked within their own age and gender board.
          </p>
        </MethodBlock>

        <MethodBlock title="Eligibility and Confidence">
          <p className="max-w-4xl text-sm font-semibold leading-6 text-court-700 md:text-base">
            Boys boards require 10+ games. Girls boards require 5+ games. Public ranks stay contiguous after filters are applied.
          </p>
        </MethodBlock>

        <MethodBlock title="Team Rankings">
          <p className="max-w-4xl text-sm font-semibold leading-6 text-court-700 md:text-base">
            Team Rankings use official game records: wins, losses, points for, points against, and differential. Full competition records include official playoff, classification, and final games.
          </p>
        </MethodBlock>

        <MethodBlock title="Star Ratings">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {starBands.map(([rating, stars]) => (
              <div key={rating} className="border border-line-500 bg-white p-4">
                <strong className="block font-display text-stat-sm font-bold text-court-900">{rating}</strong>
                <span className="mt-1 block text-xs font-bold uppercase tracking-[0.12em] text-hardwood-600">{stars}</span>
              </div>
            ))}
          </div>
        </MethodBlock>

        <MethodBlock title="Corrections and Limits">
          <div className="border border-court-900 bg-court-900 p-6 text-white">
            <p className="max-w-5xl leading-7 text-white/75">
              Rankings are not promises of recruitment, scholarship, selection, or future performance. They can update after corrections, new official imports, duplicate cleanup, or methodology changes. Players, parents/guardians, coaches, schools, and organizers may request corrections for inaccurate data.
            </p>
          </div>
        </MethodBlock>
      </section>
    </PublicPageShell>
  );
}

function MethodBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-4">
        <SectionHeader title={title} variant="content" />
      </div>
      {children}
    </section>
  );
}

function DefinitionCard({ title, description }: { title: string; description: string }) {
  return (
    <article className="sports-module p-5">
      <h2 className="font-display text-xl font-bold leading-tight text-court-900">{title}</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-court-600">{description}</p>
    </article>
  );
}
