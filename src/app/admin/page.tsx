import Link from "next/link";
import { requireAdminUser } from "@/lib/portal-auth";

export const metadata = {
  title: "Admin Portal",
  description: "Internal OnCourt administration tools."
};

const sections = [
  {
    title: "Player Management",
    description: "Edit player bio fields and prepare future duplicate review workflows.",
    links: [{ label: "Player Bio Editor", href: "/admin/players" }]
  },
  {
    title: "Team Management",
    description: "Review team records, aliases, and school display cleanup needs.",
    links: [{ label: "Team Editor", href: "/admin/teams" }]
  },
  {
    title: "Submission Review",
    description: "Review organizer-submitted JSON, CSV, and XLSX intake records.",
    links: [{ label: "Admin Review", href: "/admin/submissions" }]
  },
  {
    title: "Organizer Tools",
    description: "Access the same external submission workflows that organizers use.",
    links: [
      { label: "Organizer Dashboard", href: "/organizer" },
      { label: "Organizer Submissions", href: "/organizer/submissions" },
      { label: "Live Stats Entry", href: "/organizer/live-stats" }
    ]
  },
  {
    title: "Rankings / Data QA",
    description: "Formula runs, ranking snapshots, validation reports, and data audit workflows.",
    links: []
  },
  {
    title: "Site Settings",
    description: "Future controls for public content, homepage modules, and platform configuration.",
    links: []
  }
];

export default async function AdminPage() {
  const user = await requireAdminUser();

  return (
    <main className="min-h-screen bg-surface-50 pt-20">
      <div className="grid lg:grid-cols-[17rem_1fr]">
        <aside className="bg-navy-800 px-5 py-8 text-white lg:min-h-[calc(100vh-5rem)]">
          <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">Admin Portal</p>
          <nav className="mt-8 grid gap-2 font-semibold">
            <Link href="/admin" className="rounded-md bg-white/10 px-3 py-2 text-amber-300">Dashboard</Link>
            <Link href="/admin/players" className="rounded-md px-3 py-2 hover:bg-white/10">Players</Link>
            <Link href="/admin/teams" className="rounded-md px-3 py-2 hover:bg-white/10">Teams</Link>
            <Link href="/admin/submissions" className="rounded-md px-3 py-2 hover:bg-white/10">Submissions</Link>
            <Link href="/portal/logout" className="rounded-md px-3 py-2 hover:bg-white/10">Sign out</Link>
          </nav>
        </aside>

        <section className="container-px grid gap-6 py-8">
          <div className="rounded-lg border border-surface-200 bg-white p-6 shadow-panel">
            <p className="label">Internal operations</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-stat-md text-navy-800">Admin Portal</h1>
                <p className="mt-2 max-w-3xl text-ink-600">Signed in as {user.name}. Admin can access internal tools and organizer workflows.</p>
              </div>
              <span className="rounded-full bg-navy-50 px-4 py-2 font-mono text-mono-sm uppercase text-navy-800">{user.role}</span>
            </div>
          </div>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sections.map((section) => (
              <article key={section.title} className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
                <h2 className="font-display text-3xl text-navy-800">{section.title}</h2>
                <p className="mt-3 min-h-12 text-sm leading-6 text-ink-600">{section.description}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {section.links.length ? section.links.map((link) => (
                    <Link key={link.href} href={link.href} className="button primary w-fit">{link.label}</Link>
                  )) : <span className="rounded-md bg-surface-100 px-4 py-2 text-sm font-semibold text-surface-500">Planned</span>}
                </div>
              </article>
            ))}
          </section>
        </section>
      </div>
    </main>
  );
}
