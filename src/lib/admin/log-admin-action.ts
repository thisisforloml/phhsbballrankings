import { prisma } from "@/lib/prisma";

export async function writeAuditLog(input: {
  userId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  reason: string;
  previousData?: unknown;
  newData?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      reason: input.reason,
      previousData: input.previousData === undefined ? undefined : (input.previousData as object),
      newData: input.newData === undefined ? undefined : (input.newData as object)
    }
  });
}
