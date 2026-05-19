import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { buildSubmissionReview } from "@/lib/submission-review";
import { buildSubmissionImportPreflight } from "@/lib/submission-import-preflight";
import { getSubmissionImportPublishAudit, getSubmissionPipelineStatus } from "@/lib/submission-audit";
import { getImportedSubmissionProcessingStatus } from "@/lib/submission-post-import-processing";
import { submissionTypeLabel } from "@/lib/submission-utils";
import { SimplifiedSubmissionReview } from "./SimplifiedSubmissionReview";
import {
  computeSubmissionFormulaScores,
  computeSubmissionPlayerRatings,
  generateSubmissionMonthlyRankings,
  importSubmissionOfficialData,
  processAndPublishSubmissionRankings,
  updateSubmissionReviewStatus,
  validateSubmissionRankings
} from "../actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Submission Details - Admin Portal",
  description: "Review organizer submission validation and parsed JSON preview."
};

type PageProps = {
  params: {
    id: string;
  };
  searchParams?: {
    reviewSuccess?: string;
    reviewError?: string;
    editStats?: string;
  };
};

function formatDateTime(date: Date | null) {
  return date ? date.toISOString().replace("T", " ").slice(0, 19) : "-";
}

function formatJson(value: unknown) {
  if (value === null || value === undefined) return "-";
  return JSON.stringify(value, null, 2);
}

