import { prisma } from "@/lib/prisma";

export type PlayerProgramTransferHistoryRow = {
  id: string;
  fromProgramName: string;
  toProgramName: string;
  effectiveDate: string | null;
  reason: string | null;
  administratorName: string;
  createdAt: string;
};

function formatDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

function readHistoryIdFromAudit(newData: unknown): string | null {
  if (!newData || typeof newData !== "object") return null;
  const historyId = (newData as { historyId?: unknown }).historyId;
  return typeof historyId === "string" ? historyId : null;
}

export async function loadPlayerTransferHistory(playerId: string): Promise<PlayerProgramTransferHistoryRow[]> {
  const [historyRows, auditRows] = await Promise.all([
    prisma.playerProgramHistory.findMany({
      where: { playerId, changeType: "TRANSFER" },
      include: {
        fromProgram: { select: { fullName: true } },
        toProgram: { select: { fullName: true } },
      },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
      take: 50,
    }),
    prisma.auditLog.findMany({
      where: { entityType: "PLAYER", entityId: playerId, action: "TRANSFER_PROGRAM" },
      include: { user: { select: { name: true, username: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const administratorByHistoryId = new Map<string, string>();
  for (const audit of auditRows) {
    const historyId = readHistoryIdFromAudit(audit.newData);
    if (!historyId || administratorByHistoryId.has(historyId)) continue;
    administratorByHistoryId.set(historyId, audit.user?.name ?? audit.user?.username ?? "Administrator");
  }

  return historyRows.map((row) => ({
    id: row.id,
    fromProgramName: row.fromProgram?.fullName ?? "Unassigned",
    toProgramName: row.toProgram?.fullName ?? "Unassigned",
    effectiveDate: formatDate(row.effectiveDate),
    reason: row.note,
    administratorName: administratorByHistoryId.get(row.id) ?? "—",
    createdAt: row.createdAt.toISOString(),
  }));
}
