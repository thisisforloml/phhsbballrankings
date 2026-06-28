import { COMPETITION_STRENGTH_DISCLAIMER } from "@/lib/competition-strength-copy";

export function RankingsCompetitionDisclaimer() {
  return (
    <section className="container-px mt-4 pb-8" aria-label="Ratings methodology note">
      <div className="mx-auto max-w-[74rem] border border-line-500 bg-paper-500 px-4 py-3 text-sm text-court-700">
        <p className="font-semibold text-court-900">{COMPETITION_STRENGTH_DISCLAIMER}</p>
        <p className="mt-1 text-xs leading-5 text-court-500">
          Primary competition shows where a player&apos;s verified stats were recorded. Lower-tier leagues receive a modest score discount.
        </p>
      </div>
    </section>
  );
}
