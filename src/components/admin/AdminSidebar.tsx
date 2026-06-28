import Link from "next/link";
import { BRAND_ADMIN_EYEBROW } from "@/lib/brand";

const primaryItems = [
  { href: "/admin/players", label: "Players", key: "players" },
  { href: "/admin/teams", label: "Teams", key: "teams" },
  { href: "/admin/leagues", label: "Leagues", key: "leagues" },
  { href: "/admin/programs", label: "Programs", key: "programs" },
  { href: "/admin/submissions", label: "Game Stats", key: "submissions" },
  { href: "/admin/claims", label: "Profile Claims", key: "claims" }
] as const;

const opsItem = { href: "/admin/ops", label: "Ops", key: "ops" } as const;

export type AdminNavKey =
  | typeof primaryItems[number]["key"]
  | typeof opsItem["key"];

export function AdminSidebar({ active }: { active: AdminNavKey }) {
  return (
    <aside className="border-r border-white/10 bg-primary-950 px-3 py-4 text-white lg:min-h-[calc(100vh-4rem)]">
      <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3">
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-accent-400">{BRAND_ADMIN_EYEBROW}</p>
      </div>
      <nav className="mt-4 grid gap-0.5 text-sm font-medium" aria-label="Admin">
        {primaryItems.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={`rounded-md px-2.5 py-2 transition ${active === item.key ? "bg-accent-500/15 font-semibold text-accent-300 shadow-[inset_2px_0_0_theme(colors.accent.400)]" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <nav className="mt-6 border-t border-white/10 pt-4 text-sm" aria-label="Admin utilities">
        <Link
          href={opsItem.href}
          className={`block rounded-md px-2.5 py-2 transition ${active === opsItem.key ? "bg-accent-500/15 font-semibold text-accent-300" : "text-white/45 hover:bg-white/10 hover:text-white/80"}`}
        >
          {opsItem.label}
        </Link>
        <Link href="/portal/logout" className="mt-0.5 block rounded-md px-2.5 py-2 text-white/45 transition hover:bg-white/10 hover:text-white/80">
          Sign out
        </Link>
      </nav>
    </aside>
  );
}
