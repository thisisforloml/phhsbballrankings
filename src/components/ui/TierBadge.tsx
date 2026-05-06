import type { Tier } from "@/lib/mock-data";

const labels: Record<Tier, string> = {
  1: "Weight 1",
  2: "Weight 2",
  3: "Weight 3",
  4: "Weight 4"
};

export function TierBadge({ tier }: { tier: Tier }) {
  return <span className="rounded-full bg-navy-800 px-2.5 py-1 font-mono text-mono-sm uppercase text-white">{labels[tier]}</span>;
}
