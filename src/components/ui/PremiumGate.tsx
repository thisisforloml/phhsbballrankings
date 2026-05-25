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
    <section className="relative min-h-[20rem] overflow-hidden border border-line-500 bg-white">
      <div className="pointer-events-none blur-[4px]">
        {children ?? (
          <div className="grid gap-3 p-6 md:grid-cols-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <span key={index} className="h-24 border border-line-500 bg-paper-500" />
            ))}
          </div>
        )}
      </div>
      <div className="absolute inset-0 grid place-items-center bg-white/88 p-6 backdrop-blur-[2px]">
        <div className="max-w-md text-center">
          <Lock className="mx-auto h-9 w-9 text-hardwood-600" aria-hidden="true" />
          <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-court-900">Premium Access</p>
          <p className="mt-2 text-court-600">{description}</p>
          <Link href="/register" className="button primary mt-5">Unlock Access</Link>
        </div>
      </div>
    </section>
  );
}

