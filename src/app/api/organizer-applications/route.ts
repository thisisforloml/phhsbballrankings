import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, string>;
  if (!body.applicantName || !body.organization || !body.leagueName || !body.city || !body.region || !body.contact) {
    return NextResponse.json({ ok: false, message: "Please complete all required organizer application fields." }, { status: 400 });
  }

  await prisma.organizerApplication.create({
    data: {
      applicantName: body.applicantName,
      organization: body.organization,
      leagueName: body.leagueName,
      city: body.city,
      region: body.region,
      contact: body.contact,
      experienceNotes: body.experienceNotes || null
    }
  });

  return NextResponse.json({ ok: true });
}
