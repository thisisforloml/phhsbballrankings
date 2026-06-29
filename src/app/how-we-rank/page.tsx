import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { PageBand } from "@/components/public/PageBand";
import { SectionHeader } from "@/components/public/SectionHeader";
import { InfoPageNav } from "@/components/public/InfoPageNav";

export const metadata: Metadata = {
  title: "How We Rank",
  description: "How Peach Basket Rankings PH uses official game statistics, ratings, team records, and competition context.",
};

const ratingInputs = [
  "Production: points, rebounds, assists, steals, blocks, and box-score contribution.",
  "Efficiency: shooting results, missed shots, turnovers, and fouls.",
  "All-around impact: scoring, playmaking, rebounding, and defense.",
  "Availability: larger official samples carry more confidence.",
  "Competition context: age group, gender, league, season, opponent, and team context.",
];

const starBands = [
  ["90-100", "5 stars"],
  ["80-89", "4 stars"],
  ["70-79", "3 stars"],
  ["60-69", "2 stars"],
  ["Below 60", "1 star"],
];

const eligibilityRows = [
  ["Boys boards", "10+ verified games to appear on the public national board"],
  ["Girls boards", "5+ verified games to appear on the public national board"],
  ["Age groups", "U13, U16, and U19 boards with separate boys and girls rankings"],
  ["Class year", "U19 athletes graduate from active boards starting June 1 of their class year"],
];

export default function HowWeRankPage() {
  return (
    <PublicPageShell className="pb-16 pt-24">
      <PageBand
        eyebrow="Methodology"
        title="Data first. No guesswork."
        description="Peach Basket Rankings PH turns official box scores into player rankings, team records, and profile history."
      />

      <section className="container-px py-6">
        <InfoPageNav current="how-we-rank" />
      </section>

      <section className="container-px grid gap-8 py-4">
        <MethodBlock title="What Data We Use">
          <div className="grid gap-3 md:grid-cols-3">
            <DefinitionCard title="Official stats" description="Box scores, stat sheets, and published game results from verified competitions." />
            <DefinitionCard title="Organizer uploads" description="Submitted files reviewed before they become official records on the platform." />
            <DefinitionCard title="Corrections" description="Approved fixes for names, teams, duplicate records, and stat errors." />
          </div>
        </MethodBlock>

        <MethodBlock title="Player Ratings (Formula v1)">
          <p className="max-w-4xl text-sm font-semibold leading-6 text-court-700 md:text-base">
            Each player receives a 0–100 rating based on verified box-score production, efficiency, availability, and competition context. Game performances are converted into scores, then averaged across eligible games in the current age group.
          </p>
          <ul className="mt-4 grid gap-2 text-sm font-semibold leading-6 text-court-700 md:grid-cols-2">
            {ratingInputs.map((item) => (
              <li key={item} className="border-l-4 border-hardwood-600 bg-white px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        </MethodBlock>

        <MethodBlock title="Eligibility and Confidence">
          <p className="max-w-4xl text-sm font-semibold leading-6 text-court-700 md:text-base">
            Public national boards only include players who meet minimum verified-game thresholds. Filters on the rankings page can raise the minimum further, but never below the board floor.
          </p>
          <div className="mt-4 overflow-hidden border border-line-500 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-paper-500 text-xs font-bold uppercase tracking-[0.08em] text-court-500">
                <tr>
                  <th className="px-4 py-3">Rule</th>
                  <th className="px-4 py-3">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-500 font-semibold text-court-700">
                {eligibilityRows.map(([rule, detail]) => (
                  <tr key={rule}>
                    <td className="px-4 py-3 font-bold text-court-900">{rule}</td>
                    <td className="px-4 py-3">{detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </MethodBlock>

        <MethodBlock title="Team Rankings">
          <p className="max-w-4xl text-sm font-semibold leading-6 text-court-700 md:text-base">
            Team rankings use official game records: wins, losses, points for, points against, and differential. Competition standings include official playoff, classification, and final games where logged.
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

        <section className="grid gap-4 border border-line-500 bg-white p-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="font-display text-xl font-bold text-court-900">Still have questions?</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-court-600">
              See common questions about rankings, corrections, and what the platform does not guarantee.
            </p>
          </div>
          <Link href="/faqs" className="button inline-flex justify-center px-4 py-2 text-sm font-bold">
            Read FAQs
          </Link>
        </section>

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
