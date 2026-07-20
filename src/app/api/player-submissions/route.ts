import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { limitedText, PublicRequestError, readLimitedPublicJson } from "@/lib/public-request-guard";

export async function POST(request: Request) {
  try {
    const body = await readLimitedPublicJson(request, "player-submissions");
    const firstName = limitedText(body, "firstName", 80);
    const lastName = limitedText(body, "lastName", 80);
    const contact = limitedText(body, "contact", 200);
    if (!firstName || !lastName || !contact) {
      return NextResponse.json({ ok: false, message: "First name, last name, and contact are required." }, { status: 400 });
    }

    const playerName = limitedText(body, "playerName", 160);
    const existing = playerName
      ? await prisma.player.findFirst({
          where: { displayName: { equals: playerName, mode: "insensitive" }, deletedAt: null }
        })
      : null;

    const heightRaw = limitedText(body, "heightCm", 3);
    const heightCm = heightRaw ? Number(heightRaw) : null;
    if (heightCm !== null && (!Number.isInteger(heightCm) || heightCm < 120 || heightCm > 230)) {
      return NextResponse.json({ ok: false, message: "Height must be between 120 and 230 cm." }, { status: 400 });
    }

    await prisma.playerProfileSubmission.create({
      data: {
        playerId: existing?.id,
        firstName,
        lastName,
        position: limitedText(body, "position", 20) || null,
        heightCm,
        photoUrl: limitedText(body, "photoUrl", 500) || null,
        city: limitedText(body, "city", 100) || null,
        region: limitedText(body, "region", 100) || null,
        contact,
        message: limitedText(body, "message", 1000) || null
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Could not submit profile." },
      { status: error instanceof PublicRequestError ? error.status : 500 }
    );
  }
}
