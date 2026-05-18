import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/portal-auth";

export async function GET() {
  const user = await getPortalUser();

  if (!user) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role
  });
}
