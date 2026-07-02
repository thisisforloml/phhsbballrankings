import "server-only";

import { headers } from "next/headers";

import { newRequestId } from "@/lib/logger";

const REQUEST_ID_HEADER = "x-request-id";
const CORRELATION_ID_HEADER = "x-correlation-id";

function readHeader(name: string, source?: Headers): string | null {
  if (source) return source.get(name);
  return headers().get(name);
}

export function getRequestIdFromHeaders(source?: Headers): string {
  return (
    readHeader(REQUEST_ID_HEADER, source) ??
    readHeader(CORRELATION_ID_HEADER, source) ??
    newRequestId()
  );
}

export function getCorrelationIdFromHeaders(source?: Headers): string {
  return readHeader(CORRELATION_ID_HEADER, source) ?? getRequestIdFromHeaders(source);
}

export function getClientIpFromHeaders(source?: Headers): string {
  const forwarded = readHeader("x-forwarded-for", source);
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return readHeader("x-real-ip", source) ?? "unknown";
}
