import { NextResponse } from "next/server";

import { searchPublicSite } from "@/lib/public-search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const results = await searchPublicSite(query);
  return NextResponse.json(results);
}
