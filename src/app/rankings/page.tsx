import { Suspense } from "react";
import type { Metadata } from "next";
import { getLatestNationalRankings } from "@/lib/rankings";
import { RankingsClient } from "./RankingsClient";

export const metadata: Metadata = {
  title: "U19 National Rankings",
  description: "Peach Basket player rankings by gender, age group, region, and city."
};

export default async function RankingsPage() {
  const rankings = await getLatestNationalRankings();

  return (
    <Suspense fallback={null}>
      <RankingsClient rankings={rankings} />
    </Suspense>
  );
}