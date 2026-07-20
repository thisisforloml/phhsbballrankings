import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { limitedText, PublicRequestError, readLimitedPublicJson } from "@/lib/public-request-guard";

export async function POST(request: Request) {
  try {
    const body = await readLimitedPublicJson(request, "organizer-applications");
    const applicantName = limitedText(body, "applicantName", 120);
    const organization = limitedText(body, "organization", 160);
    const leagueName = limitedText(body, "leagueName", 160);
    const city = limitedText(body, "city", 100);
    const region = limitedText(body, "region", 100);
    const contact = limitedText(body, "contact", 200);

    if (!applicantName || !organization || !leagueName || !city || !region || !contact) {
      return NextResponse.json({ ok: false, message: "Please complete all required organizer application fields." }, { status: 400 });
    }

    await prisma.organizerApplication.create({
      data: {
        applicantName,
        organization,
        leagueName,
        city,
        region,
        contact,
        experienceNotes: limitedText(body, "experienceNotes", 1500) || null
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Could not submit application." },
      { status: error instanceof PublicRequestError ? error.status : 500 }
    );
  }
}
