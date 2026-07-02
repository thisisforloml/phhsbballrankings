"use client";

import { useEffect } from "react";

import { PeachBasketLoader } from "@/components/ui/PeachBasketLoader";

export function PublicSiteLoading() {
  useEffect(() => {
    const footer = document.querySelector("footer");
    const previousDisplay = footer?.style.display;
    if (footer) footer.style.display = "none";

    return () => {
      if (footer) footer.style.display = previousDisplay ?? "";
    };
  }, []);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 flex min-h-[calc(100vh-var(--navbar-height))] flex-col items-center justify-center bg-scout-900"
      style={{ top: "var(--navbar-height)" }}
    >
      <PeachBasketLoader label="Loading page" />
    </div>
  );
}
