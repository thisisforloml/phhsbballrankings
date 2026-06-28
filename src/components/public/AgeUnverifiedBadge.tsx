import type { EligibilityVerdict } from "@/lib/eligibility";
import { shouldShowAgeUnverifiedBadge } from "@/lib/eligibility";

export function AgeUnverifiedBadge({ verdict, className = "" }: { verdict: EligibilityVerdict; className?: string }) {
  if (!shouldShowAgeUnverifiedBadge(verdict)) return null;

  return (
    <span
      className={`inline-flex w-fit items-center border border-amber-500/60 bg-amber-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-amber-800 ${className}`.trim()}
      title="Birth date not yet verified. Public ranking may expire if age is not confirmed."
    >
      Age Unverified
    </span>
  );
}
