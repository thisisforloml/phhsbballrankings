import { createHash, timingSafeEqual } from "node:crypto";

import argon2 from "argon2";

/** OWASP Argon2id parameters (2023 memory-hard recommendation, 19 MiB). */
export const ARGON2ID_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

const LEGACY_SHA256_HEX = /^[a-f0-9]{64}$/i;

export type PasswordVerificationResult = {
  valid: boolean;
  /** True when login succeeded with a legacy SHA-256 hash and should be upgraded. */
  needsUpgrade: boolean;
};

export function isLegacySha256PasswordHash(storedHash: string): boolean {
  return LEGACY_SHA256_HEX.test(storedHash);
}

/** Legacy SHA-256 (hex). Used only for verify + upgrade during rollout. */
export function legacySha256PasswordHash(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2ID_OPTIONS);
}

function timingSafeHexEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<PasswordVerificationResult> {
  if (isLegacySha256PasswordHash(storedHash)) {
    const candidate = legacySha256PasswordHash(password);
    const valid = timingSafeHexEqual(candidate, storedHash);
    return { valid, needsUpgrade: valid };
  }

  try {
    const valid = await argon2.verify(storedHash, password);
    return { valid, needsUpgrade: false };
  } catch {
    return { valid: false, needsUpgrade: false };
  }
}
