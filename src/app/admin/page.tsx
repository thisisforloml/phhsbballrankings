import Link from "next/link";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
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
  const [submissionCount, pendingSubmissions, programCount, playerCount, officialGames, snapshotCount, organizerCount, legacyTeamCount] = await Promise.all([
    prisma.submission.count(),
    prisma.submission.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED"] } } }),
    prisma.program.count({ where: { deletedAt: null } }),
    prisma.player.count({ where: { deletedAt: null } }),
    prisma.game.findMany({ where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } }, select: { homeTeamId: true, awayTeamId: true } }),
    prisma.rankingSnapshot.count(),
    prisma.user.count({ where: { role: "ORGANIZER" } }),
    prisma.team.count({ where: { deletedAt: null } })
  ]);

  const officialTeamRecordCount = new Set(officialGames.flatMap((game) => [game.homeTeamId, game.awayTeamId])).size;
  const officialGameCount = officialGames.length;

  const latestSubmission = await prisma.submission.findFirst({ orderBy: { updatedAt: "desc" }, select: { id: true, title: true, status: true, updatedAt: true } });

  const primaryCards = [
    {
      title: "Submissions",
      description: "Review incoming game stats, fix draft issues, and publish when ready.",
      href: "/admin/submissions",
      action: pendingSubmissions ? "Review submissions" : "Open submissions",
      status: pendingSubmissions ? `${pendingSubmissions} need attention` : `${submissionCount} total`
    },
    {
      title: "Programs",
      description: "Manage canonical schools, clubs, team programs, linked roster records, and player current program display.",
      href: "/admin/programs",
      action: "Manage programs",
      status: `${programCount} programs`
    },
    {
      title: "Players",
      description: "Search and edit player bio fields. Use Program detail pages for school/program organization and transfer workflow.",
      href: "/admin/players",
      action: "Search players",
      status: `${playerCount} player records`
    },
    {
      title: "Rankings / Data Health",
      description: "Check public rankings, official games, ranking snapshots, and data health indicators.",
      href: "/rankings",
      action: "View rankings",
      status: `${officialGameCount} official games, ${snapshotCount} snapshots`
    }
  ];

  const secondaryCards = [
    {
      title: "Teams (Legacy)",
      description: "Compatibility page for old internal Team records. Use Program Management for school, club, and team organization.",
      href: "/admin/teams",
      action: "Open legacy teams",
      status: `${legacyTeamCount} internal Team rows, ${officialTeamRecordCount} used in official games`
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
        <AdminSidebar active="dashboard" />

        <section className="container-px grid gap-6 py-8">
          <div className="rounded-lg border border-surface-200 bg-white p-6 shadow-panel">
            <p className="label">Operations hub</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-stat-md text-navy-800">Admin Dashboard</h1>
                <p className="mt-2 max-w-3xl text-ink-600">Signed in as {user.name}. Start with submissions and Program Management. Player Management is for player search and profile edits; legacy Team records are secondary.</p>
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

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {primaryCards.map((card) => (
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

          <section className="grid gap-4 md:grid-cols-2">
            {secondaryCards.map((card) => (
              <article key={card.title} className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
                <div className="flex min-h-full flex-col gap-4">
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h2 className="font-display text-2xl text-navy-800">{card.title}</h2>
                      <span className="rounded-full bg-amber-50 px-3 py-1 font-mono text-[0.65rem] uppercase text-amber-800">Secondary</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-ink-600">{card.description}</p>
                    <p className="mt-2 font-mono text-mono-sm uppercase text-ink-500">{card.status}</p>
                  </div>
                  <Link href={card.href} className="button secondary mt-auto w-fit">{card.action}</Link>
                </div>
              </article>
            ))}
          </section>
        </section>
      </div>
    </main>
  );
}
