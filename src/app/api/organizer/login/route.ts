import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function passwordHash(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

export async function POST(request: Request) {
  const body = (await request.json()) as { username?: string; password?: string };

  if (!body.username || !body.password) {
    return NextResponse.json({ ok: false, message: "Username and password are required." }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: {
      username: body.username,
      deletedAt: null
    }
  });

  if (!user || user.passwordHash !== passwordHash(body.password)) {
    return NextResponse.json({ ok: false, message: "Invalid organizer account." }, { status: 401 });
  }

  if (user.role !== "ADMIN" && user.role !== "ORGANIZER") {
    return NextResponse.json({ ok: false, message: "This account cannot submit stats." }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role
    }
  });
}
