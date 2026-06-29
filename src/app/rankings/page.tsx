import { Suspense } from "react";
import type { Metadata } from "next";
import { getLatestNationalRankings } from "@/lib/rankings";
import { getPublicTrustMeta } from "@/lib/public-site-data";
import { RankingsClient } from "./RankingsClient";

export const metadata: Metadata = {
  title: "National Rankings",
  description: "Peach Basket player rankings by gender, age group, region, and city."
};

export default async function RankingsPage() {
  const [rankings, trustMeta] = await Promise.all([getLatestNationalRankings(), getPublicTrustMeta()]);

  return (
    <Suspense fallback={null}>
      <RankingsClient rankings={rankings} lastUpdated={trustMeta.lastUpdated} />
    </Suspense>
  );
}
