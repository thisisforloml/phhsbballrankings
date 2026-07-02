import type { Metadata } from "next";
import { Suspense } from "react";

import { getPublicTrustMeta } from "@/lib/public-site-data";
import { getLatestNationalRankings } from "@/lib/rankings";

import { RankingsClient } from "./RankingsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "National Rankings",
  description: "Peach Basket player rankings by gender, age group, region, and city.",
};

export default async function RankingsPage() {
  const rankings = await getLatestNationalRankings();
  const trustMeta = await getPublicTrustMeta();

  return (
    <Suspense fallback={null}>
      <RankingsClient rankings={rankings} lastUpdated={trustMeta.lastUpdated} />
    </Suspense>
  );
}
