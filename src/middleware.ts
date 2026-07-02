import { UserRole } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";

import {
  PORTAL_SESSION_COOKIE_NAME,
  portalSessionSecret,
  verifyPortalSessionToken,
} from "@/lib/portal-session-token-edge";

const LOGIN_PATH = "/portal/login";
const ORGANIZER_PATH = "/organizer";

function middlewareSecret(): string | null {
  try {
    return portalSessionSecret();
  } catch {
    return null;
  }
}

function withRequestContext(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const correlationId = request.headers.get("x-correlation-id") ?? requestId;
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-correlation-id", correlationId);
  return { requestHeaders, requestId, correlationId };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { requestHeaders, requestId, correlationId } = withRequestContext(request);

  if (!pathname.startsWith("/admin")) {
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.headers.set("x-request-id", requestId);
    response.headers.set("x-correlation-id", correlationId);
    return response;
  }

  const secret = middlewareSecret();
  if (!secret) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  const rawSession = request.cookies.get(PORTAL_SESSION_COOKIE_NAME)?.value;
  if (!rawSession) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const payload = await verifyPortalSessionToken(rawSession, secret);
  if (!payload) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("next", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(PORTAL_SESSION_COOKIE_NAME);
    return response;
  }

  if (payload.role !== UserRole.ADMIN) {
    return NextResponse.redirect(new URL(ORGANIZER_PATH, request.url));
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("x-request-id", requestId);
  response.headers.set("x-correlation-id", correlationId);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|peach-basket|uploads|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
