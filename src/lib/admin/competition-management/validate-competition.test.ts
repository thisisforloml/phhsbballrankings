import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readAgeGroups, readGenders } from "@/lib/admin/competition-management/validate-competition";

describe("validate-competition", () => {
  it("reads default age groups from form data", () => {
    const formData = new FormData();
    formData.append("defaultAgeGroups", "U13");
    formData.append("defaultAgeGroups", "U19");
    assert.deepEqual(readAgeGroups(formData), ["U13", "U19"]);
  });

  it("reads default genders from form data", () => {
    const formData = new FormData();
    formData.append("defaultGenders", "BOYS");
    assert.deepEqual(readGenders(formData), ["BOYS"]);
  });
});
