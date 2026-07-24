import type { Metadata } from "next";

import { getHomeData } from "@/lib/public-site-data";

import { HomeClient } from "./HomeClient";

/** Avoid database access during Vercel static generation; public data loads on request. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Peach Basket",
  description: "Verified Philippine basketball rankings built from official submitted games.",
};

export default async function Home() {
  const data = await getHomeData();

  return <HomeClient data={data} />;
}
