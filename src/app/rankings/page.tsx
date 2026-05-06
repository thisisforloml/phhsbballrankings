import { Suspense } from "react";
import type { Metadata } from "next";
import { RankingsClient } from "./RankingsClient";

export const metadata: Metadata = {
  title: "U19 Boys Rankings",
  description: "OnCourt player rankings by gender, age group, region, and position."
};

export default function RankingsPage() {
  return (
    <Suspense fallback={null}>
      <RankingsClient />
    </Suspense>
  );
}
