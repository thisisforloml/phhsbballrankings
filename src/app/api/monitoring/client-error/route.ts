import { NextResponse } from "next/server";

import { logGlobalError } from "@/lib/monitoring/events";
import { getRequestIdFromHeaders } from "@/lib/request-context";

export async function POST(request: Request) {
  const requestId = getRequestIdFromHeaders(request.headers);
  let body: { message?: string; digest?: string | null; stack?: string | null } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const error = new Error(body.message || "Client error");
  if (body.stack) error.stack = body.stack;

  logGlobalError(error, {
    requestId,
    digest: body.digest,
    source: "client_global_error",
  });

  return NextResponse.json({ ok: true, requestId });
}
