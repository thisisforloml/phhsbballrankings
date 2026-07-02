import type { Metadata } from "next";
import Link from "next/link";

import { InfoPageNav } from "@/components/public/InfoPageNav";
import { PageBand } from "@/components/public/PageBand";
import { PublicPageShell } from "@/components/public/PublicPageShell";

export const metadata: Metadata = {
  title: "FAQs",
  description: "Frequently asked questions about Peach Basket Rankings PH.",
};

const faqs = [
  {
    question: "What is Peach Basket Rankings PH?",
    answer:
      "A Philippine basketball visibility platform that turns verified game data into player profiles, ratings, team standings, and public national rankings.",
  },
  {
    question: "Do rankings guarantee recruitment or scholarships?",
    answer:
      "No. Rankings are informational. They do not guarantee recruitment, scholarships, team selection, playing time, or future performance.",
  },
  {
    question: "How are players ranked?",
    answer:
      "Formula v1 uses validated box-score production, converts each game into a performance score, and averages eligible performances into a current 0–100 rating within the player's age and gender board.",
  },
  {
    question: "Why is a player missing from the national board?",
    answer:
      "Common reasons include not enough verified games (boys need 10+, girls need 5+), playing outside the selected age group, graduation from U19 eligibility, or missing identity data still under review.",
  },
  {
    question: "How do age groups work?",
    answer:
      "Public boards are organized by U13, U16, and U19 with separate boys and girls rankings. Eligibility uses calendar age as of the evaluation date, with U19 graduation tied to class year.",
  },
  {
    question: "Can data be corrected?",
    answer:
      "Yes. Players, parents or guardians, coaches, schools, and organizers may request correction or removal review when official records are inaccurate.",
  },
  {
    question: "Why are some profile fields missing?",
    answer:
      "Some records are still being completed from stat imports. Height, position, photo, and bio fields may be added as verified information becomes available.",
  },
  {
    question: "How are team rankings calculated?",
    answer:
      "Competition standings use official wins, losses, points for, points against, and point differential. National team boards use the platform's TPI-v1 program rating where enabled.",
  },
];

export default function FaqsPage() {
  return (
    <PublicPageShell className="pb-16 pt-24">
      <PageBand
        eyebrow="Support"
        title="Frequently asked questions"
        description="Quick answers about rankings, eligibility, corrections, and what Peach Basket does and does not promise."
      />

      <section className="container-px py-6">
        <InfoPageNav current="faqs" />
      </section>

      <section className="container-px py-4">
        <div className="mx-auto grid max-w-4xl gap-4">
          {faqs.map((item) => (
            <article key={item.question} className="border border-line-500 bg-white p-5">
              <h2 className="font-display text-xl font-bold leading-tight text-court-900">{item.question}</h2>
              <p className="mt-2 text-sm font-semibold leading-7 text-court-600 md:text-base">{item.answer}</p>
            </article>
          ))}
        </div>

        <div className="mx-auto mt-8 grid max-w-4xl gap-4 border border-line-500 bg-paper-500 p-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="font-display text-xl font-bold text-court-900">Need the full methodology?</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-court-600">
              See rating inputs, star bands, and eligibility rules in detail.
            </p>
          </div>
          <Link href="/how-we-rank" className="button inline-flex justify-center px-4 py-2 text-sm font-bold">
            How We Rank
          </Link>
        </div>
      </section>
    </PublicPageShell>
  );
}
