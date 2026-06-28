import { NextResponse } from "next/server";
import { getPlayerProfileBySlug } from "@/lib/player-profile";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: { slug: string } }) {
  const profile = await getPlayerProfileBySlug(context.params.slug);
  if (!profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ slug: profile.slug, profile });
}
