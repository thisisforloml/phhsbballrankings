import { ProfileClaimStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { limitedText, PublicRequestError, readLimitedPublicJson } from "@/lib/public-request-guard";

export async function POST(request: Request) {
  try {
    const body = await readLimitedPublicJson(request, "profile-claims");

    const playerId = limitedText(body, "playerId", 80);
    const claimantName = limitedText(body, "claimantName", 120);
    const relationship = limitedText(body, "relationship", 80);
    const contact = limitedText(body, "contact", 200);
    const message = limitedText(body, "message", 1000) || null;

    if (!playerId || !claimantName || !relationship || !contact) {
      return NextResponse.json({ ok: false, message: "Player, name, relationship, and contact are required." }, { status: 400 });
    }

    const player = await prisma.player.findFirst({
      where: { id: playerId, deletedAt: null },
      select: { id: true }
    });
    if (!player) {
      return NextResponse.json({ ok: false, message: "Player not found." }, { status: 404 });
    }

    const existingPending = await prisma.profileClaim.findFirst({
      where: { playerId, status: ProfileClaimStatus.PENDING }
    });
    if (existingPending) {
      return NextResponse.json({ ok: false, message: "A pending claim already exists for this player." }, { status: 409 });
    }

    const isEmail = contact.includes("@");
    const claim = await prisma.profileClaim.create({
      data: {
        playerId,
        claimantName,
        relationship,
        contactEmail: isEmail ? contact : null,
        contactPhone: isEmail ? null : contact,
        message,
        evidenceJson: { source: "public_claim_form" }
      },
      select: { id: true }
    });

    return NextResponse.json({ ok: true, message: "Claim submitted for review.", claimId: claim.id });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Could not submit claim." },
      { status: error instanceof PublicRequestError ? error.status : 500 }
    );
  }
}
