import type { Metadata } from "next";
import { getHomeData } from "@/lib/public-site-data";
import { HomeClient } from "./HomeClient";

export const metadata: Metadata = {
  title: "OnCourt Rankings Philippines",
  description: "Verified Philippine basketball rankings built from official submitted games."
};

export default async function Home() {
  const data = await getHomeData();
  return <HomeClient data={data} />;
}