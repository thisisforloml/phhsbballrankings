import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function passwordHash(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

async function requireAdmin(username?: string) {
  if (!username) return null;
  return prisma.user.findFirst({
    where: {
      username,
      role: "ADMIN",
      deletedAt: null
    }
  });
}

function splitName(firstName: string, lastName: string) {
  return {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    displayName: `${firstName.trim()} ${lastName.trim()}`.trim()
  };
}

async function uniqueOrganizerUsername(applicantName: string, id: string) {
  const base = applicantName.replace(/[^a-z0-9]/gi, "").slice(0, 18) || "Organizer";
  const candidate = `${base}Org`;
  const existing = await prisma.user.findUnique({ where: { username: candidate } });
  return existing ? `${base}${id.slice(0, 4)}` : candidate;
}

export async function POST(request: Request) {
  const body = (await request.json()) as { username?: string };
  const user = await requireAdmin(body.username);

  if (!user) {
    return NextResponse.json({ ok: false, message: "Administrator account required." }, { status: 403 });
  }

  const [playerSubmissions, organizerApplications] = await Promise.all([
    prisma.playerProfileSubmission.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.organizerApplication.findMany({ orderBy: { createdAt: "desc" }, take: 50 })
  ]);

  return NextResponse.json({ ok: true, playerSubmissions, organizerApplications });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as {
    username?: string;
    type?: "player" | "organizer";
    id?: string;
    action?: "APPROVE" | "REJECT";
  };
  const user = await requireAdmin(body.username);

  if (!user || !body.id || !body.type || !body.action) {
    return NextResponse.json({ ok: false, message: "Administrator action is incomplete." }, { status: 400 });
  }

  if (body.type === "player") {
    const submission = await prisma.playerProfileSubmission.findUnique({ where: { id: body.id } });
    if (!submission) {
      return NextResponse.json({ ok: false, message: "Player submission not found." }, { status: 404 });
    }

    if (body.action === "REJECT") {
      await prisma.playerProfileSubmission.update({
        where: { id: body.id },
        data: { status: "REJECTED", reviewedAt: new Date() }
      });
      return NextResponse.json({ ok: true, message: "Player submission rejected." });
    }

    const names = splitName(submission.firstName, submission.lastName);
    if (submission.playerId) {
      await prisma.player.update({
        where: { id: submission.playerId },
        data: {
          firstName: names.firstName,
          lastName: names.lastName,
          displayName: names.displayName,
          position: submission.position ?? undefined,
          heightCm: submission.heightCm ?? undefined,
          photoUrl: submission.photoUrl ?? undefined,
          city: submission.city ?? undefined,
          region: submission.region ?? undefined
        }
      });
    } else {
      await prisma.player.create({
        data: {
          firstName: names.firstName,
          lastName: names.lastName,
          displayName: names.displayName,
          birthDate: new Date("2010-01-01T00:00:00.000Z"),
          position: submission.position?.trim() || "G",
          heightCm: submission.heightCm,
          photoUrl: submission.photoUrl,
          city: submission.city?.trim() || "Pending city",
          region: submission.region?.trim() || "Pending region"
        }
      });
    }

    await prisma.playerProfileSubmission.update({
      where: { id: body.id },
      data: { status: "APPROVED", reviewedAt: new Date() }
    });
    return NextResponse.json({ ok: true, message: "Player profile submission approved." });
  }

  const application = await prisma.organizerApplication.findUnique({ where: { id: body.id } });
  if (!application) {
    return NextResponse.json({ ok: false, message: "Organizer application not found." }, { status: 404 });
  }

  if (body.action === "REJECT") {
    await prisma.organizerApplication.update({
      where: { id: body.id },
      data: { status: "REJECTED", reviewedAt: new Date() }
    });
    return NextResponse.json({ ok: true, message: "Organizer application rejected." });
  }

  const organizerUsername = await uniqueOrganizerUsername(application.applicantName, application.id);
  await prisma.$transaction([
    prisma.user.upsert({
      where: { username: organizerUsername },
      update: { deletedAt: null, role: UserRole.ORGANIZER },
      create: {
        name: application.applicantName,
        username: organizerUsername,
        email: `${organizerUsername.toLowerCase()}@oncourt.local`,
        passwordHash: passwordHash("Organizer123"),
        role: UserRole.ORGANIZER
      }
    }),
    prisma.organizerApplication.update({
      where: { id: body.id },
      data: { status: "APPROVED", reviewedAt: new Date() }
    })
  ]);

  return NextResponse.json({
    ok: true,
    message: `Organizer approved. Login: ${organizerUsername} · Organizer123`
  });
}
