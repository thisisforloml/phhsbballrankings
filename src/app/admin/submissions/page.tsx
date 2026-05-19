import Link from "next/link";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { buildSubmissionReview } from "@/lib/submission-review";
import { createAdminJsonSubmission } from "./actions";

export const metadata = {
  title: "Submission Review - Admin Portal",
  description: "Review organizer-submitted game data intake records."
};

function formatDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "-";
}

function statusBadgeClass(status: string) {
  if (status === "PUBLISHED") return "bg-green-50 text-green-800";
  if (status === "IMPORTED") return "bg-navy-50 text-navy-800";
  if (status === "APPROVED") return "bg-green-50 text-green-800";
  if (status === "REJECTED") return "bg-red-50 text-red-800";
  if (status === "UNDER_REVIEW") return "bg-amber-50 text-amber-800";
  return "bg-surface-100 text-surface-700";
}

function nextAction(status: string, importReady: boolean) {
  if (status === "IMPORTED") return "View Published";
  if (status === "APPROVED" && importReady) return "Publish";
  if (status === "APPROVED") return "Fix Issues";
  if (status === "REJECTED") return "Fix Issues";
  return "Review";
}

type PageProps = {
  searchParams?: {
    jsonCreated?: string;
    jsonError?: string;
    status?: string;
    search?: string;
  };
};

