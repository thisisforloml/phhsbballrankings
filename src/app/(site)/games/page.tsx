import type { Metadata } from "next";

import { PublicPageShell } from "@/components/public/PublicPageShell";
import { ScoutPageHeader } from "@/components/public/ScoutPageHeader";
import { getPublicGamesIndex } from "@/lib/public-site-data";

import { GamesClient } from "./GamesClient";

export const metadata: Metadata = {
  title: "Games",
  description: "Browse verified official basketball games, scores, and box scores on Peach Basket Rankings PH."
};

export default async function GamesPage() {
  const data = await getPublicGamesIndex();
  const today = new Date().toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  });

  return (
    <PublicPageShell variant="scout" className="pb-12 pt-20">
      <ScoutPageHeader
        eyebrow="Official results"
        title="Games & Scores"
        meta={`${data.games.length} games · ${today}`}
      />
      <GamesClient data={data} />
    </PublicPageShell>
  );
}
