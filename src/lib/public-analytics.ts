"use client";

import posthog from "posthog-js";

export type PublicAnalyticsEvent =
  | "ranking_board_viewed"
  | "ranking_filter_changed"
  | "search_opened"
  | "team_rankings_viewed"
  | "submit_stats_clicked"
  | "coming_soon_viewed";

const allowedProperties = new Set([
  "route",
  "ageGroup",
  "gender",
  "filter",
  "destination",
]);

const requiredPostHogProperties = new Set(["token", "distinct_id"]);

let lastCapturedPathname: string | null = null;

function analyticsConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() &&
      process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim()
  );
}

function doNotTrackEnabled() {
  if (typeof navigator === "undefined") return true;
  return navigator.doNotTrack === "1";
}

export function normalizePublicRoute(pathname: string) {
  if (/^\/players\/[^/]+/.test(pathname)) return "/players/[profile]";
  if (/^\/teams\/[^/]+/.test(pathname)) return "/teams/[profile]";
  if (/^\/leagues\/[^/]+/.test(pathname)) return "/leagues/[competition]";
  if (/^\/games\/[^/]+/.test(pathname)) return "/games/[game]";
  return pathname;
}

export function initPublicAnalytics() {
  if (typeof window === "undefined" || !analyticsConfigured() || doNotTrackEnabled()) {
    return false;
  }

  if (!posthog.__loaded) {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      advanced_disable_feature_flags: true,
      person_profiles: "never",
      persistence: "memory",
      respect_dnt: true,
      before_send(event) {
        if (!event) return null;

        const sanitized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(event.properties)) {
          if (
            key.startsWith("$") ||
            allowedProperties.has(key) ||
            requiredPostHogProperties.has(key)
          ) {
            sanitized[key] = value;
          }
        }

        const route = normalizePublicRoute(window.location.pathname);
        sanitized.$current_url = new URL(route, window.location.origin).toString();
        sanitized.$pathname = route;
        delete sanitized.$referrer;
        delete sanitized.$referring_domain;
        delete sanitized.$ip;

        return { ...event, properties: sanitized };
      },
    });
  }

  return posthog.__loaded;
}

export function capturePublicPageView(pathname: string) {
  if (!posthog.__loaded || lastCapturedPathname === pathname) return;

  lastCapturedPathname = pathname;
  const route = normalizePublicRoute(pathname);
  posthog.capture("$pageview", {
    route,
    $current_url: new URL(route, window.location.origin).toString(),
    $pathname: route,
  });
}

export function capturePublicEvent(
  event: PublicAnalyticsEvent,
  properties: Record<string, string> = {}
) {
  if (!posthog.__loaded) return;
  const safe = Object.fromEntries(
    Object.entries(properties).filter(([key]) => allowedProperties.has(key))
  );
  posthog.capture(event, safe);
}
