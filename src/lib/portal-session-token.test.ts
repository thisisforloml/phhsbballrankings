import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { UserRole } from "@prisma/client";

import { verifyPortalSessionToken } from "@/lib/portal-session-token-edge";
import {
  encodePortalSessionToken,
  verifyPortalSessionTokenSync,
} from "@/lib/portal-session-token-node";

const secret = "test-portal-session-secret";

describe("portal-session-token", () => {
  it("round-trips admin payload with sync verifier", () => {
    const payload = {
      userId: "user-1",
      username: "admin",
      role: UserRole.ADMIN,
      expiresAt: Date.now() + 60_000,
    };
    const token = encodePortalSessionToken(payload, secret);
    const decoded = verifyPortalSessionTokenSync(token, secret);
    assert.deepEqual(decoded, payload);
  });

  it("round-trips organizer payload with async edge verifier", async () => {
    const payload = {
      userId: "user-2",
      username: "organizer",
      role: UserRole.ORGANIZER,
      expiresAt: Date.now() + 60_000,
    };
    const token = encodePortalSessionToken(payload, secret);
    const decoded = await verifyPortalSessionToken(token, secret);
    assert.deepEqual(decoded, payload);
  });

  it("rejects tampered signatures and expired sessions", async () => {
    const token = encodePortalSessionToken(
      {
        userId: "user-3",
        username: "admin",
        role: UserRole.ADMIN,
        expiresAt: Date.now() - 1,
      },
      secret,
    );
    assert.equal(verifyPortalSessionTokenSync(token, secret), null);

    const valid = encodePortalSessionToken(
      {
        userId: "user-3",
        username: "admin",
        role: UserRole.ADMIN,
        expiresAt: Date.now() + 60_000,
      },
      secret,
    );
    const tampered = `${valid.slice(0, -4)}xxxx`;
    assert.equal(await verifyPortalSessionToken(tampered, secret), null);
  });
});
