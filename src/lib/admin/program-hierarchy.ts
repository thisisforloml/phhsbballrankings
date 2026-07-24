import { ProgramRole } from "@prisma/client";

import { GROUP_PROGRAM_ROLE } from "@/lib/admin/program-role";
import { prisma } from "@/lib/prisma";

export type ProgramHierarchyRecord = {
  id: string;
  fullName: string;
  abbreviation: string | null;
  parentProgramId: string | null;
  programRole: ProgramRole;
  deletedAt: Date | null;
};

export type ProgramHierarchyBreadcrumb = {
  id: string;
  fullName: string;
};

export type ProgramHierarchyChild = {
  id: string;
  fullName: string;
  abbreviation: string | null;
};

export type ProgramParentPickerOption = {
  id: string;
  fullName: string;
  abbreviation: string | null;
};

export function buildProgramsById(programs: ProgramHierarchyRecord[]) {
  return new Map(programs.map((program) => [program.id, program]));
}

export function buildChildrenByParentId(programs: ProgramHierarchyRecord[]) {
  const childrenByParentId = new Map<string, string[]>();

  for (const program of programs) {
    if (!program.parentProgramId) continue;
    const siblings = childrenByParentId.get(program.parentProgramId) ?? [];
    siblings.push(program.id);
    childrenByParentId.set(program.parentProgramId, siblings);
  }

  const programsById = buildProgramsById(programs);
  for (const [parentId, childIds] of childrenByParentId) {
    childIds.sort((left, right) =>
      (programsById.get(left)?.fullName ?? "").localeCompare(programsById.get(right)?.fullName ?? ""),
    );
    childrenByParentId.set(parentId, childIds);
  }

  return childrenByParentId;
}

export function countChildPrograms(programId: string, childrenByParentId: Map<string, string[]>) {
  return childrenByParentId.get(programId)?.length ?? 0;
}

export function collectDescendantProgramIds(programId: string, childrenByParentId: Map<string, string[]>) {
  const descendants = new Set<string>();
  const stack = [...(childrenByParentId.get(programId) ?? [])];

  while (stack.length) {
    const childId = stack.pop();
    if (!childId || descendants.has(childId)) continue;
    descendants.add(childId);
    stack.push(...(childrenByParentId.get(childId) ?? []));
  }

  return descendants;
}

export function buildProgramBreadcrumb(
  programId: string,
  programsById: Map<string, ProgramHierarchyRecord>,
): ProgramHierarchyBreadcrumb[] {
  const breadcrumb: ProgramHierarchyBreadcrumb[] = [];
  const visited = new Set<string>();
  let cursor = programsById.get(programId)?.parentProgramId ?? null;

  while (cursor) {
    if (visited.has(cursor)) break;
    visited.add(cursor);
    const program = programsById.get(cursor);
    if (!program) break;
    breadcrumb.unshift({ id: program.id, fullName: program.fullName });
    cursor = program.parentProgramId;
  }

  return breadcrumb;
}

export function validateProgramParentAssignment(
  programId: string,
  nextParentProgramId: string | null,
  programsById: Map<string, ProgramHierarchyRecord>,
  childrenByParentId: Map<string, string[]>,
) {
  if (!programsById.has(programId)) {
    throw new Error("Program does not exist or has been archived.");
  }

  if (!nextParentProgramId) return;

  if (nextParentProgramId === programId) {
    throw new Error("A Program cannot belong to itself.");
  }

  const parent = programsById.get(nextParentProgramId);
  if (!parent || parent.deletedAt) {
    throw new Error("Selected organization does not exist or has been archived.");
  }

  if (parent.programRole !== GROUP_PROGRAM_ROLE) {
    throw new Error("Only Organizations can group Programs.");
  }

  const descendants = collectDescendantProgramIds(programId, childrenByParentId);
  if (descendants.has(nextParentProgramId)) {
    throw new Error("This organization assignment would create a circular grouping.");
  }

  const visited = new Set<string>();
  let cursor: string | null = nextParentProgramId;
  while (cursor) {
    if (cursor === programId) {
      throw new Error("This organization assignment would create a circular grouping.");
    }
    if (visited.has(cursor)) {
      throw new Error("Invalid hierarchy: circular reference detected.");
    }
    visited.add(cursor);
    cursor = programsById.get(cursor)?.parentProgramId ?? null;
  }
}

export async function loadProgramHierarchyRecords() {
  return prisma.program.findMany({
    select: {
      id: true,
      fullName: true,
      abbreviation: true,
      parentProgramId: true,
      programRole: true,
      deletedAt: true,
    },
    orderBy: { fullName: "asc" },
  });
}