function passFail(pass: boolean) {
  return <span className={`rounded-full px-2 py-1 font-mono text-[0.65rem] uppercase ${pass ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{pass ? "Pass" : "Fail"}</span>;
}

function healthBadge(pass: boolean) {
  return <span className={`rounded-full px-3 py-1 font-mono text-[0.65rem] uppercase ${pass ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{pass ? "Pass" : "Fail"}</span>;
}

function yesNoBadge(value: boolean) {
  return <span className={`rounded-full px-3 py-1 font-mono text-[0.65rem] uppercase ${value ? "bg-green-50 text-green-800" : "bg-surface-100 text-surface-700"}`}>{value ? "Yes" : "No"}</span>;
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "APPROVED":
      return "bg-green-50 text-green-800";
    case "REJECTED":
      return "bg-red-50 text-red-800";
    case "UNDER_REVIEW":
      return "bg-amber-50 text-amber-800";
    case "IMPORTED":
      return "bg-navy-50 text-navy-800";
    default:
      return "bg-surface-100 text-surface-700";
  }
}

type PipelineStepState = "complete" | "current" | "pending" | "blocked";

type PipelineStep = {
  label: string;
  description: string;
  state: PipelineStepState;
};

type DerivedPipelineStatus = {
  submitted: boolean;
  underReview: boolean;
  approved: boolean;
  imported: boolean;
  processed: boolean;
  published: boolean;
  issues: string[];
};

function pipelineStepClass(state: PipelineStepState) {
  switch (state) {
    case "complete": return "border-green-200 bg-green-50 text-green-900";
    case "current": return "border-amber-200 bg-amber-50 text-amber-900";
    case "blocked": return "border-red-200 bg-red-50 text-red-900";
    default: return "border-surface-200 bg-surface-50 text-ink-600";
  }
}

function pipelineDotClass(state: PipelineStepState) {
  switch (state) {
    case "complete": return "bg-green-600 text-white";
    case "current": return "bg-amber-500 text-white";
    case "blocked": return "bg-red-600 text-white";
    default: return "bg-surface-200 text-surface-600";
  }
}

function pipelineStateLabel(state: PipelineStepState) {
  switch (state) {
    case "complete": return "Complete";
    case "current": return "Current";
    case "blocked": return "Blocked";
    default: return "Pending";
  }
}


export default async function AdminSubmissionDetailPage({ params, searchParams }: PageProps) {
  await requireAdminUser();

  const submission = await prisma.submission.findUnique({
    where: { id: params.id },
    include: {
      submittedBy: {
        select: { id: true, name: true, username: true, email: true, role: true }
      }
    }
  });

  if (!submission) notFound();

  const review = buildSubmissionReview(submission);
  const preflight = await buildSubmissionImportPreflight(submission);
  let processingStatus: Awaited<ReturnType<typeof getImportedSubmissionProcessingStatus>> | null = null;
  let processingStatusError: string | null = null;

  if (submission.status === "IMPORTED") {
    try {
      processingStatus = await getImportedSubmissionProcessingStatus(submission.id);
    } catch (error) {
      processingStatusError = error instanceof Error ? error.message : "Unable to read post-import processing status.";
    }
  }

  const importAudit = await getSubmissionImportPublishAudit(submission.id);
  const pipelineStatus = await getSubmissionPipelineStatus(submission.id);
  const pipelineStepInputs = [
    { key: "submitted", label: "Submitted", description: "Organizer submission received.", complete: pipelineStatus.submitted, blocked: false },
    { key: "underReview", label: submission.status === "REJECTED" ? "Review Rejected" : "Under Review", description: submission.status === "REJECTED" ? "Admin review ended with rejection." : "Admin review started.", complete: pipelineStatus.underReview, blocked: submission.status === "REJECTED" },
    { key: "approved", label: "Approved", description: "Submission approved for import.", complete: pipelineStatus.approved, blocked: false },
    { key: "imported", label: "Imported", description: "Official league/game/stat records created.", complete: pipelineStatus.imported, blocked: false },
    { key: "processed", label: "Processed", description: "Formula v1 scores and player ratings computed.", complete: pipelineStatus.processed, blocked: false },
    { key: "published", label: "Published", description: "Monthly rankings generated and validated.", complete: pipelineStatus.published, blocked: false }
  ] as const;
  const firstIncompleteStepIndex = pipelineStepInputs.findIndex((step) => !step.complete && !step.blocked);
  const pipelineSteps = pipelineStepInputs.map((step, index) => ({
    ...step,
    state: step.complete ? "complete" as const : step.blocked ? "blocked" as const : index === firstIncompleteStepIndex && pipelineStatus.issues.length === 0 ? "current" as const : "pending" as const,
    renderedLabel: step.complete ? "OK Complete" : step.blocked ? "Blocked" : index === firstIncompleteStepIndex && pipelineStatus.issues.length === 0 ? "Current" : "Pending"
  }));
  const reviewSuccess = searchParams?.reviewSuccess;
  const reviewError = searchParams?.reviewError;
  const editStats = searchParams?.editStats === "1";

  return (
    <main className="min-h-screen bg-surface-50 pt-20">
      <div className="grid lg:grid-cols-[17rem_1fr]">
        <aside className="bg-navy-800 px-5 py-8 text-white lg:min-h-[calc(100vh-5rem)]">
          <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">Admin Portal</p>
          <nav className="mt-8 grid gap-2 font-semibold">
            <Link href="/admin" className="rounded-md px-3 py-2 hover:bg-white/10">Dashboard</Link>
            <Link href="/admin/players" className="rounded-md px-3 py-2 hover:bg-white/10">Players</Link>
            <Link href="/admin/submissions" className="rounded-md bg-white/10 px-3 py-2 text-amber-300">Submissions</Link>
            <Link href="/portal/logout" className="rounded-md px-3 py-2 hover:bg-white/10">Sign out</Link>
          </nav>
        </aside>

        <section className="container-px grid gap-6 py-8">
          <div className="rounded-lg border border-surface-200 bg-white p-6 shadow-panel">
            <Link href="/admin/submissions" className="font-mono text-mono-sm uppercase text-amber-700 hover:text-amber-800">Back to submissions</Link>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="label">Submission detail</p>
                <h1 className="mt-2 font-display text-stat-md text-navy-800">{submission.title}</h1>
                <p className="mt-2 max-w-3xl text-ink-600">Use the guided review first. Imported submissions are locked as official data.</p>
              </div>
              <span className={`rounded-full px-4 py-2 font-mono text-mono-sm uppercase ${review.importReady ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>{review.readinessLabel}</span>
            </div>
          </div>

          <SimplifiedSubmissionReview
            submission={submission}
            review={review}
            preflight={preflight}
            pipelineStatus={pipelineStatus}
            reviewSuccess={reviewSuccess}
            reviewError={reviewError}
          />

          <details className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
            <summary className="cursor-pointer font-display text-2xl text-navy-800">Advanced details</summary>
            <div className="mt-4 grid gap-6">
          <section className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl text-navy-800">Pipeline Status</h2>
                <p className="mt-1 text-sm text-ink-600">Workflow progress from organizer submission through published rankings.</p>
              </div>
              <span className={`rounded-full px-3 py-1 font-mono text-[0.65rem] uppercase ${pipelineStatus.issues.length ? "bg-amber-50 text-amber-800" : "bg-green-50 text-green-800"}`}>{pipelineStatus.issues.length ? "Info" : "OK"}</span>
            </div>
            {pipelineStatus.issues.length ? (
              <div className="mt-4 grid gap-2">
                {pipelineStatus.issues.map((issue) => (
                  <p key={issue} className="rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-900">{issue}</p>
                ))}
              </div>
            ) : null}
            <ol className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              {pipelineSteps.map((step, index) => (
                <li key={step.key} className={`rounded-lg border p-4 ${pipelineStepClass(step.state)}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs font-bold ${pipelineDotClass(step.state)}`}>{step.complete ? "OK" : index + 1}</span>
                    <span className="font-mono text-[0.65rem] uppercase tracking-[0.08em]">{step.renderedLabel.replace("OK ", "")}</span>
                  </div>
                  <h3 className="mt-3 font-semibold">{step.label}</h3>
                  <p className="mt-1 text-sm leading-5 opacity-80">{step.description}</p>
                </li>
              ))}
            </ol>
          </section>
          {importAudit.available ? (
            <section className="grid gap-4 rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-3xl text-navy-800">Import & Publish Audit</h2>
                  <p className="mt-1 text-sm text-ink-600">Read-only checks for official import, Formula v1 processing, published rankings, and global safety counts.</p>
                </div>
                <span className={`rounded-full px-4 py-2 font-mono text-mono-sm uppercase ${importAudit.overallStatus === "Healthy" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{importAudit.overallStatus}</span>
              </div>

              <div className="grid gap-3 text-sm md:grid-cols-4">
                <div className="rounded-md bg-surface-100 p-3"><dt className="font-semibold text-surface-500">Status</dt><dd>{importAudit.submission.status}</dd></div>
                <div className="rounded-md bg-surface-100 p-3"><dt className="font-semibold text-surface-500">Imported</dt><dd>{yesNoBadge(importAudit.submission.imported)}</dd></div>
                <div className="rounded-md bg-surface-100 p-3"><dt className="font-semibold text-surface-500">Processed</dt><dd>{yesNoBadge(importAudit.submission.processed)}</dd></div>
                <div className="rounded-md bg-surface-100 p-3"><dt className="font-semibold text-surface-500">Published</dt><dd>{yesNoBadge(importAudit.submission.published)}</dd></div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-md border border-surface-200 p-4">
                  <h3 className="font-semibold text-navy-800">Imported official data</h3>
                  <dl className="mt-3 grid gap-2 text-sm">
                    <div><dt className="font-semibold text-surface-500">League</dt><dd>{importAudit.officialData.league ? `${importAudit.officialData.league.name} (${importAudit.officialData.league.id})` : "Not available"}</dd></div>
                    <div><dt className="font-semibold text-surface-500">Season</dt><dd>{importAudit.officialData.season ? `${importAudit.officialData.season.name} (${importAudit.officialData.season.id})` : "Not available"}</dd></div>
                    <div><dt className="font-semibold text-surface-500">Active games</dt><dd>{importAudit.officialData.activeGames}</dd></div>
                    <div><dt className="font-semibold text-surface-500">Active GameStats</dt><dd>{importAudit.officialData.activeGameStats}</dd></div>
                    <div><dt className="font-semibold text-surface-500">Detected teams</dt><dd>{importAudit.officialData.detectedTeams.join(", ") || "Not available"}</dd></div>
                  </dl>
                </div>
                <div className="rounded-md border border-surface-200 p-4">
                  <h3 className="font-semibold text-navy-800">Ratings and publishing</h3>
                  <dl className="mt-3 grid gap-2 text-sm">
                    <div><dt className="font-semibold text-surface-500">GamePerformanceScores</dt><dd>{importAudit.ratingsPublishing.gamePerformanceScores ?? "Not available"}</dd></div>
                    <div><dt className="font-semibold text-surface-500">PlayerRatings</dt><dd>{importAudit.ratingsPublishing.playerRatings}</dd></div>
                    <div><dt className="font-semibold text-surface-500">Latest monthly snapshot</dt><dd>{importAudit.ratingsPublishing.latestMonthlyRankingSnapshotId ?? "Not available"}</dd></div>
                    <div><dt className="font-semibold text-surface-500">Snapshot rows</dt><dd>{importAudit.ratingsPublishing.latestMonthlyRankingSnapshotRows ?? "Not available"}</dd></div>
                    <div><dt className="font-semibold text-surface-500">Validation</dt><dd>{importAudit.ratingsPublishing.validationStatus}</dd></div>
                  </dl>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {Object.entries(importAudit.expectedChecks).map(([key, item]) => (
                  <div key={key} className="rounded-md border border-surface-200 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="font-semibold text-surface-500">{key}</dt>
                      {healthBadge(item.pass)}
                    </div>
                    <dd className="mt-2 text-ink-700">{item.actual} / {item.expected}</dd>
                  </div>
                ))}
              </div>

              <details className="rounded-md bg-surface-100 p-4">
                <summary className="cursor-pointer font-semibold text-navy-800">Point total checks</summary>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-[52rem] w-full text-left text-sm">
                    <thead className="font-mono text-mono-sm uppercase text-surface-600"><tr><th className="py-2 pr-4">Game</th><th className="py-2 pr-4">Teams</th><th className="py-2 pr-4">Score</th><th className="py-2 pr-4">Summed PTS</th><th className="py-2 pr-4">Status</th></tr></thead>
                    <tbody>{importAudit.officialData.pointTotals.map((check) => <tr key={check.gameId} className="border-t border-surface-200"><td className="py-2 pr-4">{check.gameNumber}</td><td className="py-2 pr-4">{check.homeTeam} vs {check.awayTeam}</td><td className="py-2 pr-4">{check.homeScore}-{check.awayScore}</td><td className="py-2 pr-4">{check.summedHomePlayerPoints}-{check.summedAwayPlayerPoints}</td><td className="py-2 pr-4">{healthBadge(check.pass)}</td></tr>)}</tbody>
                  </table>
                </div>
              </details>

              <details className="rounded-md bg-surface-100 p-4">
                <summary className="cursor-pointer font-semibold text-navy-800">Global safety counts</summary>
                <dl className="mt-3 grid gap-3 text-sm md:grid-cols-3 lg:grid-cols-6">
                  <div><dt className="font-semibold text-surface-500">ActiveGame</dt><dd>{importAudit.globalSafetyCounts.activeGame}</dd></div>
                  <div><dt className="font-semibold text-surface-500">ActiveGameStat</dt><dd>{importAudit.globalSafetyCounts.activeGameStat}</dd></div>
                  <div><dt className="font-semibold text-surface-500">GamePerformanceScore</dt><dd>{importAudit.globalSafetyCounts.gamePerformanceScore}</dd></div>
                  <div><dt className="font-semibold text-surface-500">PlayerRating</dt><dd>{importAudit.globalSafetyCounts.playerRating}</dd></div>
                  <div><dt className="font-semibold text-surface-500">RankingSnapshot</dt><dd>{importAudit.globalSafetyCounts.rankingSnapshot}</dd></div>
                  <div><dt className="font-semibold text-surface-500">RankingSnapshotRow</dt><dd>{importAudit.globalSafetyCounts.rankingSnapshotRow}</dd></div>
                </dl>
              </details>
            </section>
          ) : (
            <section className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
              <h2 className="font-display text-3xl text-navy-800">Import & Publish Audit</h2>
              <p className="mt-2 rounded-md bg-surface-100 p-3 text-sm font-semibold text-ink-600">{importAudit.reason}</p>
            </section>
          )}
          {reviewSuccess ? (
            <p className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">{reviewSuccess}</p>
          ) : null}
          {reviewError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{reviewError}</p>
          ) : null}

          <section className="grid gap-4 rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-3xl text-navy-800">Metadata</h2>
            <dl className="grid gap-3 text-sm md:grid-cols-3">
              <div><dt className="font-semibold text-surface-500">Title</dt><dd>{submission.title}</dd></div>
              <div><dt className="font-semibold text-surface-500">Submitted by</dt><dd>{submission.submittedBy.name} ({submission.submittedBy.username})</dd></div>
              <div><dt className="font-semibold text-surface-500">Email</dt><dd>{submission.submittedBy.email}</dd></div>
              <div><dt className="font-semibold text-surface-500">Type</dt><dd>{submissionTypeLabel(submission.type)}</dd></div>
              <div><dt className="font-semibold text-surface-500">Status</dt><dd><span className={`rounded-full px-3 py-1 font-mono text-[0.65rem] uppercase ${statusBadgeClass(submission.status)}`}>{submission.status}</span></dd></div>
              <div><dt className="font-semibold text-surface-500">Created</dt><dd>{formatDateTime(submission.createdAt)}</dd></div>
              <div><dt className="font-semibold text-surface-500">Original filename</dt><dd>{submission.originalFilename ?? "Pasted text"}</dd></div>
              <div><dt className="font-semibold text-surface-500">MIME type</dt><dd>{submission.mimeType ?? "-"}</dd></div>
              <div><dt className="font-semibold text-surface-500">Stored path</dt><dd>{submission.storedFilePath ?? "-"}</dd></div>
              <div className="md:col-span-3"><dt className="font-semibold text-surface-500">Admin notes</dt><dd>{submission.adminNotes ?? "No admin notes yet."}</dd></div>
            </dl>
          </section>

          <section className="grid gap-4 rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl text-navy-800">Review Status</h2>
                <p className="mt-1 text-sm text-ink-600">Status updates are review-only. Approving a submission does not import official games, players, stats, ratings, or snapshots.</p>
              </div>
              <span className={`rounded-full px-4 py-2 font-mono text-mono-sm uppercase ${statusBadgeClass(submission.status)}`}>{submission.status}</span>
            </div>
            {submission.status === "IMPORTED" ? (
              <p className="rounded-md bg-surface-100 p-4 text-sm font-semibold text-ink-600">Imported submissions are locked in this v1 review UI.</p>
            ) : (
              <form action={updateSubmissionReviewStatus} className="grid gap-4">
                {submission.status === "SUBMITTED" ? (
                  <p className="rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-900">Approve and Reject become available after the submission is marked Under Review.</p>
                ) : null}
                <input type="hidden" name="submissionId" value={submission.id} />
                <label className="grid gap-2 text-sm font-semibold text-navy-800">
                  Admin notes
                  <textarea
                    name="adminNotes"
                    defaultValue={submission.adminNotes ?? ""}
                    rows={4}
                    className="rounded-md border border-surface-300 px-3 py-2 text-sm font-normal text-ink-700 outline-none focus:border-amber-500"
                    placeholder="Add review notes, cleanup instructions, or rejection reason."
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  {submission.status === "SUBMITTED" ? (
                    <button type="submit" name="targetStatus" value="UNDER_REVIEW" className="button primary">Mark Under Review</button>
                  ) : null}
                  {submission.status === "UNDER_REVIEW" ? (
                    <>
                      <button type="submit" name="targetStatus" value="APPROVED" className="button primary">Approve</button>
                      <button type="submit" name="targetStatus" value="REJECTED" className="rounded-md border border-red-200 bg-red-50 px-4 py-2 font-semibold text-red-800 hover:bg-red-100">Reject</button>
                    </>
                  ) : null}
                  {submission.status === "APPROVED" || submission.status === "REJECTED" ? (
                    <button type="submit" name="targetStatus" value="UNDER_REVIEW" className="button secondary">Reopen Review</button>
                  ) : null}
                  <span className="self-center text-sm text-ink-500">IMPORTED is intentionally unavailable until official import tooling exists.</span>
                </div>
              </form>
            )}
          </section>

          <section className="grid gap-4 rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl text-navy-800">Import Preflight</h2>
                <p className="mt-1 text-sm text-ink-600">Read-only preview of what an official import would do. No records are created or updated here.</p>
              </div>
              <span className={`rounded-full px-4 py-2 font-mono text-mono-sm uppercase ${preflight.submissionReadiness.alreadyImported ? "bg-navy-50 text-navy-800" : preflight.overallSummary.importBlocked ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>{preflight.submissionReadiness.alreadyImported ? "Historical" : preflight.overallSummary.importBlocked ? "Blocked" : "Ready"}</span>
            </div>
            {preflight.submissionReadiness.alreadyImported ? (
              <p className="rounded-md bg-navy-50 p-4 text-sm font-semibold text-navy-800">Already imported. Preflight is historical/read-only.</p>
            ) : null}
            <div className="grid gap-3 md:grid-cols-4">
              <span className={`rounded-md p-3 text-sm font-semibold ${preflight.submissionReadiness.statusApproved ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>Approved or imported: {preflight.submissionReadiness.statusApproved ? "yes" : "no"}</span>
              <span className={`rounded-md p-3 text-sm font-semibold ${preflight.submissionReadiness.validParsedJson ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>Valid JSON: {preflight.submissionReadiness.validParsedJson ? "yes" : "no"}</span>
              <span className={`rounded-md p-3 text-sm font-semibold ${preflight.submissionReadiness.importReadyFromReview ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>Review parser ready: {preflight.submissionReadiness.importReadyFromReview ? "yes" : "no"}</span>
              <span className="rounded-md bg-surface-100 p-3 text-sm font-semibold">Manual review items: {preflight.overallSummary.manualReviewCount}</span>
            </div>
            {preflight.overallSummary.blockers.length ? (
              <div className="rounded-md bg-red-50 p-4 text-sm text-red-900">
                <strong className="block">Blockers</strong>
                <ul className="mt-2 list-disc pl-5">
                  {preflight.overallSummary.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                </ul>
              </div>
            ) : null}
            <dl className="grid gap-3 text-sm md:grid-cols-3 lg:grid-cols-6">
              <div><dt className="font-semibold text-surface-500">Leagues</dt><dd>Create {preflight.overallSummary.wouldCreate.leagues} / reuse {preflight.overallSummary.wouldReuse.leagues}</dd></div>
              <div><dt className="font-semibold text-surface-500">Seasons</dt><dd>Create {preflight.overallSummary.wouldCreate.seasons} / reuse {preflight.overallSummary.wouldReuse.seasons}</dd></div>
              <div><dt className="font-semibold text-surface-500">Teams</dt><dd>Create {preflight.overallSummary.wouldCreate.teams} / reuse {preflight.overallSummary.wouldReuse.teams}</dd></div>
              <div><dt className="font-semibold text-surface-500">Players</dt><dd>Create {preflight.overallSummary.wouldCreate.players} / reuse {preflight.overallSummary.wouldReuse.players}</dd></div>
              <div><dt className="font-semibold text-surface-500">Games</dt><dd>Create {preflight.overallSummary.wouldCreate.games} / update {preflight.overallSummary.wouldReuse.games}</dd></div>
              <div><dt className="font-semibold text-surface-500">GameStats</dt><dd>Create {preflight.overallSummary.wouldCreate.gameStats} / update {preflight.overallSummary.wouldReuse.gameStats}</dd></div>
            </dl>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-md border border-surface-200 p-4">
                <h3 className="font-semibold text-navy-800">League</h3>
                <dl className="mt-3 grid gap-2 text-sm">
                  <div><dt className="font-semibold text-surface-500">Recommended name</dt><dd>{preflight.league.recommendedName}</dd></div>
                  <div><dt className="font-semibold text-surface-500">Age group</dt><dd>{preflight.league.ageGroup ?? "-"}</dd></div>
                  <div><dt className="font-semibold text-surface-500">Inferred gender</dt><dd>{preflight.league.inferredGender}</dd></div>
                  <div><dt className="font-semibold text-surface-500">Action</dt><dd>{preflight.league.action}{preflight.league.existingLeague ? ` (${preflight.league.existingLeague.id})` : ""}</dd></div>
                </dl>
              </div>
              <div className="rounded-md border border-surface-200 p-4">
                <h3 className="font-semibold text-navy-800">Season</h3>
                <dl className="mt-3 grid gap-2 text-sm">
                  <div><dt className="font-semibold text-surface-500">Name</dt><dd>{preflight.season.name ?? "-"}</dd></div>
                  <div><dt className="font-semibold text-surface-500">Season year</dt><dd>{preflight.season.seasonYear ?? "-"}</dd></div>
                  <div><dt className="font-semibold text-surface-500">Action</dt><dd>{preflight.season.action}{preflight.season.existingSeason ? ` (${preflight.season.existingSeason.id})` : ""}</dd></div>
                </dl>
              </div>
            </div>
            <details className="rounded-md bg-surface-100 p-4" open>
              <summary className="cursor-pointer font-semibold text-navy-800">Team preflight</summary>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-[48rem] w-full text-left text-sm">
                  <thead className="font-mono text-mono-sm uppercase text-surface-600"><tr><th className="py-2 pr-4">Submitted</th><th className="py-2 pr-4">Public name</th><th className="py-2 pr-4">Action</th><th className="py-2 pr-4">Match</th></tr></thead>
                  <tbody>{preflight.teams.map((team) => <tr key={team.submittedTeamName} className="border-t border-surface-200"><td className="py-2 pr-4">{team.submittedTeamName}</td><td className="py-2 pr-4">{team.normalizedPublicName}</td><td className="py-2 pr-4">{team.action}</td><td className="py-2 pr-4">{team.matches.map((match) => match.name).join(", ") || "-"}</td></tr>)}</tbody>
                </table>
              </div>
            </details>
            <details className="rounded-md bg-surface-100 p-4">
              <summary className="cursor-pointer font-semibold text-navy-800">Player preflight ({preflight.players.length})</summary>
              <div className="mt-3 max-h-[28rem] overflow-auto rounded-md border border-surface-200 bg-white">
                <table className="min-w-[54rem] w-full text-left text-sm">
                  <thead className="sticky top-0 bg-white font-mono text-mono-sm uppercase text-surface-600"><tr><th className="px-3 py-2">Player</th><th className="px-3 py-2">Gender</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Exact matches</th><th className="px-3 py-2">Possible matches</th></tr></thead>
                  <tbody>{preflight.players.map((player) => <tr key={player.cleanedName} className="border-t border-surface-200"><td className="px-3 py-2">{player.cleanedName}</td><td className="px-3 py-2">{player.gender}</td><td className="px-3 py-2">{player.action}</td><td className="px-3 py-2">{player.exactMatches.map((match) => match.displayName).join(", ") || "-"}</td><td className="px-3 py-2">{player.possibleCaseMatches.map((match) => match.displayName).join(", ") || "-"}</td></tr>)}</tbody>
                </table>
              </div>
            </details>
            <details className="rounded-md bg-surface-100 p-4" open>
              <summary className="cursor-pointer font-semibold text-navy-800">Game preflight</summary>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-[58rem] w-full text-left text-sm">
                  <thead className="font-mono text-mono-sm uppercase text-surface-600"><tr><th className="py-2 pr-4">Game</th><th className="py-2 pr-4">Teams</th><th className="py-2 pr-4">Score</th><th className="py-2 pr-4">Action</th><th className="py-2 pr-4">Point check</th></tr></thead>
                  <tbody>{preflight.games.map((game) => <tr key={game.gameNumber} className="border-t border-surface-200"><td className="py-2 pr-4">{game.gameNumber}</td><td className="py-2 pr-4">{game.homeTeamName} vs {game.awayTeamName}</td><td className="py-2 pr-4">{game.homeScore}-{game.awayScore}</td><td className="py-2 pr-4">{game.action}</td><td className="py-2 pr-4">{game.pointCheck?.homePass && game.pointCheck?.awayPass ? "pass" : "fail"}</td></tr>)}</tbody>
                </table>
              </div>
            </details>
            <details className="rounded-md bg-surface-100 p-4">
              <summary className="cursor-pointer font-semibold text-navy-800">GameStat preflight</summary>
              <dl className="mt-3 grid gap-3 text-sm md:grid-cols-4">
                <div><dt className="font-semibold text-surface-500">Submitted rows</dt><dd>{preflight.gameStats.totalSubmittedRows}</dd></div>
                <div><dt className="font-semibold text-surface-500">Would create</dt><dd>{preflight.gameStats.wouldCreate}</dd></div>
                <div><dt className="font-semibold text-surface-500">Would update</dt><dd>{preflight.gameStats.wouldUpdate}</dd></div>
                <div><dt className="font-semibold text-surface-500">Manual review</dt><dd>{preflight.gameStats.manualReview}</dd></div>
              </dl>
            </details>
            {submission.status === "APPROVED" && !preflight.overallSummary.importBlocked ? (
              <form action={importSubmissionOfficialData} className="rounded-md border border-green-200 bg-green-50 p-4">
                <input type="hidden" name="submissionId" value={submission.id} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <strong className="block text-green-900">Import Official Data</strong>
                    <p className="mt-1 text-sm text-green-800">Creates or reuses League, Season, Teams, Players, Games, and GameStats only. It will not compute ratings or rankings.</p>
                  </div>
                  <button type="submit" className="rounded-md bg-green-700 px-4 py-2 font-semibold text-white hover:bg-green-800">Import Official Data</button>
                </div>
              </form>
            ) : submission.status === "IMPORTED" ? (
              <p className="rounded-md bg-navy-50 p-4 text-sm font-semibold text-navy-800">This submission has already been imported. Re-running import is disabled from the UI.</p>
            ) : submission.status === "APPROVED" && preflight.overallSummary.importBlocked ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <strong className="block">Import Official Data is blocked by preflight review.</strong>
                <ul className="mt-2 grid gap-1">
                  {preflight.overallSummary.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                </ul>
              </div>
            ) : (
              <p className="rounded-md bg-surface-100 p-4 text-sm font-semibold text-ink-600">Official import becomes available only when the submission is APPROVED and preflight is not blocked.</p>
            )}
          </section>


          {processingStatus ? (
            <section className="grid gap-4 rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-3xl text-navy-800">Post-Import Processing</h2>
                  <p className="mt-1 text-sm text-ink-600">Run or rerun Formula v1 processing for this imported submission. These actions update scores, ratings, and the monthly U16 Boys snapshot only.</p>
                </div>
                <span className="rounded-full bg-navy-50 px-4 py-2 font-mono text-mono-sm uppercase text-navy-800">Imported</span>
              </div>
              <dl className="grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md bg-surface-100 p-3"><dt className="font-semibold text-surface-500">GameStats</dt><dd>{processingStatus.gameStatsCount} / {processingStatus.expectedGameStats}</dd></div>
                <div className="rounded-md bg-surface-100 p-3"><dt className="font-semibold text-surface-500">Formula scores</dt><dd>{processingStatus.gamePerformanceScoresCount} {processingStatus.complete.formulaScores ? "(Already computed)" : "(Needs run)"}</dd></div>
                <div className="rounded-md bg-surface-100 p-3"><dt className="font-semibold text-surface-500">Player ratings</dt><dd>{processingStatus.playerRatingsCount} {processingStatus.complete.playerRatings ? "(Already computed)" : "(Needs run)"}</dd></div>
                <div className="rounded-md bg-surface-100 p-3"><dt className="font-semibold text-surface-500">Monthly snapshot rows</dt><dd>{processingStatus.monthlyRankingSnapshotRows} {processingStatus.complete.monthlySnapshot ? "(Already generated)" : "(Needs run)"}</dd></div>
                <div className="rounded-md bg-surface-100 p-3"><dt className="font-semibold text-surface-500">Age group</dt><dd>{processingStatus.ageGroup}</dd></div>
                <div className="rounded-md bg-surface-100 p-3"><dt className="font-semibold text-surface-500">Gender</dt><dd>{processingStatus.gender}</dd></div>
                <div className="rounded-md bg-surface-100 p-3"><dt className="font-semibold text-surface-500">Snapshot date</dt><dd>{processingStatus.snapshotDate.slice(0, 10)}</dd></div>
                <div className="rounded-md bg-surface-100 p-3"><dt className="font-semibold text-surface-500">Missing birthDate</dt><dd>{processingStatus.missingBirthDateCount}</dd></div>
              </dl>
              <form action={processAndPublishSubmissionRankings} className="rounded-md border border-green-200 bg-green-50 p-4">
                <input type="hidden" name="submissionId" value={submission.id} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <strong className="block text-green-950">Process & Publish Rankings</strong>
                    <p className="mt-1 text-sm text-green-800">Runs scores, ratings, monthly rankings, and validation in sequence.</p>
                  </div>
                  <button type="submit" className="rounded-md bg-green-700 px-4 py-2 font-semibold text-white hover:bg-green-800">Process & Publish Rankings</button>
                </div>
              </form>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <form action={computeSubmissionFormulaScores} className="rounded-md border border-surface-200 p-4">
                  <input type="hidden" name="submissionId" value={submission.id} />
                  <strong className="block text-navy-800">Formula v1 Scores</strong>
                  <p className="mt-1 text-sm text-ink-600">{processingStatus.complete.formulaScores ? "Already computed; rerun updates existing rows." : "Compute GamePerformanceScore rows."}</p>
                  <button type="submit" className="button primary mt-3">Compute Formula v1 Scores</button>
                </form>
                <form action={computeSubmissionPlayerRatings} className="rounded-md border border-surface-200 p-4">
                  <input type="hidden" name="submissionId" value={submission.id} />
                  <strong className="block text-navy-800">Player Ratings</strong>
                  <p className="mt-1 text-sm text-ink-600">{processingStatus.complete.playerRatings ? "Already computed; rerun updates current ratings." : "Compute current U16 PlayerRating rows."}</p>
                  <button type="submit" className="button primary mt-3">Compute Player Ratings</button>
                </form>
                <form action={generateSubmissionMonthlyRankings} className="rounded-md border border-surface-200 p-4">
                  <input type="hidden" name="submissionId" value={submission.id} />
                  <strong className="block text-navy-800">Monthly Rankings</strong>
                  <p className="mt-1 text-sm text-ink-600">{processingStatus.complete.monthlySnapshot ? "Already generated; rerun refreshes rows." : "Generate the monthly U16 Boys snapshot."}</p>
                  <button type="submit" className="button primary mt-3">Generate Monthly Rankings</button>
                </form>
                <form action={validateSubmissionRankings} className="rounded-md border border-surface-200 p-4">
                  <input type="hidden" name="submissionId" value={submission.id} />
                  <strong className="block text-navy-800">Validation</strong>
                  <p className="mt-1 text-sm text-ink-600">Checks U16 processing and U19 regression counts.</p>
                  <button type="submit" className="button secondary mt-3">Validate Rankings</button>
                </form>
              </div>
            </section>
          ) : null}
          <section className="grid gap-4 rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-3xl text-navy-800">Parsed JSON Summary</h2>
            <dl className="grid gap-3 text-sm md:grid-cols-4">
              <div><dt className="font-semibold text-surface-500">League name</dt><dd>{review.summary.leagueName ?? "-"}</dd></div>
              <div><dt className="font-semibold text-surface-500">Age group</dt><dd>{review.summary.ageGroup ?? "-"}</dd></div>
              <div><dt className="font-semibold text-surface-500">Season</dt><dd>{review.summary.seasonName ?? "-"}</dd></div>
              <div><dt className="font-semibold text-surface-500">Season year</dt><dd>{review.summary.seasonYear ?? "-"}</dd></div>
              <div><dt className="font-semibold text-surface-500">Games</dt><dd>{review.summary.gameCount}</dd></div>
              <div><dt className="font-semibold text-surface-500">Player rows</dt><dd>{review.summary.totalPlayerRows}</dd></div>
              <div><dt className="font-semibold text-surface-500">Unique players</dt><dd>{review.summary.uniquePlayerNamesCount}</dd></div>
              <div><dt className="font-semibold text-surface-500">Detected teams</dt><dd>{review.summary.detectedTeams.length}</dd></div>
            </dl>
            <details className="rounded-md bg-surface-100 p-4">
              <summary className="cursor-pointer font-semibold text-navy-800">Unique player names</summary>
              <div className="mt-3 flex flex-wrap gap-2">
                {review.summary.uniquePlayerNames.map((name) => <span key={name} className="rounded-full bg-white px-3 py-1 text-sm text-ink-700">{name}</span>)}
              </div>
            </details>
          </section>

          <section className="grid gap-4 rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-3xl text-navy-800">Validation Summary</h2>
            <div className="grid gap-3 md:grid-cols-4">
              <span className={`rounded-md p-3 text-sm font-semibold ${review.validJson ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>Valid JSON: {review.validJson ? "true" : "false"}</span>
              <span className="rounded-md bg-surface-100 p-3 text-sm font-semibold">Missing fields: {review.validation.missingRequiredFields.length}</span>
              <span className="rounded-md bg-surface-100 p-3 text-sm font-semibold">Duplicate rows: {review.validation.duplicatePlayerNamesWithinGames.length}</span>
              <span className="rounded-md bg-surface-100 p-3 text-sm font-semibold">Team mismatches: {review.validation.teamNamesNotMatchingGameTeams.length}</span>
            </div>
            <div className="overflow-x-auto rounded-md border border-surface-200">
              <table className="min-w-[58rem] w-full text-left text-sm">
                <thead className="bg-surface-100 font-mono text-mono-sm uppercase text-surface-600">
                  <tr><th className="px-4 py-3">Game</th><th className="px-4 py-3">Home</th><th className="px-4 py-3">Away</th><th className="px-4 py-3">Home PTS</th><th className="px-4 py-3">Away PTS</th><th className="px-4 py-3">Result</th></tr>
                </thead>
                <tbody>
                  {review.validation.pointTotals.map((check) => (
                    <tr key={check.gameNumber} className="border-t border-surface-200">
                      <td className="px-4 py-3"><strong>{check.gameNumber}</strong><span className="block text-ink-500">{check.game}</span></td>
                      <td className="px-4 py-3">{check.homeTeamName} {check.homeScore}</td>
                      <td className="px-4 py-3">{check.awayTeamName} {check.awayScore}</td>
                      <td className="px-4 py-3">{check.summedHomePlayerPoints}</td>
                      <td className="px-4 py-3">{check.summedAwayPlayerPoints}</td>
                      <td className="px-4 py-3"><span className="flex gap-2">{passFail(check.homePass)} {passFail(check.awayPass)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details className="rounded-md bg-surface-100 p-4">
              <summary className="cursor-pointer font-semibold text-navy-800">Issues</summary>
              <pre className="mt-3 max-h-96 overflow-auto text-xs text-ink-700">{formatJson({ missingRequiredFields: review.validation.missingRequiredFields, duplicatePlayerNamesWithinGames: review.validation.duplicatePlayerNamesWithinGames, teamNamesNotMatchingGameTeams: review.validation.teamNamesNotMatchingGameTeams, parseError: review.parseError })}</pre>
            </details>
          </section>

          <section className="grid gap-4 rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-3xl text-navy-800">Normalization Recommendations</h2>
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <div className="rounded-md bg-amber-50 p-4 text-amber-900"><strong className="block">Recommended league name</strong>{review.recommendations.recommendedLeagueName ?? "No recommendation"}</div>
              <div className="rounded-md bg-amber-50 p-4 text-amber-900"><strong className="block">Gender</strong>{review.recommendations.missingGenderField ? `Missing explicit gender. Recommended: ${review.recommendations.inferredGender ?? "Confirm manually"}` : `Detected: ${review.recommendations.inferredGender}`}</div>
            </div>
            <ul className="grid gap-2 text-sm text-ink-700">
              {review.recommendations.leagueNameIssues.map((issue) => <li key={issue} className="rounded-md bg-surface-100 p-3">{issue}</li>)}
              {!review.recommendations.leagueNameIssues.length ? <li className="rounded-md bg-surface-100 p-3">No league naming issues detected.</li> : null}
            </ul>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {review.recommendations.teamDisplayMapping.map((team) => <span key={team.sourceName} className="rounded-md border border-surface-200 p-3 text-sm"><strong className="block text-navy-800">{team.sourceName}</strong>{team.displayName}</span>)}
            </div>
          </section>

          <details className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
            <summary className="cursor-pointer font-display text-2xl text-navy-800">Stored Preview / Validation JSON</summary>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div><h3 className="font-semibold text-navy-800">Validation Summary</h3><pre className="mt-2 max-h-96 overflow-auto rounded-md bg-surface-100 p-3 text-xs text-ink-700">{formatJson(submission.validationSummary)}</pre></div>
              <div><h3 className="font-semibold text-navy-800">Parsed Preview</h3><pre className="mt-2 max-h-96 overflow-auto rounded-md bg-surface-100 p-3 text-xs text-ink-700">{formatJson(submission.parsedPreview)}</pre></div>
            </div>
          </details>
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}

