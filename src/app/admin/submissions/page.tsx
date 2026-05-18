import Link from "next/link";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { buildSubmissionReview } from "@/lib/submission-review";
import { submissionTypeLabel } from "@/lib/submission-utils";
import { createAdminJsonSubmission } from "./actions";

export const metadata = {
  title: "Submission Review - Admin Portal",
  description: "Review organizer-submitted game data intake records."
};

function formatDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "-";
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

type PageProps = {
  searchParams?: {
    jsonCreated?: string;
    jsonError?: string;
  };
};

export default async function AdminSubmissionsPage({ searchParams }: PageProps) {
  await requireAdminUser();

  const submissions = await prisma.submission.findMany({
    include: {
      submittedBy: {
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          role: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 100
  });

  const statusCounts = submissions.reduce<Record<string, number>>((counts, submission) => {
    counts[submission.status] = (counts[submission.status] ?? 0) + 1;
    return counts;
  }, {});

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
            <p className="label">Admin review</p>
            <h1 className="mt-2 font-display text-stat-md text-navy-800">Organizer Submissions</h1>
            <p className="mt-2 max-w-3xl text-ink-600">
              Intake records are separated from official games and stats. V1 is read-only review; approval/import actions come later.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {Object.entries(statusCounts).map(([status, count]) => (
                <span key={status} className="rounded-full bg-navy-50 px-4 py-2 font-mono text-mono-sm uppercase text-navy-800">{status}: {count}</span>
              ))}
              {!submissions.length ? <span className="rounded-full bg-surface-100 px-4 py-2 font-mono text-mono-sm uppercase text-surface-500">No submissions</span> : null}
            </div>
          </div>

          {searchParams?.jsonCreated ? <p className="rounded-md bg-green-50 p-4 font-semibold text-green-800">Valid JSON submission created for admin review.</p> : null}
          {searchParams?.jsonError ? <p className="rounded-md bg-red-50 p-4 font-semibold text-red-800">{decodeURIComponent(searchParams.jsonError)}</p> : null}

          <section className="rounded-lg border border-surface-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="label">Admin JSON Intake</p>
                <h2 className="mt-2 font-display text-3xl text-navy-800">Paste or upload validated JSON</h2>
                <p className="mt-2 max-w-3xl text-sm text-ink-600">Invalid JSON will not be saved. Organizer users do not have access to JSON submission.</p>
              </div>
              <span className="rounded-full bg-navy-50 px-4 py-2 font-mono text-mono-sm uppercase text-navy-800">Admin only</span>
            </div>
            <form action={createAdminJsonSubmission} className="mt-5 grid gap-4" encType="multipart/form-data">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-surface-700">
                  Submission title
                  <input name="title" required maxLength={160} className="min-h-11 rounded-md border border-surface-200 px-3 py-2" placeholder="Example: UAAP S88 16U Boys batch JSON" />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-surface-700">
                  League name
                  <input name="leagueName" maxLength={160} className="min-h-11 rounded-md border border-surface-200 px-3 py-2" placeholder="Optional" />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-surface-700">
                  Game date
                  <input name="gameDate" type="date" className="min-h-11 rounded-md border border-surface-200 px-3 py-2" />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-semibold text-surface-700">
                Paste JSON
                <textarea name="rawText" rows={8} className="rounded-md border border-surface-200 px-3 py-2 font-mono text-sm" placeholder="Paste JSON here, or upload a JSON file below." />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-surface-700">
                Upload JSON file
                <input name="file" type="file" accept=".json,application/json" className="rounded-md border border-surface-200 px-3 py-2" />
              </label>
              <button type="submit" className="button primary w-fit">Create JSON Submission</button>
            </form>
          </section>

          <section className="grid gap-4">
            {submissions.map((submission) => {
              const review = buildSubmissionReview(submission);
              return (
                <article key={submission.id} className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-mono-sm uppercase text-surface-500">{submissionTypeLabel(submission.type)}</p>
                        <span className={`rounded-full px-3 py-1 font-mono text-[0.65rem] uppercase ${statusBadgeClass(submission.status)}`}>{submission.status}</span>
                      </div>
                      <h2 className="mt-1 font-display text-3xl text-navy-800">{submission.title}</h2>
                      <p className="mt-2 text-sm text-ink-500">
                        Submitted by {submission.submittedBy.name} ({submission.submittedBy.username}) on {submission.createdAt.toISOString().slice(0, 10)}
                      </p>
                      {submission.adminNotes ? (
                        <p className="mt-3 max-w-3xl rounded-md bg-surface-100 px-3 py-2 text-sm text-ink-600">
                          <strong>Admin notes:</strong> {submission.adminNotes.length > 160 ? `${submission.adminNotes.slice(0, 160)}...` : submission.adminNotes}
                        </p>
                      ) : null}
                    </div>
                    <span className={`rounded-full px-4 py-2 font-mono text-mono-sm uppercase ${review.importReady ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>{review.readinessLabel}</span>
                  </div>
                  <dl className="mt-5 grid gap-3 text-sm md:grid-cols-4">
                    <div><dt className="font-semibold text-surface-500">League</dt><dd>{review.summary.leagueName ?? submission.leagueName ?? "-"}</dd></div>
                    <div><dt className="font-semibold text-surface-500">Age group</dt><dd>{review.summary.ageGroup ?? "-"}</dd></div>
                    <div><dt className="font-semibold text-surface-500">Games</dt><dd>{review.summary.gameCount}</dd></div>
                    <div><dt className="font-semibold text-surface-500">Player rows</dt><dd>{review.summary.totalPlayerRows}</dd></div>
                    <div><dt className="font-semibold text-surface-500">Game date</dt><dd>{formatDate(submission.gameDate)}</dd></div>
                    <div><dt className="font-semibold text-surface-500">File</dt><dd>{submission.originalFilename ?? "Pasted text"}</dd></div>
                    <div><dt className="font-semibold text-surface-500">Submitted by</dt><dd>{submission.submittedBy.email}</dd></div>
                    <div><dt className="font-semibold text-surface-500">ID</dt><dd>{submission.id.slice(0, 8)}</dd></div>
                  </dl>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link href={`/admin/submissions/${submission.id}`} className="button primary w-fit">Open Review Details</Link>
                    <span className="rounded-md bg-surface-100 px-4 py-2 text-sm font-semibold text-ink-600">Point checks: {review.validation.pointTotals.filter((check) => check.homePass && check.awayPass).length}/{review.validation.pointTotals.length}</span>
                  </div>
                </article>
              );
            })}
            {!submissions.length ? <p className="rounded-lg border border-surface-200 bg-white p-8 text-center text-ink-500 shadow-sm">No submissions yet.</p> : null}
          </section>
        </section>
      </div>
    </main>
  );
}
