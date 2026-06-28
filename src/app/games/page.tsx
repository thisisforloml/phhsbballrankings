import type { Metadata } from "next";
import { getPublicGamesIndex } from "@/lib/public-site-data";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { SectionHeader } from "@/components/public/SectionHeader";
import { GamesClient } from "./GamesClient";

export const metadata: Metadata = {
  title: "Games",
  description: "Browse verified official basketball games, scores, and box scores on Peach Basket Rankings PH."
};

export default async function GamesPage() {
  const data = await getPublicGamesIndex();

  return (
    <PublicPageShell className="pb-20">
      <section className="hero-brand pt-28 text-white">
        <div className="container-px py-8">
          <SectionHeader
            title="Games"
            description="Verified official games with final scores and linked box scores. Results feed player rankings and team records."
            dark
            variant="content"
          />
        </div>
      </section>
      <GamesClient data={data} />
    </PublicPageShell>
  );
}
