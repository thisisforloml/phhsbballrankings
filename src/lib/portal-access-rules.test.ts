import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { UserRole } from "@prisma/client";

import {
  isAdminRole,
  isPortalRole,
  resolveAdminRouteGate,
} from "@/lib/portal-access-rules";

describe("portal-access-rules (requireAdminUser gate)", () => {
  it("allows admin portal roles on admin routes", () => {
    assert.equal(resolveAdminRouteGate(true, UserRole.ADMIN).action, "allow");
    assert.equal(isAdminRole(UserRole.ADMIN), true);
    assert.equal(isPortalRole(UserRole.ADMIN), true);
  });

  it("redirects organizers away from admin routes", () => {
    const gate = resolveAdminRouteGate(true, UserRole.ORGANIZER);
    assert.deepEqual(gate, { action: "redirect", destination: "/organizer" });
    assert.equal(isAdminRole(UserRole.ORGANIZER), false);
    assert.equal(isPortalRole(UserRole.ORGANIZER), true);
  });

  it("redirects unauthenticated users to portal login", () => {
    assert.deepEqual(resolveAdminRouteGate(false, null), {
      action: "redirect",
      destination: "/portal/login",
    });
    assert.deepEqual(resolveAdminRouteGate(true, UserRole.PREMIUM_VIEWER), {
      action: "redirect",
      destination: "/portal/login",
    });
  });
});
