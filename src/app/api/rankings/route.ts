import { NextResponse } from "next/server";

import { getEligibleRankings } from "@/lib/players";

export async function GET() {
  const rankings = await getEligibleRankings();
  return NextResponse.json({ rankings });
}
