import Link from "next/link";

import type { PublicTrustMeta } from "@/lib/public-rankings-coverage";

function formatTrustDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  });
}

type TrustBandProps = {
  trustMeta?: PublicTrustMeta;
  className?: string;
  variant?: "paper" | "scout" | "scout-panel";
};

export function TrustBand({ trustMeta, className = "", variant = "paper" }: TrustBandProps) {
  const lastUpdatedLabel = trustMeta?.lastUpdated ? formatTrustDate(trustMeta.lastUpdated) : null;
  const linkClass =
    variant === "paper"
      ? "font-bold text-hardwood-600 hover:text-hardwood-700"
      : "font-bold text-scout-orange-bright hover:text-hardwood-500";

  if (variant === "scout-panel") {
    return (
      <section className={`container-px border-t border-white/10 py-6 md:py-12 ${className}`}>
        <div className="mx-auto max-w-[74rem]">
          <article className="rounded-sm border border-white/[0.08] bg-scout-800/80 p-6 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-scout-orange-bright">Verified intelligence</p>
            <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-white max-md:normal-case md:mt-2 md:text-3xl md:uppercase">
              Built From Official Games
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-scout-500">
              Peach Basket ranks prospects from verified box scores — not polls or social buzz.
              {lastUpdatedLabel ? <> Last updated {lastUpdatedLabel}.</> : null}
            </p>
            <div className="mt-6">
              <Link
                href="/how-we-rank"
                className="home-mobile-link inline-flex text-sm font-bold text-scout-orange-bright transition-colors duration-200 hover:text-hardwood-500"
              >
                How we rank →
              </Link>
            </div>
          </article>
        </div>
      </section>
    );
  }

  const shellClass =
    variant === "scout"
      ? "border-y border-white/10 bg-scout-800/60 py-3 text-center text-sm text-scout-500"
      : "border-y border-line-500 bg-white py-3 text-center text-sm text-court-600";

  return (
    <div className={`${shellClass} ${className}`}>
      <p>
        Rankings built from verified official games.
        {lastUpdatedLabel ? <> Last updated {lastUpdatedLabel}.</> : null}{" "}
        <Link href="/how-we-rank" className={linkClass}>
          How we rank
        </Link>
      </p>
    </div>
  );
}
