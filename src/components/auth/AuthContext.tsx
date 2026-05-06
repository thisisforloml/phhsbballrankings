"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export interface AuthSession {
  email: string;
  name: string;
  isPremium: true;
}

interface AuthContextValue {
  session: AuthSession | null;
  hydrated: boolean;
  signIn: (email: string, password?: string) => boolean;
  registerPremium: (session: AuthSession) => void;
  logout: () => void;
}

const storageKey = "oncourt-auth-session";
const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    return parsed?.email && parsed.isPremium ? parsed : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSession(readStoredSession());
    setHydrated(true);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    hydrated,
    signIn(email, password) {
      const raw = email.trim();
      const normalized = raw.toLowerCase();
      if (raw === "DarwinOwner" && password === "DarwinRanks") {
        const ownerSession: AuthSession = {
          email: "DarwinOwner",
          name: "DarwinOwner",
          isPremium: true
        };
        setSession(ownerSession);
        window.localStorage.setItem(storageKey, JSON.stringify(ownerSession));
        return true;
      }
      if (!normalized.endsWith("@oncourtrankings.ph")) return false;
      const nextSession: AuthSession = {
        email: normalized,
        name: normalized.split("@")[0],
        isPremium: true
      };
      setSession(nextSession);
      window.localStorage.setItem(storageKey, JSON.stringify(nextSession));
      return true;
    },
    registerPremium(nextSession) {
      setSession(nextSession);
      window.localStorage.setItem(storageKey, JSON.stringify(nextSession));
    },
    logout() {
      setSession(null);
      window.localStorage.removeItem(storageKey);
    }
  }), [hydrated, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
