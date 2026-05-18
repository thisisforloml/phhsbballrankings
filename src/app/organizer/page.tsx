import Link from "next/link";
import { UserRole } from "@prisma/client";
import { requireOrganizerUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Organizer Portal",
  description: "Organizer workflow for submitting official game stats."
};

const workflowCards = [
  {
    title: "Submissions",
    description: "Submit JSON, CSV, or XLSX game data for admin review. Submissions do not change official stats until imported by an admin.",
    href: "/organizer/submissions",
    action: "Open Submissions"
  },
  {
    title: "Live Stats Entry",
    description: "Use the live stat entry workspace for game-day stat capture and review workflows.",
    href: "/organizer/live-stats",
    action: "Open Live Stats"
  }
];

export default async function OrganizerPage() {
  const user = await requireOrganizerUser();
  const isAdmin = user.role === UserRole.ADMIN;
  const [mySubmissionCount, recentSubmissions, statusCounts] = await Promise.all([
    prisma.submission.count({ where: { submittedByUserId: user.id } }),
    prisma.submission.findMany({
      where: { submittedByUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, status: true, type: true, createdAt: true }
    }),
    prisma.submission.groupBy({
      by: ["status"],
      where: { submittedByUserId: user.id },
      _count: { _all: true }
    })
  ]);

  return (
    <main className="min-h-screen bg-surface-50 pt-20">
      <div className="grid lg:grid-cols-[17rem_1fr]">
        <aside className="bg-navy-800 px-5 py-8 text-white lg:min-h-[calc(100vh-5rem)]">
          <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">Organizer Portal</p>
          <nav className="mt-8 grid gap-2 font-semibold">
            <Link href="/organizer" className="rounded-md bg-white/10 px-3 py-2 text-amber-300">Dashboard</Link>
            <Link href="/organizer/submissions" className="rounded-md px-3 py-2 hover:bg-white/10">Submissions</Link>
            <Link href="/organizer/live-stats" className="rounded-md px-3 py-2 hover:bg-white/10">Live Stats Entry</Link>
            {isAdmin ? <Link href="/admin" className="rounded-md px-3 py-2 hover:bg-white/10">Admin Home</Link> : null}
            <Link href="/portal/logout" className="rounded-md px-3 py-2 hover:bg-white/10">Sign out</Link>
          </nav>
        </aside>

        <section className="container-px grid gap-6 py-8">
          <div className="rounded-lg border border-surface-200 bg-white p-6 shadow-panel">
            <p className="label">External data submission</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-stat-md text-navy-800">Organizer Portal</h1>
                <p className="mt-2 max-w-3xl text-ink-600">
                  Submit game data, enter live stats, and track review status. Player bio editing, team management, ratings, and rankings are admin-only.
                </p>
              </div>
              <span className="rounded-full bg-navy-50 px-4 py-2 font-mono text-mono-sm uppercase text-navy-800">{user.role}</span>
            </div>
          </div>

          <section className="grid gap-4 md:grid-cols-3">
            <Metric label="My submissions" value={mySubmissionCount} />
            <Metric label="Under review" value={statusCounts.find((row) => row.status === "UNDER_REVIEW")?._count._all ?? 0} />
            <Metric label="Imported" value={statusCounts.find((row) => row.status === "IMPORTED")?._count._all ?? 0} />
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            {workflowCards.map((card) => (
              <article key={card.title} className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
                <h2 className="font-display text-3xl text-navy-800">{card.title}</h2>
                <p className="mt-3 text-sm leading-6 text-ink-600">{card.description}</p>
                <Link href={card.href} className="button primary mt-5 w-fit">{card.action}</Link>
              </article>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <article className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
              <h2 className="font-display text-3xl text-navy-800">Submitted Games / Status</h2>
              <div className="mt-4 grid gap-3">
                {recentSubmissions.map((submission) => (
                  <div key={submission.id} className="grid gap-1 rounded-md border border-surface-200 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    <span><strong className="block text-ink-900">{submission.title}</strong><small className="font-mono text-mono-sm uppercase text-ink-500">{submission.createdAt.toISOString().slice(0, 10)}</small></span>
                    <span className="rounded-full bg-surface-100 px-3 py-1 font-mono text-mono-sm uppercase text-ink-600">{submission.status}</span>
                  </div>
                ))}
                {!recentSubmissions.length ? <p className="rounded-md bg-surface-100 p-4 text-ink-500">No submissions yet.</p> : null}
              </div>
            </article>

            <article className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
              <h2 className="font-display text-3xl text-navy-800">Help</h2>
              <ul className="mt-4 grid gap-3 text-sm leading-6 text-ink-600">
                <li>Submit only games you are authorized to submit.</li>
                <li>Use JSON, CSV, or XLSX uploads for structured box scores.</li>
                <li>Submissions stay separate from official rankings until admin review.</li>
                <li>Contact OnCourt admin if a team, player, or league is missing.</li>
              </ul>
            </article>
          </section>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
      <strong className="block font-display text-stat-sm text-navy-800">{value}</strong>
      <small className="font-mono text-mono-sm uppercase text-surface-500">{label}</small>
    </span>
  );
}