export default async function AdminSubmissionsPage({ searchParams }: PageProps) {
  await requireAdminUser();

  const submissions = await prisma.submission.findMany({
    include: {
      submittedBy: {
        select: { id: true, name: true, username: true, email: true, role: true }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  const statusCounts = submissions.reduce<Record<string, number>>((counts, submission) => {
    counts[submission.status] = (counts[submission.status] ?? 0) + 1;
    return counts;
  }, {});
  const statuses = Object.keys(statusCounts).sort();
  const selectedStatus = searchParams?.status ?? "All";
  const search = searchParams?.search?.trim().toLowerCase() ?? "";
  const visibleSubmissions = submissions.filter((submission) => {
    if (selectedStatus !== "All" && submission.status !== selectedStatus) return false;
    if (!search) return true;
    return [submission.title, submission.leagueName, submission.submittedBy.name, submission.submittedBy.username, submission.submittedBy.email]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search);
  });

  return (
    <main className="min-h-screen bg-surface-50 pt-20">
      <div className="grid lg:grid-cols-[17rem_1fr]">
        <aside className="bg-navy-800 px-5 py-8 text-white lg:min-h-[calc(100vh-5rem)]">
          <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">Admin Portal</p>
          <nav className="mt-8 grid gap-2 font-semibold">
            <Link href="/admin" className="rounded-md px-3 py-2 hover:bg-white/10">Dashboard</Link>
            <Link href="/admin/submissions" className="rounded-md bg-white/10 px-3 py-2 text-amber-300">Submissions</Link>
            <Link href="/admin/players" className="rounded-md px-3 py-2 hover:bg-white/10">Players</Link>
            <Link href="/admin/teams" className="rounded-md px-3 py-2 hover:bg-white/10">Teams</Link>
            <Link href="/portal/logout" className="rounded-md px-3 py-2 hover:bg-white/10">Sign out</Link>
          </nav>
        </aside>

        <section className="container-px grid gap-6 py-8">
          <div className="rounded-lg border border-surface-200 bg-white p-6 shadow-panel">
            <p className="label">Submission queue</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-stat-md text-navy-800">Organizer Submissions</h1>
                <p className="mt-2 max-w-3xl text-ink-600">Review submitted game stats, resolve plain-language issues, and publish only when the submission is ready.</p>
              </div>
              <Link href="/admin" className="button secondary">Back to Admin</Link>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {Object.entries(statusCounts).map(([status, count]) => (
                <span key={status} className={`rounded-full px-4 py-2 font-mono text-mono-sm uppercase ${statusBadgeClass(status)}`}>{status}: {count}</span>
              ))}
              {!submissions.length ? <span className="rounded-full bg-surface-100 px-4 py-2 font-mono text-mono-sm uppercase text-surface-500">No submissions</span> : null}
            </div>
          </div>

          {searchParams?.jsonCreated ? <p className="rounded-md bg-green-50 p-4 font-semibold text-green-800">Valid JSON submission created for admin review.</p> : null}
          {searchParams?.jsonError ? <p className="rounded-md bg-red-50 p-4 font-semibold text-red-800">{decodeURIComponent(searchParams.jsonError)}</p> : null}

          <section className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
            <form className="grid gap-4 lg:grid-cols-[1fr_14rem_auto] lg:items-end">
              <label className="grid gap-2 font-mono text-mono-sm uppercase text-ink-500">
                Search
                <input name="search" defaultValue={searchParams?.search ?? ""} className="rounded-md border border-surface-300 bg-white px-3 py-3 text-ink-900" placeholder="Title, league, submitter" />
              </label>
              <label className="grid gap-2 font-mono text-mono-sm uppercase text-ink-500">
                Status
                <select name="status" defaultValue={selectedStatus} className="rounded-md border border-surface-300 bg-white px-3 py-3 text-ink-900">
                  <option>All</option>
                  {statuses.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
              <div className="flex gap-2">
                <button type="submit" className="button primary">Filter</button>
                <Link href="/admin/submissions" className="button secondary">Clear Filters</Link>
              </div>
            </form>
          </section>

          <details className="rounded-lg border border-surface-200 bg-white p-6 shadow-sm">
            <summary className="cursor-pointer font-display text-2xl text-navy-800">Admin JSON Intake</summary>
            <form action={createAdminJsonSubmission} className="mt-5 grid gap-4" encType="multipart/form-data">
              <p className="text-sm text-ink-600">Paste or upload validated JSON. Invalid JSON will not be saved. Organizers use spreadsheet upload or manual entry instead.</p>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-surface-700">Submission title<input name="title" required maxLength={160} className="min-h-11 rounded-md border border-surface-200 px-3 py-2" placeholder="Example: UAAP S88 16U Boys batch JSON" /></label>
                <label className="grid gap-2 text-sm font-semibold text-surface-700">League name<input name="leagueName" maxLength={160} className="min-h-11 rounded-md border border-surface-200 px-3 py-2" placeholder="Optional" /></label>
                <label className="grid gap-2 text-sm font-semibold text-surface-700">Game date<input name="gameDate" type="date" className="min-h-11 rounded-md border border-surface-200 px-3 py-2" /></label>
              </div>
              <label className="grid gap-2 text-sm font-semibold text-surface-700">Paste JSON<textarea name="rawText" rows={8} className="rounded-md border border-surface-200 px-3 py-2 font-mono text-sm" placeholder="Paste JSON here, or upload a JSON file below." /></label>
              <label className="grid gap-2 text-sm font-semibold text-surface-700">Upload JSON file<input name="file" type="file" accept=".json,application/json" className="rounded-md border border-surface-200 px-3 py-2" /></label>
              <button type="submit" className="button primary w-fit">Create JSON Submission</button>
            </form>
          </details>

          <section className="grid gap-4">
            {visibleSubmissions.map((submission) => {
              const review = buildSubmissionReview(submission);
              const action = nextAction(submission.status, review.importReady);
              return (
                <article key={submission.id} className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 font-mono text-[0.65rem] uppercase ${statusBadgeClass(submission.status)}`}>{submission.status}</span>
                        <span className={`rounded-full px-3 py-1 font-mono text-[0.65rem] uppercase ${review.importReady ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>{review.readinessLabel}</span>
                      </div>
                      <h2 className="mt-2 font-display text-3xl text-navy-800">{submission.title}</h2>
                      <p className="mt-2 text-sm text-ink-500">Submitted by {submission.submittedBy.name} ({submission.submittedBy.username})</p>
                    </div>
                    <Link href={`/admin/submissions/${submission.id}`} className={action === "Publish" ? "button primary" : "button secondary"}>{action}</Link>
                  </div>
                  <dl className="mt-5 grid gap-3 text-sm md:grid-cols-5">
                    <div><dt className="font-semibold text-surface-500">League</dt><dd>{review.summary.leagueName ?? submission.leagueName ?? "-"}</dd></div>
                    <div><dt className="font-semibold text-surface-500">Games</dt><dd>{review.summary.gameCount}</dd></div>
                    <div><dt className="font-semibold text-surface-500">Player rows</dt><dd>{review.summary.totalPlayerRows}</dd></div>
                    <div><dt className="font-semibold text-surface-500">Created</dt><dd>{formatDate(submission.createdAt)}</dd></div>
                    <div><dt className="font-semibold text-surface-500">Updated</dt><dd>{formatDate(submission.updatedAt)}</dd></div>
                  </dl>
                </article>
              );
            })}
            {!visibleSubmissions.length ? <p className="rounded-lg border border-surface-200 bg-white p-8 text-center text-ink-500 shadow-sm">No submissions match these filters.</p> : null}
          </section>
        </section>
      </div>
    </main>
  );
}