import Link from "next/link";
import type { PublicCoverageAgeGroup } from "@/lib/public-rankings-coverage";
import { isPlannedPublicAgeGroup, publicRankingsCoverageCopy } from "@/lib/public-rankings-coverage";

type RankingsCoverageNoticeProps = {
  variant?: "banner" | "empty";
  ageGroup?: PublicCoverageAgeGroup;
  className?: string;
};

export function RankingsCoverageNotice({ variant = "banner", ageGroup, className = "" }: RankingsCoverageNoticeProps) {
  if (variant === "empty" && ageGroup && isPlannedPublicAgeGroup(ageGroup)) {
    return (
      <div className={`border border-line-500 bg-white px-6 py-12 text-center md:px-10 ${className}`}>
        <h2 className="font-display text-2xl font-black text-court-900">
          {publicRankingsCoverageCopy.plannedBoardTitle(ageGroup)}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-6 text-court-600">
          {publicRankingsCoverageCopy.plannedBoardDescription}
        </p>
        <Link href="/how-we-rank" className="button secondary mt-6 inline-flex">
          How We Rank
        </Link>
      </div>
    );
  }

  return (
    <aside className={`border border-line-500 bg-paper-500 px-4 py-3 text-sm font-semibold text-court-700 md:px-5 ${className}`}>
      <p>{publicRankingsCoverageCopy.verifiedLabel}</p>
      <p className="mt-1 text-xs text-court-500">
        Learn how boards are built on{" "}
        <Link href="/how-we-rank" className="font-bold text-hardwood-600 hover:text-hardwood-700">
          How We Rank
        </Link>
        .
      </p>
    </aside>
  );
}
