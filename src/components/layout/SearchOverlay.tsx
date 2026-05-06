"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { leagues, players, formatPlayerName } from "@/lib/mock-data";
import { PlayerAvatar, RatingBadge } from "@/components/ui";

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return { players: [], leagues: [] };
    return {
      players: players.filter((player) => formatPlayerName(player).toLowerCase().includes(needle) || player.city.toLowerCase().includes(needle)).slice(0, 6),
      leagues: leagues.filter((league) => league.name.toLowerCase().includes(needle) || league.region.toLowerCase().includes(needle)).slice(0, 5)
    };
  }, [query]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 overflow-y-auto bg-white/97 px-5 py-8 backdrop-blur">
          <button className="absolute right-5 top-5 rounded-full border border-surface-300 p-3 text-ink-900" onClick={onClose} aria-label="Close search">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <motion.div initial={{ y: -18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -18, opacity: 0 }} className="mx-auto mt-20 max-w-5xl">
            <label className="relative block">
              <Search className="absolute left-0 top-1/2 h-8 w-8 -translate-y-1/2 text-navy-800" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full border-0 border-b border-surface-300 bg-transparent py-6 pl-12 font-display text-5xl font-bold text-ink-900 outline-none placeholder:text-ink-300 md:text-7xl"
                placeholder="Search players, leagues..."
              />
            </label>
            <div className="mt-10 grid gap-8 lg:grid-cols-2">
              <section>
                <h2 className="label">Players</h2>
                <div className="mt-4 grid gap-3">
                  {!query ? <p className="text-ink-500">Start typing to search.</p> : null}
                  {query && results.players.length === 0 ? <p className="text-ink-500">No player results.</p> : null}
                  {results.players.map((player) => (
                    <Link key={player.id} href={`/players/${player.id}`} onClick={onClose} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-lg border border-surface-200 bg-white p-4 hover:border-navy-800 hover:bg-navy-50">
                      <PlayerAvatar player={player} size="sm" />
                      <span>
                        <strong className="block text-ink-900">{formatPlayerName(player)}</strong>
                        <small className="text-ink-500">{player.position ? `${player.position} · ` : ""}{player.city}</small>
                      </span>
                      <RatingBadge rating={player.rating} />
                    </Link>
                  ))}
                </div>
              </section>
              <section>
                <h2 className="label">Leagues</h2>
                <div className="mt-4 grid gap-3">
                  {query && results.leagues.length === 0 ? <p className="text-ink-500">No league results.</p> : null}
                  {results.leagues.map((league) => (
                    <Link key={league.id} href={`/leagues/${league.id}`} onClick={onClose} className="flex items-center justify-between gap-4 rounded-lg border border-surface-200 bg-white p-4 hover:border-navy-800 hover:bg-navy-50">
                      <span>
                        <strong className="block text-ink-900">{league.name}</strong>
                        <small className="text-ink-500">{league.city} · {league.region} · {league.ageGroup} {league.gender}</small>
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
