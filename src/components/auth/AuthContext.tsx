"use client";

import { createContext, useContext, useMemo } from "react";

export interface AuthSession {
  email: string;
  name: string;
  isPremium: true;
}

interface AuthContextValue {
  session: AuthSession | null;
  hydrated: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<AuthContextValue>(() => ({
    session: null,
    hydrated: true,
    logout() {
      // Member authentication is intentionally deferred for the private preview.
    },
  }), []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
