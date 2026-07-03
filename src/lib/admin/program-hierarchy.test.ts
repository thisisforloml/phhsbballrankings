import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ProgramRole } from "@prisma/client";

import {
  buildChildrenByParentId,
  buildProgramBreadcrumb,
  buildProgramsById,
  collectDescendantProgramIds,
  type ProgramHierarchyRecord,
  validateProgramParentAssignment,
} from "@/lib/admin/program-hierarchy";

function record(
  id: string,
  fullName: string,
  parentProgramId: string | null = null,
  programRole: ProgramRole = ProgramRole.OPERATIONAL,
): ProgramHierarchyRecord {
  return { id, fullName, abbreviation: null, parentProgramId, programRole, deletedAt: null };
}

function groupRecord(
  id: string,
  fullName: string,
  parentProgramId: string | null = null,
): ProgramHierarchyRecord {
  return record(id, fullName, parentProgramId, ProgramRole.GROUP);
}

describe("program-hierarchy", () => {
  it("collects descendants", () => {
    const programs = [
      record("root", "Root"),
      record("child", "Child", "root"),
      record("grandchild", "Grandchild", "child"),
    ];
    const childrenByParentId = buildChildrenByParentId(programs);
    const descendants = collectDescendantProgramIds("root", childrenByParentId);
    assert.equal(descendants.size, 2);
    assert.ok(descendants.has("child"));
    assert.ok(descendants.has("grandchild"));
  });

  it("builds breadcrumb from root to parent", () => {
    const programs = [
      groupRecord("root", "De La Salle Philippines"),
      record("child", "La Salle Green Hills", "root"),
    ];
    const programsById = buildProgramsById(programs);
    assert.deepEqual(buildProgramBreadcrumb("child", programsById), [
      { id: "root", fullName: "De La Salle Philippines" },
    ]);
  });

  it("rejects self-parent and descendant parent", () => {
    const programs = [
      groupRecord("root", "Root"),
      groupRecord("child", "Child", "root"),
      groupRecord("grandchild", "Grandchild", "child"),
    ];
    const programsById = buildProgramsById(programs);
    const childrenByParentId = buildChildrenByParentId(programs);

    assert.throws(
      () => validateProgramParentAssignment("child", "child", programsById, childrenByParentId),
      /cannot be its own parent/i,
    );
    assert.throws(
      () => validateProgramParentAssignment("root", "grandchild", programsById, childrenByParentId),
      /circular hierarchy/i,
    );
  });

  it("rejects archived parent assignment", () => {
    const programs = [record("root", "Root"), { ...groupRecord("archived", "Archived"), deletedAt: new Date() }];
    const programsById = buildProgramsById(programs);
    const childrenByParentId = buildChildrenByParentId(programs);

    assert.throws(
      () => validateProgramParentAssignment("root", "archived", programsById, childrenByParentId),
      /archived/i,
    );
  });

  it("rejects operational program as parent", () => {
    const programs = [record("campus", "La Salle Green Hills"), record("child", "De La Salle Santiago Zobel")];
    const programsById = buildProgramsById(programs);
    const childrenByParentId = buildChildrenByParentId(programs);

    assert.throws(
      () => validateProgramParentAssignment("child", "campus", programsById, childrenByParentId),
      /only group programs can be assigned as a parent/i,
    );
  });

  it("allows group program as parent", () => {
    const programs = [groupRecord("root", "De La Salle Philippines"), record("child", "La Salle Green Hills")];
    const programsById = buildProgramsById(programs);
    const childrenByParentId = buildChildrenByParentId(programs);

    assert.doesNotThrow(() => validateProgramParentAssignment("child", "root", programsById, childrenByParentId));
  });

  it("allows clearing parent assignment", () => {
    const programs = [groupRecord("root", "De La Salle Philippines"), record("child", "La Salle Green Hills", "root")];
    const programsById = buildProgramsById(programs);
    const childrenByParentId = buildChildrenByParentId(programs);

    assert.doesNotThrow(() => validateProgramParentAssignment("child", null, programsById, childrenByParentId));
  });
});
