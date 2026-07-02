import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { organizerApprovalMessage, splitSubmissionName } from "@/lib/admin/intake-review";

describe("intake-review helpers", () => {
  it("splitSubmissionName trims and builds display name", () => {
    assert.deepEqual(splitSubmissionName("  Juan ", "  Dela Cruz "), {
      firstName: "Juan",
      lastName: "Dela Cruz",
      displayName: "Juan Dela Cruz",
    });
  });

  it("organizerApprovalMessage matches legacy API copy", () => {
    const message = organizerApprovalMessage({
      application: {
        id: "app-1",
        applicantName: "Test Org",
        organization: "Org",
        leagueName: "League",
        city: "City",
        region: "Region",
        contact: "contact",
        experienceNotes: null,
        status: "PENDING",
        createdAt: new Date(),
        reviewedAt: null,
      },
      organizerUsername: "TestOrgOrg",
      initialPassword: "Organizer123",
    });

    assert.equal(message, "Organizer approved. Login: TestOrgOrg · Organizer123");
  });
});
