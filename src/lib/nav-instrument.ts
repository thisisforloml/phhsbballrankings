/** TEMP: navigation/auth diagnosis helpers — remove after diagnosis */

export const NAV_INSTRUMENT = "[NAV_INSTRUMENT]";

export type RequestKind = "prefetch" | "rsc" | "document" | "action" | "other";

export function navTraceId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function classifyNavigationRequest(input: {
  pathname: string;
  search: string;
  method: string;
  rsc: string | null;
  nextRouterPrefetch: string | null;
  purpose: string | null;
  secFetchDest: string | null;
  secFetchMode: string | null;
  contentType: string | null;
}): RequestKind {
  if (input.nextRouterPrefetch === "1" || input.purpose === "prefetch") return "prefetch";
  if (input.rsc === "1" || input.search.includes("_rsc=") || input.pathname.endsWith(".rsc")) return "rsc";
  if (input.method === "POST" && input.contentType?.includes("text/plain")) return "action";
  if (input.secFetchDest === "document") return "document";
  return "other";
}

export function cookieHeaderHasSession(cookieHeader: string | null | undefined, cookieName: string) {
  return Boolean(cookieHeader?.includes(`${cookieName}=`));
}

export function logNavInstrument(event: string, fields: Record<string, unknown>) {
  console.log(NAV_INSTRUMENT, JSON.stringify({ event, ...fields }));
}
