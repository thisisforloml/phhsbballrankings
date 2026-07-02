import { NextResponse } from "next/server";

import { verifyPortalLoginCredentials } from "@/lib/auth/verify-portal-login";
import { childLogger, logAuthFailure } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { assertRateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { getClientIpFromHeaders } from "@/lib/request-context";

export async function POST(request: Request) {
  const body = (await request.json()) as { username?: string; password?: string };
  const log = childLogger({ route: "api/organizer/login" });
  const clientIp = getClientIpFromHeaders(request.headers);

  if (!body.username || !body.password) {
    return NextResponse.json({ ok: false, message: "Username and password are required." }, { status: 400 });
  }

  try {
    assertRateLimit("login:ip", clientIp, RATE_LIMIT_PRESETS.loginIp(), "Login");
    assertRateLimit("login:account", body.username.toLowerCase(), RATE_LIMIT_PRESETS.loginAccount(), "Login");
  } catch (error) {
    logAuthFailure(log, "rate_limited", { clientIp, username: body.username });
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Too many login attempts." },
      { status: 429 },
    );
  }

  const result = await verifyPortalLoginCredentials(body.username, body.password);
  if (!result.ok) {
    logAuthFailure(log, result.reason, { clientIp, username: body.username });
    const status = result.reason === "forbidden" ? 403 : 401;
    const message =
      result.reason === "forbidden"
        ? "This account cannot submit stats."
        : "Invalid organizer account.";
    return NextResponse.json({ ok: false, message }, { status });
  }

  const user = await prisma.user.findFirst({
    where: { id: result.user.id, deletedAt: null },
    select: { id: true, name: true, username: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ ok: false, message: "Invalid organizer account." }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
    },
  });
}
