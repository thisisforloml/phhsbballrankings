import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = (await request.json()) as { username?: string };
  const user = await prisma.user.findFirst({
    where: {
      username: body.username,
      role: "ADMIN",
      deletedAt: null
    }
  });

  if (!user) {
    return NextResponse.json({ ok: false, message: "Administrator account required." }, { status: 403 });
  }

  const [playerSubmissions, organizerApplications] = await Promise.all([
    prisma.playerProfileSubmission.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.organizerApplication.findMany({ orderBy: { createdAt: "desc" }, take: 50 })
  ]);

  return NextResponse.json({ ok: true, playerSubmissions, organizerApplications });
}
