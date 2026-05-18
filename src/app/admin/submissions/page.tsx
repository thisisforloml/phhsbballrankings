import Link from "next/link";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { submissionTypeLabel } from "@/lib/submission-utils";

export const metadata = {
  title: "Submission Review - Admin Portal",
  description: "Review organizer-submitted game data intake records."
};

function formatDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "-";
}

function formatJson(value: unknown) {
  if (value === null || value === undefined) return "-";
  return JSON.stringify(value, null, 2);
}

export default async function AdminSubmissionsPage() {
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

          <section className="grid gap-4">
            {submissions.map((submission) => (
              <article key={submission.id} className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-mono-sm uppercase text-surface-500">{submissionTypeLabel(submission.type)} - {submission.status}</p>
                    <h2 className="mt-1 font-display text-3xl text-navy-800">{submission.title}</h2>
                    <p className="mt-2 text-sm text-ink-500">
                      Submitted by {submission.submittedBy.name} ({submission.submittedBy.username}) on {submission.createdAt.toISOString().slice(0, 10)}
                    </p>
                  </div>
                  <span className="rounded-full bg-surface-100 px-4 py-2 font-mono text-mono-sm uppercase text-surface-600">{submission.id.slice(0, 8)}</span>
                </div>
                <dl className="mt-5 grid gap-3 text-sm md:grid-cols-3">
                  <div><dt className="font-semibold text-surface-500">League</dt><dd>{submission.leagueName ?? "-"}</dd></div>
                  <div><dt className="font-semibold text-surface-500">Game date</dt><dd>{formatDate(submission.gameDate)}</dd></div>
                  <div><dt className="font-semibold text-surface-500">File</dt><dd>{submission.originalFilename ?? "Pasted text"}</dd></div>
                  <div><dt className="font-semibold text-surface-500">MIME type</dt><dd>{submission.mimeType ?? "-"}</dd></div>
                  <div><dt className="font-semibold text-surface-500">Stored path</dt><dd>{submission.storedFilePath ?? "-"}</dd></div>
                  <div><dt className="font-semibold text-surface-500">Admin notes</dt><dd>{submission.adminNotes ?? "-"}</dd></div>
                </dl>
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div>
                    <h3 className="font-semibold text-navy-800">Validation Summary</h3>
                    <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-surface-100 p-3 text-xs text-ink-700">{formatJson(submission.validationSummary)}</pre>
                  </div>
                  <div>
                    <h3 className="font-semibold text-navy-800">Parsed Preview</h3>
                    <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-surface-100 p-3 text-xs text-ink-700">{formatJson(submission.parsedPreview)}</pre>
                  </div>
                </div>
              </article>
            ))}
            {!submissions.length ? <p className="rounded-lg border border-surface-200 bg-white p-8 text-center text-ink-500 shadow-sm">No submissions yet.</p> : null}
          </section>
        </section>
      </div>
    </main>
  );
}