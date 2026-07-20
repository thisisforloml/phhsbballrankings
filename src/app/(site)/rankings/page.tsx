import type { Metadata } from "next";
import { Suspense } from "react";

import { PublicPageShell } from "@/components/public/PublicPageShell";
import { getPublicTrustMeta } from "@/lib/public-trust-meta";
import { getLatestNationalRankings } from "@/lib/rankings";

import { RankingsClient } from "./RankingsClient";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "National Rankings",
  description: "Peach Basket player rankings by gender, age group, region, and city.",
};

export default async function RankingsPage() {
  const rankings = await getLatestNationalRankings();
  const trustMeta = await getPublicTrustMeta();

  return (
    <PublicPageShell variant="paper" className="pb-12 pt-20">
      <Suspense fallback={<div className="container-px py-10 text-sm font-semibold text-court-600">Loading rankings…</div>}>
        <RankingsClient rankings={rankings} lastUpdated={trustMeta.lastUpdated} />
      </Suspense>
    </PublicPageShell>
  );
}
