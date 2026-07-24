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

export const metadata = {
  title: "Player Duplicate Review - Admin Portal",
  description: "Review and safely merge duplicate Player records.",
};

type SearchParams = {
  canonical?: string;
  duplicate?: string;
  merged?: string;
};

async function loadPreview(searchParams: SearchParams) {
  if (!searchParams.canonical || !searchParams.duplicate) return { preview: null, error: null };
  try {
    return {
      preview: await buildPlayerMergePreview(searchParams.canonical, searchParams.duplicate),
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
    ["GameStats", preview.impact.gameStats],
    ["Performance scores", preview.impact.performanceScores],
    ["Roster rows", preview.impact.rosterAssignments],
    ["Ratings", preview.impact.ratings],
    ["Snapshot rows", preview.impact.snapshotRows],
    ["Aliases", preview.impact.aliases + preview.impact.externalAliases],
  ] as const;

  return (
    <section id="merge-preview" className="overflow-hidden border-2 border-orange-300 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-orange-200 bg-orange-50 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-orange-700">Merge preview</p>
          <h2 className="mt-1 text-xl font-bold text-navy-900">
            Keep {preview.canonical.displayName}; archive {preview.duplicate.displayName}
          </h2>
          <p className="mt-1 text-sm text-ink-600">No changes occur until the confirmation form is submitted.</p>
        </div>
        <Link href="/admin/data-health/player-duplicates" className="text-sm font-semibold text-navy-700 hover:underline">
          Cancel preview
        </Link>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[1fr_18rem]">
        <div className="grid gap-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {impactRows.map(([label, value]) => (
              <div key={label} className="border border-surface-200 bg-surface-50 px-3 py-2">
                <p className="text-xs text-ink-500">{label}</p>
                <p className="mt-0.5 font-mono text-lg font-bold text-navy-900">{value}</p>
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
              Collision checks passed. The action will revalidate this exact scope before writing.
            </AdminAlert>
          )}
        </div>

        <dl className="grid content-start gap-2 border border-surface-200 p-3 text-sm">
          <div><dt className="text-xs text-ink-500">Retained Program</dt><dd className="font-semibold">{preview.canonical.currentProgramName ?? "Unassigned"}</dd></div>
          <div><dt className="text-xs text-ink-500">Retained birth date</dt><dd className="font-semibold">{preview.canonical.birthDate ?? "Not listed"}</dd></div>
          <div><dt className="text-xs text-ink-500">Redundant roster rows</dt><dd className="font-semibold">{preview.impact.redundantRosterAssignments}</dd></div>
          <div><dt className="text-xs text-ink-500">Overlapping snapshot rows</dt><dd className="font-semibold">{preview.impact.collidingSnapshotRows}</dd></div>
        </dl>
      </div>

      {preview.canMerge ? (
        <PlayerMergeExecuteForm
          canonicalPlayerId={preview.canonical.id}
          duplicatePlayerId={preview.duplicate.id}
          expectedFingerprint={preview.fingerprint}
        />
      ) : null}
    </section>
  );
}

export default async function PlayerDuplicateReviewPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdminUser();
  const [pairs, mergeOptions, previewResult] = await Promise.all([
    loadAllPlayerDuplicateCandidates(),
    loadPlayerMergeOptions(),
    loadPreview(searchParams),
  ]);

  return (
    <>
      <AdminPageHeader
        eyebrow="Data Health"
        title="Player Duplicate Review"
        description="Compare possible matches, choose the Player record to keep, and preview every affected reference before merging."
        actions={<span className="font-mono text-xs font-bold text-ink-600">{pairs.length} live candidate pairs</span>}
      >
        <p className="text-xs text-ink-500">Source: live active Player records and official Team/game evidence. This queue is not a generated report.</p>
      </AdminPageHeader>

      <ManualPlayerMergePicker players={mergeOptions} />

      {searchParams.merged === "1" ? (
        <AdminAlert variant="success" size="md">Player merge completed and the duplicate queue was refreshed.</AdminAlert>
      ) : null}
      {previewResult.error ? <AdminAlert variant="error" size="md">{previewResult.error}</AdminAlert> : null}
      {previewResult.preview ? <MergePreview preview={previewResult.preview} /> : null}

      <PlayerDuplicateReviewClient pairs={pairs} />
    </>
  );
}
