import type { PublicCoverageAgeGroup } from "@/lib/public-rankings-coverage";
import { isPlannedPublicAgeGroup } from "@/lib/public-rankings-coverage";

type AgeGroupPillProps = {
  group: PublicCoverageAgeGroup;
  active: boolean;
  onClick: () => void;
  className?: string;
  variant?: "paper" | "scout";
};

export function AgeGroupPill({ group, active, onClick, className = "", variant = "paper" }: AgeGroupPillProps) {
  const planned = isPlannedPublicAgeGroup(group);
  const scoutActive = "border-scout-orange bg-scout-orange/20 text-scout-orange-bright";
  const scoutIdle = planned
    ? "border-white/10 bg-scout-800 text-scout-500 hover:border-scout-orange/40"
    : "border-white/10 bg-scout-800 text-scout-500 hover:border-scout-orange/40 hover:text-scout-50";
  const paperActive = "border-court-900 bg-court-900 text-white";
  const paperIdle = planned
    ? "border-line-500 bg-paper-500 text-court-400 hover:border-court-600 hover:text-court-600"
    : "border-line-500 bg-white text-court-600 hover:border-court-900 hover:text-court-900";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 border px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] transition md:px-5 md:py-2 ${
        active ? (variant === "scout" ? scoutActive : paperActive) : variant === "scout" ? scoutIdle : paperIdle
      } ${className}`}
      aria-current={active ? "true" : undefined}
      title={planned && !active ? `${group} board is planned — not yet published` : undefined}
    >
      <span>{group}</span>
      {planned && !active ? <span className="text-[0.58rem] font-bold normal-case tracking-normal text-court-400">Planned</span> : null}
    </button>
  );
}
