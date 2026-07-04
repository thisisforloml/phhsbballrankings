import { TeamsLoadingSkeleton } from "@/components/loading";
import { PublicPageShell } from "@/components/public/PublicPageShell";

export default function TeamsLoading() {
  return (
    <PublicPageShell variant="paper" className="pb-12 pt-20">
      <TeamsLoadingSkeleton />
    </PublicPageShell>
  );
}
