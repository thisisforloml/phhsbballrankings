import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  classifyNavigationRequest,
  cookieHeaderHasSession,
  logNavInstrument,
  navTraceId,
} from "@/lib/nav-instrument";

const sessionCookieName = "oncourt_portal_session";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const traceId = navTraceId();
  const cookieHeader = request.headers.get("cookie");

  const requestKind = classifyNavigationRequest({
    pathname,
    search,
    method: request.method,
    rsc: request.headers.get("rsc"),
    nextRouterPrefetch: request.headers.get("next-router-prefetch"),
    purpose: request.headers.get("purpose"),
    secFetchDest: request.headers.get("sec-fetch-dest"),
    secFetchMode: request.headers.get("sec-fetch-mode"),
    contentType: request.headers.get("content-type"),
  });

  logNavInstrument("middleware.request", {
    traceId,
    pathname,
    matchedPath: pathname,
    search,
    method: request.method,
    requestKind,
    cookieHeaderExists: Boolean(cookieHeader),
    sessionCookieInHeader: cookieHeaderHasSession(cookieHeader, sessionCookieName),
    referer: request.headers.get("referer"),
    host: request.headers.get("host"),
    origin: request.headers.get("origin"),
    rsc: request.headers.get("rsc"),
    nextRouterPrefetch: request.headers.get("next-router-prefetch"),
    nextRouterStateTree: request.headers.get("next-router-state-tree") ? "present" : null,
    secFetchMode: request.headers.get("sec-fetch-mode"),
    secFetchDest: request.headers.get("sec-fetch-dest"),
    secFetchSite: request.headers.get("sec-fetch-site"),
    purpose: request.headers.get("purpose"),
    accept: request.headers.get("accept"),
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nav-instrument-id", traceId);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*", "/api/portal/:path*"],
};
