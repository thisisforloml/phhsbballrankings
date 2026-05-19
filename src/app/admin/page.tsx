import Link from "next/link";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Admin Portal",
  description: "Internal OnCourt administration tools."
};

function statusBadgeClass(status: string) {
  if (status === "IMPORTED") return "bg-navy-50 text-navy-800";
  if (status === "APPROVED") return "bg-green-50 text-green-800";
  if (status === "UNDER_REVIEW") return "bg-amber-50 text-amber-800";
  if (status === "REJECTED") return "bg-red-50 text-red-800";
  return "bg-surface-100 text-surface-700";
}

export default async function AdminPage() {
  const user = await requireAdminUser();
  const [submissionCount, pendingSubmissions, playerCount, teamCount, activeGameCount, snapshotCount, organizerCount] = await Promise.all([
    prisma.submission.count(),
    prisma.submission.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED"] } } }),
    prisma.player.count({ where: { deletedAt: null } }),
    prisma.team.count({ where: { deletedAt: null } }),
    prisma.game.count({ where: { deletedAt: null } }),
    prisma.rankingSnapshot.count(),
    prisma.user.count({ where: { role: "ORGANIZER" } })
  ]);

  const latestSubmission = await prisma.submission.findFirst({ orderBy: { updatedAt: "desc" }, select: { id: true, title: true, status: true, updatedAt: true } });

  const cards = [
    {
      title: "Submissions",
      description: "Review incoming game stats, fix draft issues, and publish when ready.",
      href: "/admin/submissions",
      action: pendingSubmissions ? "Review submissions" : "Open submissions",
      status: pendingSubmissions ? `${pendingSubmissions} need attention` : `${submissionCount} total`
    },
    {
      title: "Player Management",
      description: "Edit player profile fields such as position, height, birth date, hometown, and region.",
      href: "/admin/players",
      action: "Manage players",
      status: `${playerCount} active players`
    },
    {
      title: "Team Management",
      description: "Review team names, public school display names, and duplicate/cross-context warnings.",
      href: "/admin/teams",
      action: "Manage teams",
      status: `${teamCount} active teams`
    },
    {
      title: "Rankings/Data Health",
      description: "Check public standings, official games, ranking snapshots, and data health indicators.",
      href: "/rankings",
      action: "View rankings",
      status: `${activeGameCount} active games, ${snapshotCount} snapshots`
    },
    {
      title: "Organizer Tools",
      description: "Open organizer submission and manual entry flows for support and troubleshooting.",
      href: "/organizer/submissions",
      action: "Open organizer tools",
      status: `${organizerCount} organizer accounts`
    }
  ];

  return (
    <main className="min-h-screen bg-surface-50 pt-20">
      <div className="grid lg:grid-cols-[17rem_1fr]">
        <aside className="bg-navy-800 px-5 py-8 text-white lg:min-h-[calc(100vh-5rem)]">
          <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">Admin Portal</p>
          <nav className="mt-8 grid gap-2 font-semibold">
            <Link href="/admin" className="rounded-md bg-white/10 px-3 py-2 text-amber-300">Dashboard</Link>
            <Link href="/admin/submissions" className="rounded-md px-3 py-2 hover:bg-white/10">Submissions</Link>
            <Link href="/admin/players" className="rounded-md px-3 py-2 hover:bg-white/10">Players</Link>
            <Link href="/admin/teams" className="rounded-md px-3 py-2 hover:bg-white/10">Teams</Link>
            <Link href="/organizer/submissions" className="rounded-md px-3 py-2 hover:bg-white/10">Organizer Tools</Link>
            <Link href="/portal/logout" className="rounded-md px-3 py-2 hover:bg-white/10">Sign out</Link>
          </nav>
        </aside>

        <section className="container-px grid gap-6 py-8">
          <div className="rounded-lg border border-surface-200 bg-white p-6 shadow-panel">
            <p className="label">Operations hub</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-stat-md text-navy-800">Admin Dashboard</h1>
                <p className="mt-2 max-w-3xl text-ink-600">Signed in as {user.name}. Start with submissions, then use player and team tools for profile and display cleanup.</p>
              </div>
              <span className="rounded-full bg-navy-50 px-4 py-2 font-mono text-mono-sm uppercase text-navy-800">{user.role}</span>
            </div>
          </div>

          {latestSubmission ? (
            <Link href={`/admin/submissions/${latestSubmission.id}`} className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm transition hover:border-navy-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="label">Latest updated submission</p>
                  <h2 className="mt-2 font-display text-2xl text-navy-800">{latestSubmission.title}</h2>
                  <p className="mt-1 text-sm text-ink-500">Updated {latestSubmission.updatedAt.toISOString().slice(0, 10)}</p>
                </div>
                <span className={`rounded-full px-4 py-2 font-mono text-mono-sm uppercase ${statusBadgeClass(latestSubmission.status)}`}>{latestSubmission.status}</span>
              </div>
            </Link>
          ) : null}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <article key={card.title} className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
                <div className="flex min-h-full flex-col gap-4">
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h2 className="font-display text-3xl text-navy-800">{card.title}</h2>
                      <span className="rounded-full bg-surface-100 px-3 py-1 font-mono text-[0.65rem] uppercase text-ink-600">{card.status}</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-ink-600">{card.description}</p>
                  </div>
                  <Link href={card.href} className="button primary mt-auto w-fit">{card.action}</Link>
                </div>
              </article>
            ))}
          </section>
        </section>
      </div>
    </main>
  );
}