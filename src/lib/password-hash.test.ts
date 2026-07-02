import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hashPassword,
  isLegacySha256PasswordHash,
  legacySha256PasswordHash,
  verifyPassword,
} from "@/lib/password-hash";

describe("password-hash", () => {
  it("detects legacy SHA-256 hex hashes", () => {
    const legacy = legacySha256PasswordHash("Organizer123");
    assert.equal(isLegacySha256PasswordHash(legacy), true);
    assert.equal(isLegacySha256PasswordHash("$argon2id$v=19$m=19456,t=2,p=1$abc"), false);
  });

  it("verifies legacy SHA-256 and flags upgrade", async () => {
    const legacy = legacySha256PasswordHash("test-password");
    const result = await verifyPassword("test-password", legacy);
    assert.equal(result.valid, true);
    assert.equal(result.needsUpgrade, true);

    const wrong = await verifyPassword("wrong", legacy);
    assert.equal(wrong.valid, false);
    assert.equal(wrong.needsUpgrade, false);
  });

  it("hashes and verifies with Argon2id", async () => {
    const stored = await hashPassword("peach-basket-secret");
    assert.match(stored, /^\$argon2id\$/);
    assert.equal(isLegacySha256PasswordHash(stored), false);

    const ok = await verifyPassword("peach-basket-secret", stored);
    assert.equal(ok.valid, true);
    assert.equal(ok.needsUpgrade, false);

    const bad = await verifyPassword("other", stored);
    assert.equal(bad.valid, false);
  });
});
