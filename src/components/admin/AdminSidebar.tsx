import Link from "next/link";

const primaryItems = [
  { href: "/admin", label: "Dashboard", key: "dashboard" },
  { href: "/admin/submissions", label: "Submissions", key: "submissions" },
  { href: "/admin/programs", label: "Programs", key: "programs" },
  { href: "/rankings", label: "Rankings / Data Health", key: "rankings" }
] as const;

const utilityItems = [
  { href: "/admin/players", label: "Player Search", key: "players" },
  { href: "/admin/data-health/player-duplicates", label: "Player Duplicate Review", key: "playerDuplicates" },
  { href: "/admin/tools/submissions", label: "Submission Tools", key: "adminTools" },
  { href: "/admin/tools/live-stats", label: "Manual Stats Entry", key: "manualStats" }
] as const;

export type AdminNavKey = typeof primaryItems[number]["key"] | typeof utilityItems[number]["key"] | "teams";

export function AdminSidebar({ active }: { active: AdminNavKey }) {
  return (
    <aside className="bg-navy-800 px-5 py-8 text-white lg:min-h-[calc(100vh-5rem)]">
      <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">Admin Portal</p>
      <nav className="mt-8 grid gap-2 font-semibold">
        {primaryItems.map((item) => (
          <Link key={item.key} href={item.href} className={`rounded-md px-3 py-2 hover:bg-white/10 ${active === item.key ? "bg-white/10 text-amber-300" : ""}`}>
            {item.label}
          </Link>
        ))}
        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="px-3 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-white/45">Utilities</p>
          <div className="mt-2 grid gap-2 text-sm font-semibold">
            {utilityItems.map((item) => (
              <Link key={item.key} href={item.href} className={`rounded-md px-3 py-2 hover:bg-white/10 ${active === item.key ? "bg-white/10 text-amber-300" : ""}`}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <Link href="/portal/logout" className="rounded-md px-3 py-2 hover:bg-white/10">Sign out</Link>
      </nav>
    </aside>
  );
}
