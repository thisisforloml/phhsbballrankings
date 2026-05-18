import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { buildSubmissionReview } from "@/lib/submission-review";
import { submissionTypeLabel } from "@/lib/submission-utils";
import { updateSubmissionReviewStatus } from "../actions";

export const metadata = {
  title: "Submission Details - Admin Portal",
  description: "Review organizer submission validation and parsed JSON preview."
};

type PageProps = {
  params: {
    id: string;
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

export default async function AdminSubmissionDetailPage({ params }: PageProps) {
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
                <p className="mt-2 max-w-3xl text-ink-600">Review-only preview. This page does not import games, players, stats, ratings, or snapshots.</p>
              </div>
              <span className={`rounded-full px-4 py-2 font-mono text-mono-sm uppercase ${review.importReady ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>{review.readinessLabel}</span>
            </div>
          </div>

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
        </section>
      </div>
    </main>
  );
}