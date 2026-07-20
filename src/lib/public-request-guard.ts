import "server-only";

import { consumeRateLimit } from "@/lib/rate-limit";

const maxPublicJsonBytes = 32 * 1024;
const publicFormLimit = { limit: 10, windowMs: 15 * 60 * 1000 };

export class PublicRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

function clientKey(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function readLimitedPublicJson(
  request: Request,
  namespace: string
): Promise<Record<string, unknown>> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > maxPublicJsonBytes) {
    throw new PublicRequestError("Request is too large.", 413);
  }

  const limit = consumeRateLimit(namespace, clientKey(request), publicFormLimit);
  if (!limit.allowed) {
    throw new PublicRequestError("Too many requests. Please try again later.", 429);
  }

  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxPublicJsonBytes) {
    throw new PublicRequestError("Request is too large.", 413);
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Body must be an object.");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new PublicRequestError("Invalid request body.", 400);
  }
}

export function limitedText(
  body: Record<string, unknown>,
  key: string,
  maxLength: number
) {
  const value = String(body[key] ?? "").trim();
  if (value.length > maxLength) {
    throw new PublicRequestError(key + " is too long.", 400);
  }
  return value;
}
