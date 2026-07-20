"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import {
  capturePublicEvent,
  capturePublicPageView,
  initPublicAnalytics,
  normalizePublicRoute,
} from "@/lib/public-analytics";

export function PublicAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!initPublicAnalytics()) return;
    capturePublicPageView(pathname);

    const route = normalizePublicRoute(pathname);
    if (route === "/rankings") capturePublicEvent("ranking_board_viewed", { route });
    if (route === "/teams") capturePublicEvent("team_rankings_viewed", { route });
    if (route === "/coming-soon") capturePublicEvent("coming_soon_viewed", { route });
  }, [pathname]);

  return null;
}
