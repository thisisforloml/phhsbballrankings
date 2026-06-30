import type { Metadata } from "next";
import { getHomeData, getPublicTrustMeta } from "@/lib/public-site-data";
import { HomeClient } from "./HomeClient";

/** Homepage data changes on admin publish, not per-request. Revalidate on demand via revalidatePublicRankingSurfaces(). */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Peach Basket",
  description: "Verified Philippine basketball rankings built from official submitted games.",
};

export default async function Home() {
  const data = await getHomeData();
  const trustMeta = await getPublicTrustMeta();

  return <HomeClient data={data} lastUpdated={trustMeta.lastUpdated} />;
}
