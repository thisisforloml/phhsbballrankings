import { Suspense } from "react";
import type { Metadata } from "next";
import { getLatestNationalRankings } from "@/lib/rankings";
import { getPublicTrustMeta } from "@/lib/public-site-data";
import {
  buildPostPrismaReport,
  enablePostPrismaProfile,
  measureJsonPayload,
  postPrismaMark,
  writePostPrismaReport,
} from "@/lib/post-prisma-profile";
import { RankingsClient } from "./RankingsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "National Rankings",
  description: "Peach Basket player rankings by gender, age group, region, and city.",
};

export default async function RankingsPage() {
  if (process.env.POST_PRISMA_PROFILE === "1") {
    enablePostPrismaProfile("/rankings");
  }

  const rankings = await getLatestNationalRankings();
  postPrismaMark("loader.getLatestNationalRankings.done");

  const trustMeta = await getPublicTrustMeta();
  postPrismaMark("loader.getPublicTrustMeta.done");

  if (process.env.POST_PRISMA_PROFILE === "1") {
    const playerCount = Object.values(rankings.snapshotsByAge).reduce(
      (sum, board) => sum + board.boys.rows.length + board.girls.rows.length,
      0
    );
    measureJsonPayload("rankings", rankings);
    measureJsonPayload("trustMeta", trustMeta);
    measureJsonPayload("rankingsPageProps", { rankings, lastUpdated: trustMeta.lastUpdated });
    postPrismaMark("page.beforeReturn", { playerCount });
    writePostPrismaReport(
      buildPostPrismaReport({ rankings, route: "/rankings" }),
      "rankings-server.json"
    );
  }

  return (
    <Suspense fallback={null}>
      <RankingsClient rankings={rankings} lastUpdated={trustMeta.lastUpdated} />
    </Suspense>
  );
}
