import Link from "next/link";

const items = [
  { href: "/admin", label: "Dashboard", key: "dashboard" },
  { href: "/admin/submissions", label: "Submissions", key: "submissions" },
  { href: "/admin/programs", label: "Programs", key: "programs" },
  { href: "/admin/players", label: "Players", key: "players" },
  { href: "/rankings", label: "Rankings / Data Health", key: "rankings" },
  { href: "/admin/teams", label: "Teams (Legacy)", key: "teams" },
  { href: "/organizer/submissions", label: "Organizer Tools", key: "organizer" }
] as const;

export type AdminNavKey = typeof items[number]["key"];

export function AdminSidebar({ active }: { active: AdminNavKey }) {
  return (
    <aside className="bg-navy-800 px-5 py-8 text-white lg:min-h-[calc(100vh-5rem)]">
      <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">Admin Portal</p>
      <nav className="mt-8 grid gap-2 font-semibold">
        {items.map((item) => (
          <Link key={item.key} href={item.href} className={`rounded-md px-3 py-2 hover:bg-white/10 ${active === item.key ? "bg-white/10 text-amber-300" : ""}`}>
            {item.label}
          </Link>
        ))}
        <Link href="/portal/logout" className="rounded-md px-3 py-2 hover:bg-white/10">Sign out</Link>
      </nav>
    </aside>
  );
}
