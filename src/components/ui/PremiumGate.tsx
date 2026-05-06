"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthContext";

export function PremiumGate({
  children,
  description = "Unlock access to view the full data layer."
}: {
  children?: ReactNode;
  description?: string;
}) {
  const { session } = useAuth();
  if (session?.isPremium) return <>{children}</>;

  return (
    <section className="relative overflow-hidden rounded-lg border border-navy-50 bg-white shadow-sm">
      <div className="pointer-events-none blur-[5px]">
        {children ?? (
          <div className="grid gap-3 p-6 md:grid-cols-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <span key={index} className="h-24 rounded-md border border-surface-200 bg-navy-50" />
            ))}
          </div>
        )}
      </div>
      <div className="absolute inset-0 grid place-items-center bg-white/85 p-6 backdrop-blur-[2px]">
        <div className="max-w-md text-center">
          <Lock className="mx-auto h-9 w-9 text-navy-800" aria-hidden="true" />
          <p className="mt-3 font-mono text-mono-sm uppercase text-navy-800">Premium Access</p>
          <p className="mt-2 text-ink-600">{description}</p>
          <Link href="/register" className="button primary mt-5">Unlock Access</Link>
        </div>
      </div>
    </section>
  );
}
