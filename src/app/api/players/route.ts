import { NextResponse } from "next/server";

import { getPlayerSummaries } from "@/lib/players";

export const dynamic = "force-dynamic";

export async function GET() {
  const players = await getPlayerSummaries();
  return NextResponse.json({ players });
}
