import type { Metadata } from "next";
import { redirect } from "next/navigation";

export function generateMetadata({ params }: { params: { gender: string; age: string } }): Metadata {
  const gender = params.gender.toLowerCase() === "girls" ? "Girls" : "Boys";
  const age = params.age.toUpperCase();
  return {
    title: `${age} ${gender} Rankings`,
    description: `${age} ${gender} player rankings on Peach Basket.`
  };
}

export default function RankingRedirectPage({ params }: { params: { gender: string; age: string } }) {
  const gender = params.gender.toLowerCase() === "girls" ? "Girls" : "Boys";
  const age = params.age.toUpperCase();
  redirect(`/rankings?gender=${gender}&age=${age}`);
}
