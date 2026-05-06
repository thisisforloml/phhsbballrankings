"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, Search, User, X } from "lucide-react";
import { useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { SearchOverlay } from "./SearchOverlay";

const groups = ["U13", "U16", "U19"] as const;
type MenuKey = "rankings" | "leagues";

export function Navbar() {
  const { session, logout } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const openDropdown = (menu: MenuKey) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    window.setTimeout(() => setOpenMenu(menu), 100);
  };

  const closeDropdown = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpenMenu(null), 200);
  };

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-40 border-b border-white/10 bg-navy-800">
        <div className="container-px flex min-h-20 items-center justify-between gap-6">
          <BrandMark />

          <nav className="hidden items-center gap-7 font-semibold text-white lg:flex" aria-label="Main navigation">
            <div className="relative" onMouseEnter={() => openDropdown("rankings")} onMouseLeave={closeDropdown}>
              <Link className="nav-underline" href="/rankings">Rankings</Link>
              {openMenu === "rankings" ? <RankingsDropdown /> : null}
            </div>
            <div className="relative" onMouseEnter={() => openDropdown("leagues")} onMouseLeave={closeDropdown}>
              <Link className="nav-underline" href="/leagues">Leagues</Link>
              {openMenu === "leagues" ? <LeaguesDropdown /> : null}
            </div>
            <Link className="nav-underline" href="/about">About</Link>
          </nav>

          <div className="flex items-center gap-3">
            <button aria-label="Open search" onClick={() => setSearchOpen(true)} className="rounded-full border border-white/35 p-2.5 text-white hover:border-amber-500 hover:text-amber-500">
              <Search className="h-5 w-5" aria-hidden="true" />
            </button>
            {session ? (
              <div className="relative hidden sm:block">
                <button onClick={() => setAccountOpen((open) => !open)} className="inline-flex items-center gap-2 rounded-md border border-white/55 px-4 py-2 text-sm font-semibold text-white hover:border-amber-500 hover:text-amber-500">
                  <User className="h-4 w-4" aria-hidden="true" />
                  {session.name}
                </button>
                {accountOpen ? (
                  <div className="absolute right-0 top-full mt-3 w-56 rounded-lg border border-surface-200 bg-white p-3 text-ink-900 shadow-panel">
                    <p className="truncate px-2 py-2 text-sm text-ink-600" title={session.email}>{session.email}</p>
                    <button onClick={() => { logout(); setAccountOpen(false); }} className="w-full rounded-md px-2 py-2 text-left font-semibold text-navy-800 hover:bg-navy-50">Logout</button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="hidden items-center gap-3 sm:flex">
                <Link href="/portal/login" className="rounded-md border border-white/65 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white hover:text-navy-800">Organizer Portal</Link>
                <Link href="/login" className="rounded-md border border-amber-500 bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:border-amber-600 hover:bg-amber-600">Member Login</Link>
              </div>
            )}
            <button className="rounded-md border border-white/35 p-2.5 text-white lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}

function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-3 leading-none" aria-label="OnCourt Rankings Philippines home">
      <img src="/oncourt-logo.png" alt="" className="h-12 w-12 rounded-sm object-contain" />
      <span>
        <span className="block font-display text-3xl font-extrabold tracking-normal text-white">ONCOURT</span>
        <span className="block font-mono text-[0.58rem] uppercase tracking-[0.18em] text-amber-500">Rankings PH</span>
      </span>
    </Link>
  );
}

function RankingsDropdown() {
  return (
    <div className="absolute left-1/2 top-full z-50 mt-4 w-[32rem] -translate-x-1/2 rounded-lg border border-surface-200 bg-white p-5 text-ink-900 shadow-panel">
      <div className="grid grid-cols-[1fr_1fr_auto] gap-6">
        {(["boys", "girls"] as const).map((gender) => (
          <section key={gender}>
            <h3 className="font-mono text-mono-sm uppercase text-navy-800">Players {gender}</h3>
            <div className="mt-3 grid gap-2 border-t border-surface-200 pt-3">
              {groups.map((group) => (
                <Link key={group} className="rounded-md px-2 py-1 hover:bg-amber-50 hover:text-amber-700" href={`/rankings/${gender}/${group.toLowerCase()}`}>{group}</Link>
              ))}
            </div>
          </section>
        ))}
        <section>
          <h3 className="font-mono text-mono-sm uppercase text-navy-800">Teams</h3>
          <div className="mt-3 grid gap-2 border-t border-surface-200 pt-3">
            <Link className="rounded-md px-2 py-1 hover:bg-amber-50 hover:text-amber-700" href="/teams">Team Rankings</Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function LeaguesDropdown() {
  return (
    <div className="absolute left-1/2 top-full z-50 mt-4 w-56 -translate-x-1/2 rounded-lg border border-surface-200 bg-white p-3 text-ink-900 shadow-panel">
      <Link className="block rounded-md px-3 py-2 font-semibold hover:bg-amber-50 hover:text-amber-700" href="/leagues">League Directory</Link>
      <Link className="block rounded-md px-3 py-2 font-semibold hover:bg-amber-50 hover:text-amber-700" href="/scores">Scores</Link>
    </div>
  );
}

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-50 bg-black/40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.aside onClick={(event) => event.stopPropagation()} initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} className="flex h-full w-[86vw] max-w-sm flex-col bg-navy-950 p-6 text-white">
            <div className="flex items-center justify-between">
              <BrandMark />
              <button onClick={onClose} aria-label="Close menu"><X className="h-6 w-6" aria-hidden="true" /></button>
            </div>
            <nav className="mt-8 grid gap-5 text-lg font-semibold">
              <section>
                <p>Rankings</p>
                <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                  {(["boys", "girls"] as const).map((gender) => (
                    <div key={gender}>
                      <p className="font-mono uppercase text-amber-500">Players {gender}</p>
                      {groups.map((group) => <Link key={group} onClick={onClose} className="mt-2 block" href={`/rankings/${gender}/${group.toLowerCase()}`}>{group}</Link>)}
                    </div>
                  ))}
                </div>
                <Link onClick={onClose} className="mt-4 block text-sm text-amber-500" href="/teams">Team Rankings</Link>
              </section>
              <section>
                <p>Leagues</p>
                <div className="mt-3 grid gap-2 text-sm">
                  <Link onClick={onClose} href="/leagues">League Directory</Link>
                  <Link onClick={onClose} href="/scores">Scores</Link>
                </div>
              </section>
              <Link onClick={onClose} href="/about">About</Link>
            </nav>
            <div className="mt-auto grid gap-3">
              <Link onClick={onClose} href="/portal/login" className="rounded-md border border-white/65 bg-white/10 px-4 py-3 text-center font-semibold text-white">Organizer Portal</Link>
              <Link onClick={onClose} href="/login" className="rounded-md bg-amber-500 px-4 py-3 text-center font-semibold text-white">Member Login</Link>
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
