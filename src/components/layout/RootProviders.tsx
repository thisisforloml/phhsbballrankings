"use client";

import { AuthProvider } from "@/components/auth/AuthContext";
import { SavedPlayersProvider } from "@/components/public/SavedPlayersProvider";

export function RootProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SavedPlayersProvider>{children}</SavedPlayersProvider>
    </AuthProvider>
  );
}
