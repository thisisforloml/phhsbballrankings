import Link from "next/link";
import { requireAdminUser } from "@/lib/portal-auth";

export const metadata = {
  title: "Admin Portal",
  description: "Internal OnCourt administration tools."
};

const adminTools = [
  {
    title: "Player Bio Editor",
    description: "Search and update existing player profile fields.",
    href: "/admin/players",
    status: "Available"
  },
  {
    title: "Duplicate Player Merge",
    description: "Review and merge duplicate player records.",
    href: "#duplicates",
    status: "Later"
  },
  {
    title: "Ratings and Rankings",
    description: "Review formula runs and public ranking snapshots.",
    href: "#ratings",
    status: "Later"
  },
  {
    title: "Data QA Review",
    description: "Audit submitted games, stat rows, and validation reports.",
    href: "#qa",
    status: "Later"
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
            <Link href="/organizer" className="rounded-md px-3 py-2 hover:bg-white/10">Organizer Portal</Link>
            <Link href="/portal/logout" className="rounded-md px-3 py-2 hover:bg-white/10">Sign out</Link>
          </nav>
        </aside>

        <section className="container-px grid gap-6 py-8">
          <div className="rounded-lg border border-surface-200 bg-white p-6 shadow-panel">
            <p className="label">Internal team tools</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-stat-md text-navy-800">Admin Portal</h1>
                <p className="mt-2 max-w-3xl text-ink-600">
                  Signed in as {user.name}. This area is for OnCourt internal administration only.
                </p>
              </div>
              <span className="rounded-full bg-navy-50 px-4 py-2 font-mono text-mono-sm uppercase text-navy-800">{user.role}</span>
            </div>
          </div>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {adminTools.map((tool) => (
              <article key={tool.title} className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-2xl text-navy-800">{tool.title}</h2>
                  <span className="rounded-full bg-surface-100 px-3 py-1 font-mono text-mono-sm uppercase text-surface-600">{tool.status}</span>
                </div>
                <p className="mt-3 text-sm text-ink-600">{tool.description}</p>
                {tool.href.startsWith("/") ? (
                  <Link href={tool.href} className="button primary mt-5 w-fit">Open</Link>
                ) : (
                  <span className="mt-5 inline-flex rounded-md bg-surface-100 px-4 py-2 text-sm font-semibold text-surface-500">Planned</span>
                )}
              </article>
            ))}
          </section>
        </section>
      </div>
    </main>
  );
}