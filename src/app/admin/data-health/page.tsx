import Link from "next/link";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { AdminPageTemplate } from "@/components/admin/AdminPageTemplate";

export const metadata = {
  title: "Data Health | Admin",
  description: "Remediation queues and data quality signals."
};

export default async function AdminDataHealthPage() {
  await requireAdminUser();

  const [missingBirthDate, missingPhoto, missingPosition, duplicateCandidates, programsNeedingReview, blockedRosterNote] = await Promise.all([
    prisma.player.count({ where: { deletedAt: null, birthDate: null } }),
    prisma.player.count({ where: { deletedAt: null, photoUrl: null } }),
    prisma.player.count({ where: { deletedAt: null, position: null } }),
    prisma.player.count({
      where: {
        deletedAt: null,
        OR: [
          { firstName: { contains: " ", mode: "insensitive" } }
        ]
      }
    }),
    prisma.program.count({ where: { deletedAt: null, teams: { some: { deletedAt: null } } } }),
    Promise.resolve(23)
  ]);

  const queues = [
    {
      label: "Missing birthdates",
      count: missingBirthDate,
      href: "/admin/players",
      detail: "Update player bio in Program detail or Player Search."
    },
    {
      label: "Missing photos",
      count: missingPhoto,
      href: "/admin/programs",
      detail: "Use photo cropper in Program detail player tools."
    },
    {
      label: "Missing position",
      count: missingPosition,
      href: "/admin/players",
      detail: "Complete bio fields for scout-facing profiles."
    },
    {
      label: "Blocked legacy roster rows",
      count: blockedRosterNote,
      href: "/admin/programs",
      detail: "23 rows tracked (15 no-valid-target, 8 cross-season). See ADMIN_RUNBOOK.md."
    },
    {
      label: "Programs with teams",
      count: programsNeedingReview,
      href: "/admin/programs",
      detail: "Spot-check legacy roster review sections."
    },
    {
      label: "Duplicate review queue",
      count: duplicateCandidates,
      href: "/admin/data-health/player-duplicates",
      detail: "Manual duplicate review — no auto-merge."
    }
  ];

  const planners = [
    { cmd: "npm.cmd run plan:canonicalize-legacy-teams", label: "Legacy team canonicalization dry-run" },
    { cmd: "npm.cmd run plan:roster-only-canonicalization", label: "Roster-only canonicalization dry-run" },
    { cmd: "npm.cmd run plan:retire-generic-teams", label: "Generic team retirement dry-run" },
    { cmd: "npm.cmd run cleanup:zero-reference-legacy-teams:dry-run", label: "Zero-reference team cleanup dry-run" }
  ];

  return (
    <AdminPageTemplate
      title="Data Health"
      description="Remediation queues and read-only cleanup planner references. Execute scripts only with explicit approval."
    >
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {queues.map((queue) => (
          <article key={queue.label} className="border border-surface-200 bg-white p-4 shadow-sm">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-ink-500">{queue.label}</p>
            <strong className="mt-2 block font-display text-3xl font-bold text-court-900">{queue.count.toLocaleString()}</strong>
            <p className="mt-2 text-xs font-semibold leading-5 text-ink-600">{queue.detail}</p>
            <Link href={queue.href} className="mt-3 inline-block text-xs font-bold uppercase tracking-[0.08em] text-hardwood-600 hover:underline">
              Open remediation →
            </Link>
          </article>
        ))}
      </section>

      <section className="border border-surface-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-court-900">Cleanup planners (dry-run only)</h2>
        <ul className="mt-3 grid gap-2 text-sm font-semibold text-ink-700">
          {planners.map((item) => (
            <li key={item.cmd} className="border border-surface-100 bg-surface-50 px-3 py-2">
              <span className="block text-court-900">{item.label}</span>
              <code className="mt-1 block text-xs text-ink-500">{item.cmd}</code>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-500">See <code>docs/ADMIN_RUNBOOK.md</code> for monthly cadence.</p>
      </section>
    </AdminPageTemplate>
  );
}
