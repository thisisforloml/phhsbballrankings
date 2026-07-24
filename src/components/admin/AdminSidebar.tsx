import Link from "next/link";

const dailyItems = [
  { href: "/admin", label: "Dashboard", key: "dashboard" },
  { href: "/admin/submissions", label: "Submissions", key: "submissions" },
  { href: "/admin/programs", label: "Programs", key: "programs" },
  { href: "/admin/players", label: "Players", key: "players" },
  { href: "/admin/data-health", label: "Data Health", key: "dataHealth" },
] as const;

const advancedItems = [
  { href: "/admin/teams", label: "Internal Teams", key: "teams" },
  { href: "/admin/leagues", label: "Leagues", key: "leagues" },
  { href: "/admin/claims", label: "Claims", key: "claims" },
  { href: "/admin/intake", label: "Intake", key: "intake" },
  { href: "/admin/ops", label: "Operations", key: "ops" },
] as const;

export type AdminNavKey =
  | typeof dailyItems[number]["key"]
  | typeof advancedItems[number]["key"];

function itemClassName(active: boolean) {
  return `block rounded-md px-2.5 py-2 transition ${
    active
      ? "bg-accent-500/15 font-semibold text-accent-300 shadow-[inset_2px_0_0_theme(colors.accent.400)]"
      : "text-white/70 hover:bg-white/10 hover:text-white"
  }`;
}

export function AdminSidebar({ active }: { active: AdminNavKey }) {
  const advancedActive = advancedItems.some((item) => item.key === active);

  return (
    <aside className="border-r border-white/10 bg-primary-950 px-3 py-4 text-white lg:min-h-[calc(100vh-4rem)]">
      <p className="px-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-white/40">Workspace</p>
      <nav className="mt-2 grid gap-0.5 text-sm font-medium" aria-label="Admin">
        {dailyItems.map((item) => (
          <Link key={item.key} href={item.href} prefetch={false} className={itemClassName(active === item.key)}>
            {item.label}
          </Link>
        ))}
      </nav>

      <details className="mt-5 border-t border-white/10 pt-3" open={advancedActive}>
        <summary className="cursor-pointer list-none rounded-md px-2.5 py-2 text-xs font-semibold text-white/45 hover:bg-white/10 hover:text-white/80">
          Advanced
        </summary>
        <nav className="mt-1 grid gap-0.5 text-sm" aria-label="Advanced admin">
          {advancedItems.map((item) => (
            <Link key={item.key} href={item.href} prefetch={false} className={itemClassName(active === item.key)}>
              {item.label}
            </Link>
          ))}
        </nav>
      </details>

      <div className="mt-5 border-t border-white/10 pt-3 text-sm">
        <Link href="/portal/logout" prefetch={false} className="block rounded-md px-2.5 py-2 text-white/45 transition hover:bg-white/10 hover:text-white/80">
          Sign out
        </Link>
      </div>
    </aside>
  );
}