export async function loadProgramHierarchyContext(programId: string) {
  const programs = await loadProgramHierarchyRecords();
  const activePrograms = programs.filter((program) => !program.deletedAt);
  const programsById = buildProgramsById(programs);
  const childrenByParentId = buildChildrenByParentId(activePrograms);
  const current = programsById.get(programId);

  if (!current || current.deletedAt) {
    throw new Error("Program does not exist or has been archived.");
  }

  const descendants = collectDescendantProgramIds(programId, childrenByParentId);
  const excludedParentIds = new Set<string>([programId, ...descendants]);
  const parentPickerOptions: ProgramParentPickerOption[] = activePrograms
    .filter((program) => program.programRole === GROUP_PROGRAM_ROLE && !excludedParentIds.has(program.id))
    .map((program) => ({
      id: program.id,
      fullName: program.fullName,
      abbreviation: program.abbreviation,
    }));

  const childPrograms: ProgramHierarchyChild[] = (childrenByParentId.get(programId) ?? [])
    .map((childId) => programsById.get(childId))
    .filter((program): program is ProgramHierarchyRecord => {
      if (!program) return false;
      return !program.deletedAt;
    })
    .map((program) => ({
      id: program.id,
      fullName: program.fullName,
      abbreviation: program.abbreviation,
    }));

  const breadcrumb = buildProgramBreadcrumb(programId, programsById);
  const parentProgram = current.parentProgramId ? programsById.get(current.parentProgramId) : null;

  return {
    parentProgramId: current.parentProgramId,
    parentProgram: parentProgram && !parentProgram.deletedAt
      ? { id: parentProgram.id, fullName: parentProgram.fullName, abbreviation: parentProgram.abbreviation }
      : null,
    breadcrumb,
    childPrograms,
    parentPickerOptions,
  };
}

export async function updateProgramParentProgramId(programId: string, nextParentProgramId: string | null) {
  const programs = await loadProgramHierarchyRecords();
  const programsById = buildProgramsById(programs);
  const childrenByParentId = buildChildrenByParentId(programs.filter((program) => !program.deletedAt));

  validateProgramParentAssignment(programId, nextParentProgramId, programsById, childrenByParentId);

  await prisma.program.update({
    where: { id: programId },
    data: { parentProgramId: nextParentProgramId },
    select: { id: true },
  });
}

export type ProgramTreeRow = {
  program: ProgramHierarchyRecord & {
    teamCount?: number;
    derivedPlayerCount?: number;
    officialGameCount?: number;
    possibleDuplicateContextGroups?: number;
    type?: string;
    city?: string | null;
    region?: string | null;
    abbreviation?: string | null;
  };
  depth: number;
  hasChildren: boolean;
};

export function flattenProgramTreeRows<T extends { id: string; fullName: string; parentProgramId: string | null }>(
  programs: T[],
  visibleIds: Set<string>,
  childrenByParentId: Map<string, string[]>,
  collapsedIds: Set<string>,
  forceExpandIds: Set<string> = new Set(),
): Array<{ program: T; depth: number; hasChildren: boolean }> {
  const programsById = new Map(programs.map((program) => [program.id, program]));
  const roots = programs
    .filter((program) => !program.parentProgramId || !programsById.has(program.parentProgramId))
    .map((program) => program.id)
    .filter((id) => {
      const nodeVisible = (nodeId: string): boolean => {
        if (visibleIds.has(nodeId)) return true;
        return (childrenByParentId.get(nodeId) ?? []).some((childId) => nodeVisible(childId));
      };
      return nodeVisible(id);
    })
    .sort((left, right) =>
      (programsById.get(left)?.fullName ?? "").localeCompare(programsById.get(right)?.fullName ?? ""),
    );

  const rows: Array<{ program: T; depth: number; hasChildren: boolean }> = [];

  const walk = (programId: string, depth: number) => {
    const program = programsById.get(programId);
    if (!program) return;

    const childIds = (childrenByParentId.get(programId) ?? []).filter((childId) => {
      const childVisible = (nodeId: string): boolean => {
        if (visibleIds.has(nodeId)) return true;
        return (childrenByParentId.get(nodeId) ?? []).some((grandchildId) => childVisible(grandchildId));
      };
      return childVisible(childId);
    });
    const hasChildren = childIds.length > 0;
    const showNode =
      visibleIds.has(programId) ||
      childIds.some((childId) => visibleIds.has(childId) || (childrenByParentId.get(childId) ?? []).length > 0);

    if (showNode) {
      rows.push({ program, depth, hasChildren });
    }

    if (!hasChildren || (collapsedIds.has(programId) && !forceExpandIds.has(programId))) return;
    for (const childId of childIds) {
      walk(childId, depth + 1);
    }
  };

  for (const rootId of roots) {
    walk(rootId, 0);
  }

  return rows;
}
