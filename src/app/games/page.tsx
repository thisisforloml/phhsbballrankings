import type { Metadata } from "next";
import { getPublicGamesIndex } from "@/lib/public-site-data";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { PageBand } from "@/components/public/PageBand";
import { GamesClient } from "./GamesClient";

export const metadata: Metadata = {
  title: "Games",
  description: "Browse verified official basketball games, scores, and box scores on Peach Basket Rankings PH."
};

export default async function GamesPage() {
  const data = await getPublicGamesIndex();

  return (
    <PublicPageShell className="pb-12 pt-24">
      <PageBand
        eyebrow="Official results"
        title="Games"
        description="Verified official games with final scores and linked box scores. Results feed player rankings and team records."
      />
      <GamesClient data={data} />
    </PublicPageShell>
  );
}
