import { CompareLoadingSkeleton } from "@/components/loading";
import { PublicPageShell } from "@/components/public/PublicPageShell";

export default function PlayerCompareLoading() {
  return (
    <PublicPageShell>
      <CompareLoadingSkeleton />
    </PublicPageShell>
  );
}
