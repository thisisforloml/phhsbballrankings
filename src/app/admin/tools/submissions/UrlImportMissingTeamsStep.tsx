"use client";

import { useMemo, useState, useTransition } from "react";
import { AdminAlert } from "@/components/admin/AdminAlert";
import {
  createMissingOrganizationsFromImportAction,
  previewMissingOrganizationsFromImportAction
} from "@/app/admin/tools/submissions/url-import-actions";
import type { OrganizationCreationPreview, OrganizationCreationResult, UrlImportCreationPlan } from "@/lib/stats-import/types";
import { creationPlanToExportJson, creationPlanToMarkdown } from "@/lib/url-import-creation-plan";

function formatAgeGroupDisplay(ageGroup: string) {
  const match = ageGroup.match(/^U(\d+)$/i);
  return match ? `${match[1]}U` : ageGroup;
}

function formatGenderDisplay(gender: "BOYS" | "GIRLS") {
  return gender === "GIRLS" ? "Girls" : "Boys";
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function UrlImportMissingTeamsStep(props: {
  plan: UrlImportCreationPlan;
  city: string;
  region: string;
  onOrganizationsCreated: (result: OrganizationCreationResult) => void | Promise<void>;
}) {
  const [dryRun, setDryRun] = useState<OrganizationCreationPreview | null>(null);
  const [confirmationPhrase, setConfirmationPhrase] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPreviewing, startPreview] = useTransition();
  const [isCreating, startCreate] = useTransition();

  const markdownPreview = useMemo(() => creationPlanToMarkdown(props.plan), [props.plan]);
  const canCreate = Boolean(dryRun?.summary.programsToCreate || dryRun?.summary.teamsToCreate);

  function onDownloadJson() {
    const payload = creationPlanToExportJson(props.plan);
    downloadTextFile(
      `url-import-creation-plan-${props.plan.generatedAt.slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      "application/json"
    );
  }

  function onDownloadMarkdown() {
    downloadTextFile(
      `url-import-creation-plan-${props.plan.generatedAt.slice(0, 10)}.md`,
      markdownPreview,
      "text/markdown"
    );
  }

  function onPreviewCreation() {
    setError(null);
    setSuccessMessage(null);
    startPreview(async () => {
      try {
        const preview = await previewMissingOrganizationsFromImportAction(props.plan);
        setDryRun(preview);
        setConfirmationPhrase("");
      } catch (previewError) {
        setDryRun(null);
        setError(previewError instanceof Error ? previewError.message : "Creation preview failed.");
      }
    });
  }

  function onOpenConfirmDialog() {
    if (!dryRun || !canCreate) return;
    setConfirmationPhrase("");
    setShowConfirmDialog(true);
  }

  function onCreateOrganizations() {
    if (!dryRun || !canCreate) return;
    setError(null);
    startCreate(async () => {
      try {
        const result = await createMissingOrganizationsFromImportAction({
          plan: props.plan,
          city: props.city,
          region: props.region,
          confirmationPhrase
        });
        setShowConfirmDialog(false);
        setSuccessMessage(
          `Created ${result.programsCreated} program${result.programsCreated === 1 ? "" : "s"} and ${result.teamsCreated} team${result.teamsCreated === 1 ? "" : "s"}. Saved ${result.aliasesSaved} team alias${result.aliasesSaved === 1 ? "" : "es"}.`
        );
        await props.onOrganizationsCreated(result);
        const refreshedPreview = await previewMissingOrganizationsFromImportAction(props.plan);
        setDryRun(refreshedPreview);
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : "Organization creation failed.");
      }
    });
  }

  return (
    <div className="grid gap-4">
      <AdminAlert variant="info" size="sm" className="rounded-md">
        <p className="font-semibold">Missing organizations workspace</p>
        <p className="mt-1 text-sm">
          Review inferred names, preview what will be created, then create programs and teams in Peach Basket before continuing to player matching.
        </p>
        <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-ink-500">Programs to create</dt>
            <dd className="font-medium text-ink-900">{props.plan.summary.programCount}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Teams to create</dt>
            <dd className="font-medium text-ink-900">{props.plan.summary.teamCount}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Games affected</dt>
            <dd className="font-medium text-ink-900">{props.plan.summary.gamesAffected}</dd>
          </div>
        </dl>
      </AdminAlert>

      {error ? (
        <AdminAlert variant="error" size="sm" className="rounded-md">
          {error}
        </AdminAlert>
      ) : null}

      {successMessage ? (
        <AdminAlert variant="success" size="sm" className="rounded-md">
          {successMessage}
        </AdminAlert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPreviewCreation}
          disabled={isPreviewing || !props.plan.summary.teamCount}
          className="button secondary min-h-9 px-3 py-1.5 text-sm disabled:opacity-60"
        >
          {isPreviewing ? "Previewing…" : "Preview organization creation"}
        </button>
        <button
          type="button"
          onClick={onOpenConfirmDialog}
          disabled={!canCreate || isCreating}
          className="button primary min-h-9 px-3 py-1.5 text-sm disabled:opacity-60"
        >
          Create organizations
        </button>
        <button type="button" onClick={onDownloadJson} className="button secondary min-h-9 px-3 py-1.5 text-sm">
          Download creation plan (JSON)
        </button>
        <button type="button" onClick={onDownloadMarkdown} className="button secondary min-h-9 px-3 py-1.5 text-sm">
          Download creation plan (Markdown)
        </button>
      </div>

      {dryRun ? (
        <AdminAlert variant="readOnly" size="sm" className="rounded-md">
          <p className="font-semibold normal-case">Creation dry-run</p>
          <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-500">Programs to create</dt>
              <dd className="font-medium text-ink-900">{dryRun.summary.programsToCreate}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Teams to create</dt>
              <dd className="font-medium text-ink-900">{dryRun.summary.teamsToCreate}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Existing programs skipped</dt>
              <dd className="font-medium text-ink-900">{dryRun.summary.programsSkipped}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Existing teams skipped</dt>
              <dd className="font-medium text-ink-900">{dryRun.summary.teamsSkipped}</dd>
            </div>
          </dl>

          {dryRun.programsToCreate.length ? (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">Programs to create</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-ink-800">
                {dryRun.programsToCreate.map((program) => (
                  <li key={program.programKey}>
                    {program.suggestedProgramName} · {program.suggestedProgramType} · {program.teamCount} team
                    {program.teamCount === 1 ? "" : "s"}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {dryRun.teamsToCreate.length ? (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">Teams to create</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-ink-800">
                {dryRun.teamsToCreate.map((team) => (
                  <li key={team.teamKey}>
                    {team.resolvedTeamName} · {team.suggestedProgramName} · {formatAgeGroupDisplay(team.suggestedAgeGroup)}{" "}
                    {formatGenderDisplay(team.suggestedGender)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {(dryRun.programsSkipped.length || dryRun.teamsSkipped.length) ? (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">Existing records skipped</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-ink-700">
                {dryRun.programsSkipped.map((item) => (
                  <li key={`program-${item.existingId}`}>
                    Program {item.name} — {item.reason}
                  </li>
                ))}
                {dryRun.teamsSkipped.map((item) => (
                  <li key={`team-${item.existingId}`}>
                    Team {item.name}
                    {item.programName ? ` (${item.programName})` : ""} — {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {canCreate ? (
            <p className="mt-3 text-sm text-ink-700">
              Confirmation required: <span className="font-mono font-semibold">{dryRun.confirmationPhrase}</span>
            </p>
          ) : (
            <p className="mt-3 text-sm text-ink-600">All organizations already exist — no creation needed.</p>
          )}
        </AdminAlert>
      ) : null}

      <div className="grid gap-4">
        {props.plan.programs.map((program) => (
          <section key={program.programKey} className="rounded-md border border-surface-200 bg-white">
            <header className="border-b border-surface-200 bg-surface-50 px-4 py-3">
              <h3 className="font-display text-lg text-navy-800">{program.suggestedProgramName}</h3>
              <p className="mt-0.5 text-xs text-ink-500">
                {program.suggestedProgramType} · {program.teams.length} team{program.teams.length === 1 ? "" : "s"}
              </p>
            </header>
            <ul className="divide-y divide-surface-200">
              {program.teams.map((team) => (
                <li key={team.teamKey} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center">
                  <div>
                    <p className="font-medium text-ink-900">{team.suggestedTeamName}</p>
                    {team.sourceMappings.some((mapping) => mapping.scheduleLabel && mapping.scheduleLabel !== mapping.externalLabel) ? (
                      <p className="mt-1 text-xs text-ink-500">
                        External: {team.sourceMappings.map((mapping) => mapping.externalLabel).join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-sm text-ink-700">
                    {formatAgeGroupDisplay(team.suggestedAgeGroup)} · {formatGenderDisplay(team.suggestedGender)}
                  </p>
                  <p className="text-sm font-mono text-ink-600 sm:text-right">
                    {team.gameCount} game{team.gameCount === 1 ? "" : "s"}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {showConfirmDialog && dryRun ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg border border-surface-200 bg-white p-4 shadow-lg">
            <h3 className="font-display text-xl text-navy-800">Confirm organization creation</h3>
            <p className="mt-2 text-sm text-ink-700">
              This will create programs and teams in Peach Basket and save team aliases for future imports.
            </p>
            <p className="mt-3 text-sm text-ink-900">
              Type <span className="font-mono font-semibold">{dryRun.confirmationPhrase}</span> to confirm.
            </p>
            <input
              value={confirmationPhrase}
              onChange={(event) => setConfirmationPhrase(event.target.value)}
              className="mt-3 min-h-10 w-full rounded-md border border-surface-200 px-3 py-2 text-sm text-ink-900"
              placeholder={dryRun.confirmationPhrase}
              autoFocus
            />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmDialog(false)}
                className="button secondary min-h-9 px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onCreateOrganizations}
                disabled={isCreating || confirmationPhrase.trim() !== dryRun.confirmationPhrase}
                className="button primary min-h-9 px-3 py-1.5 text-sm disabled:opacity-60"
              >
                {isCreating ? "Creating…" : dryRun.confirmationPhrase}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
