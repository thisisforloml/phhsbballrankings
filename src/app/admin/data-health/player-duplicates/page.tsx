import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Suspense } from "react";
import { AdminAlert } from "@/components/admin/AdminAlert";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { requireAdminUser } from "@/lib/portal-auth";
import { PlayerDuplicateReviewClient, type DuplicatePlayerGroup } from "./PlayerDuplicateReviewClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Player Duplicate Review - Admin Portal",
  description: "Review possible duplicate player records without merging or modifying data."
};

type DuplicateCleanupReport = {
  generatedAt?: string;
  playerDuplicatePlan?: DuplicatePlayerGroup[];
  summary?: {
    totalPlayerDuplicateGroups?: number;
    mergeSafePlayerGroups?: number;
    needsReviewPlayerGroups?: number;
  };
};

async function loadDuplicateGroups() {
  const reportPath = join(process.cwd(), "scripts", "reports", "duplicate-cleanup-plan.json");
  try {
    const raw = await readFile(reportPath, "utf8");
    const report = JSON.parse(raw) as DuplicateCleanupReport;
    return {
      generatedAt: report.generatedAt ?? null,
      groups: report.playerDuplicatePlan ?? [],
      summary: report.summary ?? {}
    };
  } catch {
    return {
      generatedAt: null,
      groups: [] as DuplicatePlayerGroup[],
      summary: {}
    };
  }
}

export default async function PlayerDuplicateReviewPage() {
  await requireAdminUser();
  const { generatedAt, groups, summary } = await loadDuplicateGroups();

  return (
    <>
          <AdminPageHeader
            eyebrow="Data Health"
            title="Player Duplicate Review"
            description={groups.length ? "These are possible duplicates only. Confirm identity manually before any approved repair." : "The refreshed report found no possible player duplicates."}
            actions={
              <div className="grid gap-1 text-right font-mono text-[0.65rem] font-bold uppercase tracking-[0.1em] text-ink-600">
                <span>{groups.length} groups displayed</span>
                <span>{summary.needsReviewPlayerGroups ?? groups.filter((group) => group.classification === "NEEDS_REVIEW").length} need review</span>
                <span>{summary.mergeSafePlayerGroups ?? groups.filter((group) => group.classification === "MERGE_SAFE").length} approved candidates</span>
              </div>
            }
          >
            {groups.length ? (
              <AdminAlert variant="warning" size="md" className="p-4">
                Do not change player records unless identity is verified and a separate repair plan is approved.
              </AdminAlert>
            ) : (
              <AdminAlert variant="success" size="md" className="p-4">
                No review work is needed from this report.
              </AdminAlert>
            )}
            <p className="mt-2 text-xs text-ink-500">Report source: scripts/reports/duplicate-cleanup-plan.json{generatedAt ? ` / generated ${generatedAt}` : " / report not found"}</p>
          </AdminPageHeader>
          <Suspense fallback={null}>
            <PlayerDuplicateReviewClient groups={groups} />
          </Suspense>
    </>
  );
}
