import Link from "next/link";
import { UserRole } from "@prisma/client";
import { requireOrganizerUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { createOrganizerSubmission } from "./actions";

export const metadata = {
  title: "Organizer Submissions",
  description: "Submit game data for OnCourt admin review."
};

type PageProps = {
  searchParams?: {
    created?: string;
    error?: string;
  };
};

function formatDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "-";
}

function formatBytes(bytes: number | null) {
  if (bytes === null) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function CommonFields({ titlePlaceholder }: { titlePlaceholder: string }) {
  return (
    <div className="grid gap-3">
      <label className="grid gap-2 text-sm font-semibold text-surface-700">
        Submission title
        <input name="title" required maxLength={160} className="min-h-11 rounded-md border border-surface-200 px-3 py-2" placeholder={titlePlaceholder} />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-surface-700">
          League name
          <input name="leagueName" maxLength={160} className="min-h-11 rounded-md border border-surface-200 px-3 py-2" placeholder="Optional" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-surface-700">
          Game date
          <input name="gameDate" type="date" className="min-h-11 rounded-md border border-surface-200 px-3 py-2" />
        </label>
      </div>
    </div>
  );
}

export default async function OrganizerSubmissionsPage({ searchParams }: PageProps) {
  const user = await requireOrganizerUser();
  const isAdmin = user.role === UserRole.ADMIN;
  const submissions = await prisma.submission.findMany({
    where: isAdmin ? {} : { submittedByUserId: user.id },
    include: {
      submittedBy: {
        select: {
          name: true,
          username: true,
          role: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 100
  });

  return (
    <main className="min-h-screen bg-surface-50 pt-20">
      <div className="grid lg:grid-cols-[17rem_1fr]">
        <aside className="bg-navy-800 px-5 py-8 text-white lg:min-h-[calc(100vh-5rem)]">
          <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">Organizer Portal</p>
          <nav className="mt-8 grid gap-2 font-semibold">
            <Link href="/organizer" className="rounded-md px-3 py-2 hover:bg-white/10">Dashboard</Link>
            <Link href="/organizer/live-stats" className="rounded-md px-3 py-2 hover:bg-white/10">Live Stats Entry</Link>
            <Link href="/organizer/submissions" className="rounded-md bg-white/10 px-3 py-2 text-amber-300">Submissions</Link>
            {isAdmin ? <Link href="/admin" className="rounded-md px-3 py-2 hover:bg-white/10">Admin Home</Link> : null}
            <Link href="/portal/logout" className="rounded-md px-3 py-2 hover:bg-white/10">Sign out</Link>
          </nav>
        </aside>

        <section className="container-px grid gap-6 py-8">
          <div className="rounded-lg border border-surface-200 bg-white p-6 shadow-panel">
            <p className="label">Submission intake</p>
            <h1 className="mt-2 font-display text-stat-md text-navy-800">Send Game Stats for Review</h1>
            <p className="mt-2 max-w-3xl text-ink-600">
Submit stats by spreadsheet upload or manual entry. JSON import is admin-managed, and every submission is reviewed before it becomes official.
            </p>
          </div>

          {searchParams?.created ? <p className="rounded-md bg-green-50 p-4 font-semibold text-green-800">Submission created for admin review.</p> : null}
          {searchParams?.error ? <p className="rounded-md bg-red-50 p-4 font-semibold text-red-800">{decodeURIComponent(searchParams.error)}</p> : null}

          <section className="grid gap-4 xl:grid-cols-2">
            <article className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
              <h2 className="font-display text-2xl text-navy-800">Upload Excel, CSV, or Sheets</h2>
              <p className="mt-1 text-sm text-ink-600">Send a spreadsheet file for admin review. Admins will confirm the rows before anything becomes official.</p>
              <form action={createOrganizerSubmission} className="mt-5 grid gap-4" encType="multipart/form-data">
                <CommonFields titlePlaceholder="Example: UAAP S88 spreadsheet upload" />
                <label className="grid gap-2 text-sm font-semibold text-surface-700">
                  Upload spreadsheet
                  <input name="file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="rounded-md border border-surface-200 px-3 py-2" />
                </label>
                <button type="submit" className="button primary w-fit">Submit for Review</button>
              </form>
            </article>

            <article className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
              <h2 className="font-display text-2xl text-navy-800">Manual Input</h2>
              <p className="mt-1 text-sm text-ink-600">Enter game stats manually through the live stats tool, then submit the saved game data for admin review.</p>
              <div className="mt-5 grid gap-3 rounded-md bg-surface-100 p-4 text-sm text-ink-700">
                <p>Best for scorekeepers entering one game at a time.</p>
                <Link href="/organizer/live-stats" className="button secondary w-fit">Open Manual Entry</Link>
              </div>
              <div className="mt-4 rounded-md border border-dashed border-surface-300 p-4 text-sm text-ink-500">
                JSON submissions are handled by admins.
              </div>
            </article>
          </section>

          <section className="rounded-lg border border-surface-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl text-navy-800">{isAdmin ? "Recent Submissions" : "My Submissions"}</h2>
                <p className="mt-1 text-sm text-ink-500">Showing latest {submissions.length} submission{submissions.length === 1 ? "" : "s"}.</p>
              </div>
            </div>
            <div className="mt-5 overflow-x-auto rounded-md border border-surface-200">
              <table className="min-w-[64rem] w-full text-left text-sm">
                <thead className="bg-surface-100 font-mono text-mono-sm uppercase text-surface-600">
                  <tr>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">League</th>
                    <th className="px-4 py-3">Game Date</th>
                    <th className="px-4 py-3">File</th>
                    <th className="px-4 py-3">Submitted</th>
                    {isAdmin ? <th className="px-4 py-3">User</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((submission) => (
                    <tr key={submission.id} className="border-t border-surface-200">
                      <td className="px-4 py-3 font-semibold text-ink-900">{submission.title}</td>
                      <td className="px-4 py-3 font-mono text-mono-sm uppercase">{submission.status}</td>
                      <td className="px-4 py-3">{submission.leagueName ?? "-"}</td>
                      <td className="px-4 py-3">{formatDate(submission.gameDate)}</td>
                      <td className="px-4 py-3">{submission.originalFilename ?? "Pasted text"} ({formatBytes(submission.fileSizeBytes)})</td>
                      <td className="px-4 py-3">{submission.createdAt.toISOString().slice(0, 10)}</td>
                      {isAdmin ? <td className="px-4 py-3">{submission.submittedBy.name}</td> : null}
                    </tr>
                  ))}
                  {!submissions.length ? (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-ink-500">No submissions yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
