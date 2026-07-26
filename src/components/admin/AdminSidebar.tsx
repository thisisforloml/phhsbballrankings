import Link from "next/link";

const adminItems = [
  { href: "/admin", label: "Dashboard", key: "dashboard" },
  { href: "/admin/submissions", label: "Submissions", key: "submissions" },
  { href: "/admin/players", label: "Players", key: "players" },
  { href: "/admin/programs", label: "Organizations & Programs", key: "programs" },
  { href: "/admin/teams", label: "Teams", key: "teams" },
  { href: "/admin/leagues", label: "Leagues & Competitions", key: "leagues" },
  { href: "/admin/claims", label: "Profile Claims Request", key: "claims" },
  { href: "/admin/intake", label: "Organizer Submissions & Applications", key: "intake" },
  { href: "/admin/data-health", label: "Operations & Data Health", key: "dataHealth" },
] as const;

export type AdminNavKey = typeof adminItems[number]["key"] | "ops";

function itemClassName(active: boolean) {
  return `block rounded-md px-2.5 py-2 transition ${
    active
      ? "bg-accent-500/15 font-semibold text-accent-300 shadow-[inset_2px_0_0_theme(colors.accent.400)]"
      : "text-white/70 hover:bg-white/10 hover:text-white"
  }`;
}

export function AdminSidebar({ active }: { active: AdminNavKey }) {
  return (
    <aside className="border-r border-white/10 bg-primary-950 px-3 py-4 text-white lg:min-h-[calc(100vh-4rem)]">
      <p className="px-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-white/40">Workspace</p>
      <nav className="mt-2 grid gap-0.5 text-sm font-medium" aria-label="Admin">
        {adminItems.map((item) => (
          <Link key={item.key} href={item.href} prefetch={false} className={itemClassName(active === item.key)}>
            {item.label}
          </Link>
        ))}
      </nav>


      <div className="mt-5 border-t border-white/10 pt-3 text-sm">
        <Link href="/portal/logout" prefetch={false} className="block rounded-md px-2.5 py-2 text-white/45 transition hover:bg-white/10 hover:text-white/80">
          Sign out
        </Link>
      </div>
    </aside>
  );
}
