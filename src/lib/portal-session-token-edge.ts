import { UserRole } from "@prisma/client";

export const PORTAL_SESSION_COOKIE_NAME = "oncourt_portal_session";

export type PortalSessionPayload = {
  userId: string;
  username: string;
  role: UserRole;
  expiresAt: number;
};

const PORTAL_ROLES = new Set<UserRole>([UserRole.ADMIN, UserRole.ORGANIZER]);

export function portalSessionSecret(): string {
  const secret = process.env.PORTAL_SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") {
    return "development-only-oncourt-portal-session-secret";
  }
  throw new Error("PORTAL_SESSION_SECRET is required in production.");
}

export function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

export function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function timingSafeEqualStrings(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export function parsePortalSessionPayload(encodedPayload: string): PortalSessionPayload | null {
  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as PortalSessionPayload;
    if (!payload.userId || !payload.username || !payload.role || !payload.expiresAt) return null;
    if (!PORTAL_ROLES.has(payload.role)) return null;
    if (payload.expiresAt <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function signPortalSessionPayloadAsync(
  encodedPayload: string,
  secret: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload));
  return base64UrlEncodeBytes(new Uint8Array(mac));
}

export async function verifyPortalSessionToken(
  token: string,
  secret: string,
): Promise<PortalSessionPayload | null> {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expected = await signPortalSessionPayloadAsync(encodedPayload, secret);
  if (!timingSafeEqualStrings(signature, expected)) return null;

  return parsePortalSessionPayload(encodedPayload);
}
