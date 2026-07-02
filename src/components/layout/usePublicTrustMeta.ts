"use client";

import { useEffect, useState } from "react";

import type { PublicTrustMeta } from "@/lib/public-rankings-coverage";

let cachedTrustMeta: PublicTrustMeta | undefined;
let inflight: Promise<PublicTrustMeta> | null = null;

async function fetchPublicTrustMeta(): Promise<PublicTrustMeta> {
  if (cachedTrustMeta) {
    return cachedTrustMeta;
  }

  if (!inflight) {
    inflight = fetch("/api/public/trust-meta")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load public trust metadata");
        }
        return response.json() as Promise<PublicTrustMeta>;
      })
      .then((trustMeta) => {
        cachedTrustMeta = trustMeta;
        return trustMeta;
      })
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}

export function usePublicTrustMeta(initialTrustMeta?: PublicTrustMeta) {
  const [trustMeta, setTrustMeta] = useState<PublicTrustMeta | undefined>(initialTrustMeta ?? cachedTrustMeta);

  useEffect(() => {
    if (trustMeta?.lastUpdated) {
      return;
    }

    let cancelled = false;

    void fetchPublicTrustMeta()
      .then((nextTrustMeta) => {
        if (!cancelled) {
          setTrustMeta(nextTrustMeta);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTrustMeta({ lastUpdated: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [trustMeta?.lastUpdated]);

  return trustMeta;
}
