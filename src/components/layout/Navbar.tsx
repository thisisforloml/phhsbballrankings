"use client";

import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, Search, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { BRAND_ASSETS, BRAND_NAME } from "@/lib/brand";
import { SearchOverlay } from "./SearchOverlay";

const groups = ["U13", "U16", "U19"] as const;
type MenuKey = "rankings" | "about";
type PortalSession = { authenticated: false } | { authenticated: true; role: "ADMIN" | "ORGANIZER"; name: string; username: string };

type MemberSession = ReturnType<typeof useAuth>["session"];

export function Navbar() {
  const { session, logout } = useAuth();
  const [portalSession, setPortalSession] = useState<PortalSession | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/portal/session", { cache: "no-store" })
      .then((response) => response.json() as Promise<PortalSession>)
      .then((data) => {
        if (active) setPortalSession(data);
      })
      .catch(() => {
        if (active) setPortalSession({ authenticated: false });
      });
    return () => {
      active = false;
    };
  }, []);

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
      <header className="fixed left-0 right-0 top-0 z-40 border-b border-white/10 bg-court-900">
        <div className="container-px flex min-h-20 items-center justify-between gap-6">
          <BrandMark />

          <nav className="hidden items-center gap-7 text-sm font-bold uppercase tracking-[0.04em] text-white lg:flex" aria-label="Main navigation">
            <div className="relative" onMouseEnter={() => openDropdown("rankings")} onMouseLeave={closeDropdown}>
              <Link className="nav-underline" href="/rankings">Players</Link>
              {openMenu === "rankings" ? <RankingsDropdown /> : null}
            </div>
            <Link className="nav-underline" href="/teams">Teams</Link>
            <Link className="nav-underline" href="/leagues">Leagues</Link>
            <Link className="nav-underline" href="/games">Games</Link>
            <div className="relative" onMouseEnter={() => openDropdown("about")} onMouseLeave={closeDropdown}>
              <Link className="nav-underline" href="/about">About Us</Link>
              {openMenu === "about" ? <AboutDropdown /> : null}
            </div>
          </nav>

          <div className="flex items-center gap-3">
            <button aria-label="Open search" onClick={() => setSearchOpen(true)} className="rounded-sm border border-white/30 p-2.5 text-white hover:border-gold-500 hover:text-gold-500">
              <Search className="h-5 w-5" aria-hidden="true" />
            </button>
            <DesktopAccount portalSession={portalSession} memberSession={session} logout={logout} accountOpen={accountOpen} setAccountOpen={setAccountOpen} />
            <button className="rounded-sm border border-white/30 p-2.5 text-white lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} portalSession={portalSession} memberSession={session} />
    </>
  );
}

