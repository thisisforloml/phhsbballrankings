import { createHmac, timingSafeEqual } from "node:crypto";

import {
  base64UrlEncode,
  parsePortalSessionPayload,
  type PortalSessionPayload,
} from "@/lib/portal-session-token-edge";

function timingSafeEqualStrings(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function signPortalSessionPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function encodePortalSessionToken(payload: PortalSessionPayload, secret: string): string {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${signPortalSessionPayload(encodedPayload, secret)}`;
}

export function verifyPortalSessionTokenSync(
  token: string,
  secret: string,
): PortalSessionPayload | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;
  if (!timingSafeEqualStrings(signature, signPortalSessionPayload(encodedPayload, secret))) {
    return null;
  }
  return parsePortalSessionPayload(encodedPayload);
}
