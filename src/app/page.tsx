import type { Metadata } from "next";
import { HomeClient } from "./HomeClient";

export const metadata: Metadata = {
  title: "OnCourt Rankings Philippines",
  description: "Verified Philippine basketball rankings built from official submitted games."
};

export default function Home() {
  return <HomeClient />;
}
