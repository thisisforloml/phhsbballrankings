"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthContext";

const defaultPremiumDescription = "Unlock deeper player insights, advanced stats, ranking movement, and recruiting tools with Premium Access.";

export function PremiumGate({
  children,
  description = defaultPremiumDescription
}: {
  children?: ReactNode;
  description?: string;
}) {
  const { session } = useAuth();
  if (session?.isPremium) return <>{children}</>;

  const premiumDescription = description.trim() || defaultPremiumDescription;

  return (
    <section className="relative min-h-[20rem] overflow-hidden border border-line-500 bg-white">
      <div className="pointer-events-none scale-[1.03] opacity-85 blur-[10px]">
        {children ?? (
          <div className="grid gap-3 p-6 md:grid-cols-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <span key={index} className="h-24 border border-line-500 bg-paper-500" />
            ))}
          </div>
        )}
      </div>
      <div className="absolute inset-0 grid place-items-center bg-white/82 p-6 backdrop-blur-xl">
        <div className="max-w-md border border-white/70 bg-white/58 p-6 text-center backdrop-blur-xl">
          <Lock className="mx-auto h-9 w-9 text-hardwood-600" aria-hidden="true" />
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-court-900">Premium Access</p>
          <p className="mt-3 text-sm font-semibold leading-6 text-court-600">{premiumDescription}</p>
          <Link href="/register" className="button primary mt-5">Unlock Access</Link>
        </div>
      </div>
    </section>
  );
}

