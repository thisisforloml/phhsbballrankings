"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PortraitAvatar } from "@/components/public/PortraitAvatar";
import { StarRating } from "@/components/ui";

type PublicSearchResult =
  | {
      type: "Player";
      id: string;
      title: string;
      href: string;
      subtitle: string;
      meta: string;
      rankLabel: string | null;
      rating: number | null;
      photoUrl: string | null;
      primaryCompetitionLine: string | null;
    }
  | {
      type: "Team";
      id: string;
      title: string;
      href: string;
      subtitle: string;
      meta: string;
    }
  | {
      type: "League";
      id: string;
      title: string;
      href: string;
      subtitle: string;
      meta: string;
    };

type SearchResponse = {
  query: string;
  results: PublicSearchResult[];
};

function starsFromRating(rating: number | null): 1 | 2 | 3 | 4 | 5 {
  if (rating == null) return 1;
  if (rating >= 90) return 5;
  if (rating >= 80) return 4;
  if (rating >= 70) return 3;
  if (rating >= 60) return 2;
  return 1;
}

function ResultCard({ result, onClose }: { result: PublicSearchResult; onClose: () => void }) {
  if (result.type === "Player") {
    return (
      <Link
        href={result.href}
        onClick={onClose}
        className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border border-line-500 bg-white p-4 hover:border-court-900 hover:bg-paper-500"
      >
        <PortraitAvatar photoUrl={result.photoUrl} name={result.title} />
        <span className="min-w-0">
          <strong className="block truncate text-court-900">{result.title}</strong>
          <small className="block truncate text-court-500">{result.subtitle}</small>
          {result.primaryCompetitionLine ? (
            <small className="block truncate text-court-400">{result.primaryCompetitionLine}</small>
          ) : null}
        </span>
        <span className="text-right">
          {result.rating != null ? (
            <>
              <strong className="block font-display text-lg font-black text-court-900">{result.rating.toFixed(1)}</strong>
              <StarRating stars={starsFromRating(result.rating)} />
            </>
          ) : null}
          {result.rankLabel ? <small className="mt-1 block text-xs font-bold text-court-500">{result.rankLabel}</small> : null}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={result.href}
      onClick={onClose}
      className="flex items-center justify-between gap-4 border border-line-500 bg-white p-4 hover:border-court-900 hover:bg-paper-500"
    >
      <span className="min-w-0">
        <strong className="block truncate text-court-900">{result.title}</strong>
        <small className="block truncate text-court-500">{result.subtitle}</small>
      </span>
      <small className="shrink-0 text-xs font-bold text-court-400">{result.meta}</small>
    </Link>
  );
}

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PublicSearchResult[]>([]);
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

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { cache: "no-store" });
        if (!active) return;
        if (!response.ok) {
          setResults([]);
          return;
        }
        const data = (await response.json()) as SearchResponse;
        setResults(data.results);
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [query]);

  const grouped = useMemo(() => {
    return {
      players: results.filter((item) => item.type === "Player"),
      teams: results.filter((item) => item.type === "Team"),
      leagues: results.filter((item) => item.type === "League"),
    };
  }, [results]);

  const hasQuery = query.trim().length >= 2;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 overflow-y-auto bg-paper-500/97 px-5 py-8 backdrop-blur"
        >
          <button
            className="absolute right-5 top-5 border border-line-500 bg-white p-3 text-court-900 hover:border-court-900"
            onClick={onClose}
            aria-label="Close search"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <motion.div
            initial={{ y: -18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -18, opacity: 0 }}
            className="mx-auto mt-20 max-w-5xl"
          >
            <label className="relative block">
              <Search className="absolute left-0 top-1/2 h-8 w-8 -translate-y-1/2 text-court-900" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full border-0 border-b border-line-500 bg-transparent py-6 pl-12 font-display text-4xl font-bold text-court-900 outline-none placeholder:text-court-300 md:text-6xl"
                placeholder="Search players, teams, leagues..."
              />
            </label>

            <div className="mt-10 grid gap-8 lg:grid-cols-3">
              <section>
                <h2 className="text-xs font-black uppercase tracking-[0.14em] text-court-500">Players</h2>
                <div className="mt-4 grid gap-3">
                  {!hasQuery ? <p className="text-court-500">Start typing to search.</p> : null}
                  {loading ? <p className="text-court-500">Searching...</p> : null}
                  {hasQuery && !loading && grouped.players.length === 0 ? (
                    <p className="text-court-500">No player results.</p>
                  ) : null}
                  {grouped.players.map((result) => (
                    <ResultCard key={`${result.type}-${result.id}`} result={result} onClose={onClose} />
                  ))}
                </div>
              </section>
              <section>
                <h2 className="text-xs font-black uppercase tracking-[0.14em] text-court-500">Teams</h2>
                <div className="mt-4 grid gap-3">
                  {hasQuery && !loading && grouped.teams.length === 0 ? (
                    <p className="text-court-500">No team results.</p>
                  ) : null}
                  {grouped.teams.map((result) => (
                    <ResultCard key={`${result.type}-${result.id}`} result={result} onClose={onClose} />
                  ))}
                </div>
              </section>
              <section>
                <h2 className="text-xs font-black uppercase tracking-[0.14em] text-court-500">Leagues</h2>
                <div className="mt-4 grid gap-3">
                  {hasQuery && !loading && grouped.leagues.length === 0 ? (
                    <p className="text-court-500">No league results.</p>
                  ) : null}
                  {grouped.leagues.map((result) => (
                    <ResultCard key={`${result.type}-${result.id}`} result={result} onClose={onClose} />
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
