import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, string>;
  if (!body.firstName || !body.lastName || !body.contact) {
    return NextResponse.json({ ok: false, message: "First name, last name, and contact are required." }, { status: 400 });
  }

  const existing = body.playerName
    ? await prisma.player.findFirst({
        where: {
          displayName: { equals: body.playerName, mode: "insensitive" },
          deletedAt: null
        }
      })
    : null;

  await prisma.playerProfileSubmission.create({
    data: {
      playerId: existing?.id,
      firstName: body.firstName,
      lastName: body.lastName,
      position: body.position || null,
      heightCm: body.heightCm ? Number(body.heightCm) : null,
      photoUrl: body.photoUrl || null,
      city: body.city || null,
      region: body.region || null,
      contact: body.contact,
      message: body.message || null
    }
  });

  return NextResponse.json({ ok: true });
}
