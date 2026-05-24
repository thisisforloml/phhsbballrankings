import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
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
    <main className="min-h-screen bg-surface-50 pt-20">
      <div className="grid lg:grid-cols-[17rem_1fr]">
        <AdminSidebar active="playerDuplicates" />
        <section className="container-px grid gap-6 py-8">
          <div className="rounded-lg border border-surface-200 bg-white p-6 shadow-panel">
            <p className="label">Data Health</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-stat-md text-navy-800">Player Duplicate Review</h1>
                <p className="mt-2 max-w-3xl text-ink-600">These are possible duplicates only. No automatic merge is performed. Confirm identity manually before any repair.</p>
              </div>
              <div className="grid gap-1 text-right font-mono text-mono-sm uppercase text-ink-600">
                <span>{groups.length} groups displayed</span>
                <span>{summary.needsReviewPlayerGroups ?? groups.filter((group) => group.classification === "NEEDS_REVIEW").length} need review</span>
                <span>{summary.mergeSafePlayerGroups ?? groups.filter((group) => group.classification === "MERGE_SAFE").length} merge safe</span>
              </div>
            </div>
            <p className="mt-4 rounded-md bg-amber-50 p-4 text-sm font-semibold text-amber-900">Do not merge unless identity is verified. Merge actions require a separate approved repair plan.</p>
            <p className="mt-2 text-xs text-ink-500">Report source: scripts/reports/duplicate-cleanup-plan.json{generatedAt ? ` / generated ${generatedAt}` : " / report not found"}</p>
          </div>
          <PlayerDuplicateReviewClient groups={groups} />
        </section>
      </div>
    </main>
  );
}
