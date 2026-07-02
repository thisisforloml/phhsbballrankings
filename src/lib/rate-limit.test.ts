import assert from "node:assert/strict";
import { beforeEach,describe, it } from "node:test";

import { assertRateLimit, consumeRateLimit, resetRateLimitStore } from "@/lib/rate-limit";

describe("rate-limit", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it("allows requests under the limit", () => {
    const config = { limit: 3, windowMs: 60_000 };
    assert.equal(consumeRateLimit("test", "ip-1", config).allowed, true);
    assert.equal(consumeRateLimit("test", "ip-1", config).allowed, true);
    assert.equal(consumeRateLimit("test", "ip-1", config).allowed, true);
    assert.equal(consumeRateLimit("test", "ip-1", config).allowed, false);
  });

  it("throws when assertRateLimit is exceeded", () => {
    const config = { limit: 1, windowMs: 60_000 };
    assertRateLimit("test", "user-1", config, "Action");
    assert.throws(() => assertRateLimit("test", "user-1", config, "Action"), /rate limit exceeded/i);
  });
});
