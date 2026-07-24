import { NextResponse } from "next/server";

import { getPublicTrustMeta } from "@/lib/public-trust-meta";

export const dynamic = "force-dynamic";

export async function GET() {
  const trustMeta = await getPublicTrustMeta();
  return NextResponse.json(trustMeta);
}
