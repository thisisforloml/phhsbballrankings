"use client";

import { createContext, type ReactNode,useCallback, useContext, useEffect, useMemo, useState } from "react";

type SavedPlayer = {
  slug: string;
  displayName: string;
  savedAt: string;
};

type SavedPlayersContextValue = {
  saved: SavedPlayer[];
  isSaved: (slug: string) => boolean;
  toggle: (player: Omit<SavedPlayer, "savedAt">) => void;
  remove: (slug: string) => void;
};

const storageKey = "peach-basket-saved-players";

const SavedPlayersContext = createContext<SavedPlayersContextValue | null>(null);

function readSaved(): SavedPlayer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedPlayer[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function SavedPlayersProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<SavedPlayer[]>([]);

  useEffect(() => {
    setSaved(readSaved());
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(saved));
  }, [saved]);

  const isSaved = useCallback((slug: string) => saved.some((item) => item.slug === slug), [saved]);

  const toggle = useCallback((player: Omit<SavedPlayer, "savedAt">) => {
    setSaved((current) => {
      const exists = current.some((item) => item.slug === player.slug);
      if (exists) return current.filter((item) => item.slug !== player.slug);
      return [{ ...player, savedAt: new Date().toISOString() }, ...current].slice(0, 50);
    });
  }, []);

  const remove = useCallback((slug: string) => {
    setSaved((current) => current.filter((item) => item.slug !== slug));
  }, []);

  const value = useMemo(() => ({ saved, isSaved, toggle, remove }), [isSaved, remove, saved, toggle]);

  return <SavedPlayersContext.Provider value={value}>{children}</SavedPlayersContext.Provider>;
}

export function useSavedPlayers() {
  const context = useContext(SavedPlayersContext);
  if (!context) throw new Error("useSavedPlayers must be used within SavedPlayersProvider");
  return context;
}
