import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appendOrganizerApplicationAuditNote,
  formatOrganizerApplicationActorLabel,
  ORGANIZER_APPLICATION_DELETE_REASON,
  organizerApprovalMessage,
  splitSubmissionName,
} from "@/lib/admin/intake-review";

describe("intake-review helpers", () => {
  it("splitSubmissionName trims and builds display name", () => {
    assert.deepEqual(splitSubmissionName("  Juan ", "  Dela Cruz "), {
      firstName: "Juan",
      lastName: "Dela Cruz",
      displayName: "Juan Dela Cruz",
    });
  });

  it("appendOrganizerApplicationAuditNote preserves prior notes", () => {
    const note = appendOrganizerApplicationAuditNote(
      "Prior note",
      "Admin User",
      ORGANIZER_APPLICATION_DELETE_REASON,
    );
    assert.match(note, /^Prior note\n\[/);
    assert.match(note, /Admin User: Admin removed organizer application$/);
  });

  it("formatOrganizerApplicationActorLabel prefers name", () => {
    assert.equal(formatOrganizerApplicationActorLabel({ name: "Admin User", username: "admin" }), "Admin User");
    assert.equal(formatOrganizerApplicationActorLabel({ name: "  ", username: "admin" }), "admin");
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
        adminNotes: null,
        status: "PENDING",
        createdAt: new Date(),
        reviewedAt: null,
        deletedAt: null,
        deletedById: null,
      },
      organizerUsername: "TestOrgOrg",
      initialPassword: "Organizer123",
    });

    assert.equal(message, "Organizer approved. Login: TestOrgOrg · Organizer123");
  });
});