function DesktopAccount({ portalSession, memberSession, logout, accountOpen, setAccountOpen }: {
  portalSession: PortalSession | null;
  memberSession: MemberSession;
  logout: () => void;
  accountOpen: boolean;
  setAccountOpen: (open: boolean | ((open: boolean) => boolean)) => void;
}) {
  if (portalSession === null && !memberSession) {
    return <div className="hidden h-10 w-40 sm:block" aria-hidden="true" />;
  }

  if (portalSession?.authenticated && portalSession.role === "ADMIN") {
    return <Link href="/admin" className="hidden rounded-sm border border-hardwood-600 bg-hardwood-600 px-4 py-2 text-sm font-bold uppercase tracking-[0.04em] text-white hover:border-hardwood-700 hover:bg-hardwood-700 sm:inline-flex">Admin</Link>;
  }

  if (portalSession?.authenticated && portalSession.role === "ORGANIZER") {
    return <Link href="/organizer" className="hidden rounded-sm border border-white/65 bg-white/10 px-4 py-2 text-sm font-bold uppercase tracking-[0.04em] text-white hover:bg-white hover:text-court-900 sm:inline-flex">Organizer Portal</Link>;
  }

  if (memberSession) {
    return (
      <div className="relative hidden sm:block">
        <button onClick={() => setAccountOpen((open) => !open)} className="inline-flex items-center gap-2 rounded-sm border border-white/55 px-4 py-2 text-sm font-bold uppercase tracking-[0.04em] text-white hover:border-gold-500 hover:text-gold-500">
          <User className="h-4 w-4" aria-hidden="true" />
          {memberSession.name}
        </button>
        {accountOpen ? (
          <div className="absolute right-0 top-full mt-3 w-56 rounded-lg border border-surface-200 bg-white p-3 text-ink-900 shadow-panel">
            <p className="truncate px-2 py-2 text-sm text-ink-600" title={memberSession.email}>{memberSession.email}</p>
            <button onClick={() => { logout(); setAccountOpen(false); }} className="w-full rounded-sm px-2 py-2 text-left font-semibold text-court-900 hover:bg-paper-500">Logout</button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="hidden items-center gap-3 sm:flex">
      <Link href="/portal/login" className="rounded-sm border border-white/65 bg-white/10 px-4 py-2 text-sm font-bold uppercase tracking-[0.04em] text-white hover:bg-white hover:text-court-900">Organizer Portal</Link>
      <Link href="/login" className="rounded-sm border border-hardwood-600 bg-hardwood-600 px-4 py-2 text-sm font-bold uppercase tracking-[0.04em] text-white hover:border-hardwood-700 hover:bg-hardwood-700">Login</Link>
    </div>
  );
}

function BrandMark() {
  return (
    <Link href="/" className="flex shrink-0 items-center leading-none" aria-label={`${BRAND_NAME} home`}>
      <Image
        src={BRAND_ASSETS.horizontalLogo}
        alt={BRAND_NAME}
        width={640}
        height={214}
        priority
        sizes="(max-width: 640px) 160px, 200px"
        className="h-10 w-auto max-w-[11rem] object-contain object-left sm:h-11 sm:max-w-[12.5rem]"
      />
    </Link>
  );
}

function RankingsDropdown() {
  return (
    <div className="absolute left-1/2 top-full z-50 mt-4 w-[24rem] -translate-x-1/2 rounded-lg border border-surface-200 bg-white p-5 text-ink-900 shadow-panel">
      <div className="grid grid-cols-2 gap-6">
        {(["boys", "girls"] as const).map((gender) => (
          <section key={gender}>
            <h3 className="font-mono text-mono-sm uppercase text-navy-800">{gender === "boys" ? "Boys Rankings" : "Girls Rankings"}</h3>
            <div className="mt-3 grid gap-2 border-t border-surface-200 pt-3">
              {groups.map((group) => (
                <Link key={group} className="rounded-md px-2 py-1 hover:bg-amber-50 hover:text-amber-700" href={`/rankings/${gender}/${group.toLowerCase()}`}>{group}</Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}


function AboutDropdown() {
  return (
    <div className="absolute left-1/2 top-full z-50 mt-4 w-56 -translate-x-1/2 rounded-lg border border-surface-200 bg-white p-3 text-ink-900 shadow-panel">
      <Link className="block rounded-md px-3 py-2 font-semibold hover:bg-amber-50 hover:text-amber-700" href="/about">About Us</Link>
      <Link className="block rounded-md px-3 py-2 font-semibold hover:bg-amber-50 hover:text-amber-700" href="/how-we-rank">How We Rank</Link>
      <Link className="block rounded-md px-3 py-2 font-semibold hover:bg-amber-50 hover:text-amber-700" href="/faqs">FAQs</Link>
    </div>
  );
}

function MobileDrawer({ open, onClose, portalSession, memberSession }: { open: boolean; onClose: () => void; portalSession: PortalSession | null; memberSession: MemberSession }) {
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
                <p>Players</p>
                <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                  {(["boys", "girls"] as const).map((gender) => (
                    <div key={gender}>
                      <p className="font-mono uppercase text-amber-500">{gender === "boys" ? "Boys Rankings" : "Girls Rankings"}</p>
                      {groups.map((group) => <Link key={group} onClick={onClose} className="mt-2 block" href={`/rankings/${gender}/${group.toLowerCase()}`}>{group}</Link>)}
                    </div>
                  ))}
                </div>
              </section>
              <Link onClick={onClose} href="/teams">Teams</Link>
              <Link onClick={onClose} href="/leagues">Leagues</Link>
              <section>
                <p>Games</p>
                <div className="mt-3 grid gap-2 text-sm">
                  <Link onClick={onClose} href="/games">Game Results</Link>
                </div>
              </section>
              <section>
                <p>More</p>
                <div className="mt-3 grid gap-2 text-sm">
                  <Link onClick={onClose} href="/about">About Us</Link>
                  <Link onClick={onClose} href="/how-we-rank">How We Rank</Link>
                  <Link onClick={onClose} href="/faqs">FAQs</Link>
                </div>
              </section>
            </nav>
            <div className="mt-auto grid gap-3">
              {portalSession === null && !memberSession ? <span className="min-h-12" aria-hidden="true" /> : null}
              {portalSession?.authenticated && portalSession.role === "ADMIN" ? <Link onClick={onClose} href="/admin" className="rounded-md bg-amber-500 px-4 py-3 text-center font-semibold text-white">Admin</Link> : null}
              {portalSession?.authenticated && portalSession.role === "ORGANIZER" ? <Link onClick={onClose} href="/organizer" className="rounded-md border border-white/65 bg-white/10 px-4 py-3 text-center font-semibold text-white">Organizer Portal</Link> : null}
              {!portalSession?.authenticated && !memberSession ? <Link onClick={onClose} href="/portal/login" className="rounded-md border border-white/65 bg-white/10 px-4 py-3 text-center font-semibold text-white">Organizer Portal</Link> : null}
              {!portalSession?.authenticated && !memberSession ? <Link onClick={onClose} href="/login" className="rounded-md bg-amber-500 px-4 py-3 text-center font-semibold text-white">Login</Link> : null}
              {memberSession && !portalSession?.authenticated ? <Link onClick={onClose} href="/account" className="rounded-md bg-amber-500 px-4 py-3 text-center font-semibold text-white">My Account</Link> : null}
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
