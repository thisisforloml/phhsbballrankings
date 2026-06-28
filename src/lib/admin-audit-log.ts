type AdminAuditEntry = {
  action: string;
  actorId?: string;
  submissionId?: string;
  metadata?: Record<string, unknown>;
  at: string;
};

const buffer: AdminAuditEntry[] = [];

export function logAdminAction(entry: Omit<AdminAuditEntry, "at">) {
  const row: AdminAuditEntry = { ...entry, at: new Date().toISOString() };
  buffer.push(row);
  if (buffer.length > 200) buffer.shift();
  if (process.env.NODE_ENV !== "production") {
    console.info("[admin-audit]", JSON.stringify(row));
  }
  return row;
}

export function getRecentAdminAuditEntries(limit = 20) {
  return buffer.slice(-limit).reverse();
}
