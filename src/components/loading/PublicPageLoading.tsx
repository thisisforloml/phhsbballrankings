import type { ReactNode } from "react";

import { LoadingCardGrid } from "@/components/loading/LoadingCardGrid";
import { LoadingHero } from "@/components/loading/LoadingHero";
import { LoadingStatCards } from "@/components/loading/LoadingStatCards";
import { LoadingTable } from "@/components/loading/LoadingTable";
import { PublicPageShell } from "@/components/public/PublicPageShell";

type PublicPageLoadingProps = {
  children?: ReactNode;
  variant?: "paper" | "scout";
  className?: string;
  label?: string;
};

/** Default public-route loading chrome: paper shell + lightweight skeleton. */
export function DefaultPublicLoadingSkeleton() {
  return (
    <section className="bg-paper-500" aria-busy="true" aria-label="Loading page">
      <LoadingHero variant="page" />
      <section className="container-px pb-10">
        <div className="mx-auto max-w-[74rem] space-y-6">
          <LoadingStatCards />
          <LoadingTable rows={8} showAvatar={false} />
          <LoadingCardGrid cards={4} />
        </div>
      </section>
    </section>
  );
}

export function PublicPageLoading({
  children,
  variant = "paper",
  className = "pb-12 pt-20",
  label = "Loading page",
}: PublicPageLoadingProps) {
  return (
    <PublicPageShell variant={variant} className={className}>
      <div aria-busy="true" aria-label={label}>
        {children ?? <DefaultPublicLoadingSkeleton />}
      </div>
    </PublicPageShell>
  );
}

export { PlayerProfileLoadingSkeleton } from "@/components/loading/PlayerProfileLoadingSkeleton";
