import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  invalidateAdminEvidenceCaches,
  invalidateAdminSubmissionListCaches,
} from "@/lib/admin/invalidate-admin-caches";

describe("invalidate-admin-caches", () => {
  it("runs evidence invalidation without throwing", () => {
    assert.doesNotThrow(() => invalidateAdminEvidenceCaches());
  });

  it("runs submission list invalidation without throwing", () => {
    assert.doesNotThrow(() => invalidateAdminSubmissionListCaches());
  });
});
