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
        <ComingSoonBadge className="mx-auto" />
        <h2 className="mt-4 font-display text-2xl font-black text-court-900">
          {publicRankingsCoverageCopy.plannedBoardTitle(ageGroup)}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-6 text-court-600">
          {publicRankingsCoverageCopy.plannedBoardDescription}
        </p>
        <CoverageBulletList className="mx-auto mt-6 max-w-xl text-left" />
        <Link href="/how-we-rank" className="button secondary mt-6 inline-flex">
          How We Rank
        </Link>
      </div>
    );
  }

  return (
    <aside
      className={`border border-line-500 bg-paper-500 px-4 py-3 md:px-5 ${className}`}
      aria-label="Current rankings coverage"
    >
      <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-hardwood-600">Rankings coverage</p>
      <CoverageBulletList className="mt-2" />
    </aside>
  );
}

function CoverageBulletList({ className = "" }: { className?: string }) {
  return (
    <ul className={`grid gap-2 text-sm font-semibold leading-6 text-court-600 ${className}`}>
      <li className="flex gap-2">
        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-hardwood-600" aria-hidden="true" />
        <span>{publicRankingsCoverageCopy.launchLabel}</span>
      </li>
      <li className="flex gap-2">
        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-court-300" aria-hidden="true" />
        <span>{publicRankingsCoverageCopy.plannedLabel}</span>
      </li>
      <li className="flex gap-2">
        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-court-300" aria-hidden="true" />
        <span>{publicRankingsCoverageCopy.verifiedLabel}</span>
      </li>
    </ul>
  );
}

export function ComingSoonBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center border border-line-500 bg-white px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-court-500 ${className}`}
    >
      Coming Soon
    </span>
  );
}
