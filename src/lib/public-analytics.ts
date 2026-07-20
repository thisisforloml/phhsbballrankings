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
  if (typeof window === "undefined" || !analyticsConfigured() || doNotTrackEnabled() || posthog.__loaded) {
    return false;
  }

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
    sanitize_properties(properties) {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(properties)) {
        if (key.startsWith("$") || allowedProperties.has(key)) sanitized[key] = value;
      }
      delete sanitized.$current_url;
      delete sanitized.$pathname;
      delete sanitized.$referrer;
      delete sanitized.$referring_domain;
      delete sanitized.$ip;
      return sanitized;
    },
  });
  return true;
}

export function capturePublicPageView(pathname: string) {
  if (!posthog.__loaded) return;
  posthog.capture("$pageview", { route: normalizePublicRoute(pathname) });
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
