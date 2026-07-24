import Link from "next/link";

import { AdminAlert } from "@/components/admin/AdminAlert";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { loadAllPlayerDuplicateCandidates } from "@/lib/admin/load-player-duplicate-candidates";
import { buildPlayerMergePreview, loadPlayerMergeOptions, type PlayerMergePreview } from "@/lib/admin/player-merge";
import { requireAdminUser } from "@/lib/portal-auth";

import { ManualPlayerMergePicker } from "./ManualPlayerMergePicker";
import { PlayerDuplicateReviewClient } from "./PlayerDuplicateReviewClient";
import { PlayerMergeExecuteForm } from "./PlayerMergeExecuteForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

export const metadata = {
  title: "Player Matches - Peach Basket Admin",
  description: "Review and merge duplicate Player records.",
};

type SearchParams = {
  canonical?: string;
  duplicate?: string;
  duplicates?: string;
  merged?: string;
  mode?: string;
};

function selectedDuplicateIds(searchParams: SearchParams) {
  const rawValue = searchParams.duplicates ?? searchParams.duplicate ?? "";
  return Array.from(new Set(
    rawValue.split(",").map((value) => value.trim()).filter(Boolean),
  ));
}

async function loadPreview(canonicalPlayerId: string | undefined, duplicatePlayerIds: string[]) {
  if (!canonicalPlayerId || duplicatePlayerIds.length === 0) return { preview: null, error: null };
  try {
    return {
      preview: await buildPlayerMergePreview(canonicalPlayerId, duplicatePlayerIds),
      error: null,
    };
  } catch (error) {
    return {
      preview: null,
      error: error instanceof Error ? error.message : "Could not build merge preview.",
    };
  }
}

function MergePreview({ preview }: { preview: PlayerMergePreview }) {
  const impactRows = [
    ["Profiles", preview.duplicates.length],
    ["Game stats", preview.impact.gameStats],
    ["Scores", preview.impact.performanceScores],
    ["Rosters", preview.impact.rosterAssignments],
    ["Ratings", preview.impact.ratings],
    ["Snapshots", preview.impact.snapshotRows],
  ] as const;

  return (
    <section id="merge-preview" className="overflow-hidden border-2 border-orange-300 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-orange-200 bg-orange-50 p-4">
        <div>
          <p className="text-xs font-semibold text-orange-700">Merge preview</p>
          <h2 className="mt-1 text-xl font-bold text-navy-900">Keep {preview.canonical.displayName}</h2>
          <p className="mt-1 text-sm text-ink-600">
            Archive {preview.duplicates.map((player) => player.displayName).join(", ")}
          </p>
        </div>
        <Link href="/admin/data-health/player-duplicates?mode=manual" className="text-sm font-semibold text-navy-700 hover:underline">
          Cancel
        </Link>
      </div>

      <div className="grid gap-3 p-4">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {impactRows.map(([label, value]) => (
            <div key={label} className="border border-surface-200 bg-surface-50 px-3 py-2">
              <p className="text-xs text-ink-500">{label}</p>
              <p className="font-mono text-lg font-bold text-navy-900">{value}</p>
            </div>
          ))}
        </div>

        {preview.warnings.length ? (
          <AdminAlert variant="warning" size="md">
            <ul className="list-disc space-y-1 pl-5">
              {preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          </AdminAlert>
        ) : null}
        {preview.blockers.length ? (
          <AdminAlert variant="error" size="md">
            <p className="font-semibold">Merge blocked</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {preview.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
            </ul>
          </AdminAlert>
        ) : (
          <AdminAlert variant="success" size="md">
            Checks passed for all selected profiles. The complete merge either succeeds or rolls back.
          </AdminAlert>
        )}
      </div>

      {preview.canMerge ? (
        <PlayerMergeExecuteForm
          canonicalPlayerId={preview.canonical.id}
          duplicatePlayerIds={preview.duplicates.map((player) => player.id)}
          expectedFingerprint={preview.fingerprint}
        />
      ) : null}
    </section>
  );
}

export default async function PlayerDuplicateReviewPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdminUser();
  const duplicatePlayerIds = selectedDuplicateIds(searchParams);
  const hasPreview = Boolean(searchParams.canonical && duplicatePlayerIds.length);
  const manualMode = searchParams.mode === "manual" && !hasPreview;

  const previewResult = hasPreview
    ? await loadPreview(searchParams.canonical, duplicatePlayerIds)
    : { preview: null, error: null };
  const mergeOptions = manualMode ? await loadPlayerMergeOptions() : [];
  const pairs = !manualMode && !hasPreview ? await loadAllPlayerDuplicateCandidates() : [];

  return (
    <>
      <AdminPageHeader
        title="Player Matches"
        description="Review likely matches or merge selected profiles manually."
        actions={(
          <div className="flex gap-2">
            <Link href="/admin/data-health/player-duplicates" className="button secondary">Matches</Link>
            <Link href="/admin/data-health/player-duplicates?mode=manual" className="button secondary">Manual merge</Link>
          </div>
        )}
      />

      {searchParams.merged === "1" ? <AdminAlert variant="success" size="md">Player merge completed.</AdminAlert> : null}
      {previewResult.error ? <AdminAlert variant="error" size="md">{previewResult.error}</AdminAlert> : null}
      {previewResult.preview ? <MergePreview preview={previewResult.preview} /> : null}
      {manualMode ? <ManualPlayerMergePicker players={mergeOptions} /> : null}
      {!manualMode && !hasPreview ? <PlayerDuplicateReviewClient pairs={pairs} /> : null}
    </>
  );
}
