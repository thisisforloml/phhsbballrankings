"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { RadarChart, type RadarPoint } from "@/components/public/charts/ProfileCharts";
import { metricHelp } from "@/lib/metric-explanations";
import type { PlayerProfile, PlayerProfilePercentile } from "@/lib/player-profile-types";

type SearchPlayer = {
  type: "Player";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

function percentileDetail(item: PlayerProfilePercentile) {
  return `${item.value} ${item.key === "accuracy" ? "% TS" : item.key === "efficiency" ? "box impact" : "per game"}`;
}

function buildRadarPoints(percentiles: PlayerProfilePercentile[]): RadarPoint[] {
  return percentiles
    .filter((item) => item.key !== "sample" && item.percentile !== null)
    .map((item) => ({
      label: item.label,
      value: item.percentile ?? 0,
      detail: percentileDetail(item),
    }));
}

function alignComparePoints(primaryPercentiles: PlayerProfilePercentile[], comparePercentiles: PlayerProfilePercentile[]): RadarPoint[] {
  const compareByKey = new Map(
    comparePercentiles
      .filter((item) => item.key !== "sample" && item.percentile !== null)
      .map((item) => [item.key, item])
  );

  return primaryPercentiles
    .filter((item) => item.key !== "sample" && item.percentile !== null)
    .map((primary) => {
      const compare = compareByKey.get(primary.key);
      return {
        label: primary.label,
        value: compare?.percentile ?? 0,
        detail: compare ? percentileDetail(compare) : undefined,
      };
    });
}

async function fetchProfile(playerKey: string): Promise<PlayerProfile | null> {
  const res = await fetch(`/api/players/${encodeURIComponent(playerKey)}/profile`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { profile: PlayerProfile };
  return data.profile;
}

async function searchPlayers(query: string): Promise<SearchPlayer[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=8`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { results: SearchPlayer[] };
  return data.results.filter((row) => row.type === "Player").slice(0, 8);
}

type Props = {
  profile: PlayerProfile;
};

export function PlayerPercentileRadar({ profile }: Props) {
  const radar = useMemo(() => buildRadarPoints(profile.intelligence.percentiles), [profile.intelligence.percentiles]);

  const [compareOpen, setCompareOpen] = useState(false);
  const [compareQuery, setCompareQuery] = useState("");
  const [compareResults, setCompareResults] = useState<SearchPlayer[]>([]);
  const [compareSearching, setCompareSearching] = useState(false);
  const [compareLoadingProfile, setCompareLoadingProfile] = useState(false);
  const [compareProfile, setCompareProfile] = useState<PlayerProfile | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);

  const compareRadar = useMemo(() => {
    if (!compareProfile) return undefined;
    return alignComparePoints(profile.intelligence.percentiles, compareProfile.intelligence.percentiles);
  }, [compareProfile, profile.intelligence.percentiles]);

  useEffect(() => {
    const query = compareQuery.trim();
    if (query.length < 2) {
      setCompareResults([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      setCompareSearching(true);
      try {
        setCompareResults(await searchPlayers(query));
      } finally {
        setCompareSearching(false);
      }
    }, 120);
    return () => window.clearTimeout(handle);
  }, [compareQuery]);

  const loadComparePlayer = useCallback(async (playerKey: string) => {
    setCompareError(null);
    setCompareLoadingProfile(true);
    try {
      const loaded = await fetchProfile(playerKey);
      if (!loaded) {
        setCompareError("Could not load that player.");
        setCompareProfile(null);
        return;
      }
      if (loaded.id === profile.id) {
        setCompareError("Pick a different player than the one on this profile.");
        setCompareProfile(null);
        return;
      }
      if (loaded.ageGroup !== profile.ageGroup || loaded.gender !== profile.gender) {
        setCompareError("Compare players in the same age group and gender.");
        setCompareProfile(null);
        return;
      }
      setCompareProfile(loaded);
      setCompareQuery("");
      setCompareResults([]);
    } finally {
      setCompareLoadingProfile(false);
    }
  }, [profile.ageGroup, profile.gender, profile.id]);

  if (radar.length < 3) return null;

  return (
    <section>
      <div className="flex flex-nowrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xs font-black uppercase tracking-[0.12em] text-hardwood-600">Percentile radar</h3>
          <p className="mt-1 text-[0.68rem] font-semibold text-court-500">{metricHelp("radar")}</p>
        </div>
        <button
          type="button"
          onClick={() => setCompareOpen((open) => !open)}
          className={`border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.08em] transition ${
            compareOpen || compareProfile
              ? "border-hardwood-600 bg-hardwood-600 text-white"
              : "border-line-500 bg-white text-court-700 hover:border-hardwood-600"
          }`}
        >
          {compareProfile ? `Comparing · ${compareProfile.displayName}` : "Compare player"}
        </button>
      </div>

      {compareOpen ? (
        <div className="mt-3">
          <input
            value={compareQuery}
            onChange={(event) => setCompareQuery(event.target.value)}
            placeholder="Search by name"
            aria-label="Search player to compare on percentile radar"
            className="w-full border border-line-500 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-hardwood-600"
          />
          {compareSearching || compareLoadingProfile ? (
            <p className="mt-2 text-xs text-court-500">{compareLoadingProfile ? "Loading player…" : "Searching…"}</p>
          ) : null}
          {compareError ? <p className="mt-2 text-xs font-semibold text-amber-800">{compareError}</p> : null}
          <ul className="mt-2 divide-y divide-line-500">
            {compareResults.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  disabled={compareLoadingProfile}
                  onClick={() => void loadComparePlayer(row.id)}
                  className="w-full px-1 py-2 text-left text-sm hover:bg-paper-500/80 disabled:opacity-60"
                >
                  <strong className="block font-bold text-court-900">{row.title}</strong>
                  <span className="text-xs text-court-500">{row.subtitle}</span>
                </button>
              </li>
            ))}
          </ul>
          {compareProfile ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-court-600">
                Dashed blue = <strong>{compareProfile.displayName}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setCompareProfile(null);
                  setCompareError(null);
                }}
                className="text-[0.62rem] font-bold uppercase tracking-[0.08em] text-court-500 hover:text-hardwood-600"
              >
                Clear
              </button>
              <Link
                href={`/players/compare?a=${profile.slug}&b=${compareProfile.slug}`}
                className="text-[0.62rem] font-bold uppercase tracking-[0.08em] text-hardwood-600 hover:underline"
              >
                Full compare →
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4">
        <RadarChart
          points={radar}
          comparePoints={compareRadar}
          compareLabel={compareProfile?.displayName}
          ariaLabel={`${profile.displayName} percentile radar`}
        />
      </div>

      {compareProfile ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5 text-[0.68rem] font-semibold text-court-600">
            <span className="inline-block h-[3px] w-4 bg-hardwood-600" />
            {profile.displayName}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[0.68rem] font-semibold text-court-600">
            <span className="inline-block h-0 w-4 border-t-2 border-dashed border-[#1d4ed8]" />
            {compareProfile.displayName}
          </span>
        </div>
      ) : null}
    </section>
  );
}
