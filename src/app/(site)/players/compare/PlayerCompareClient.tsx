"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { RadarChart } from "@/components/public/charts/ProfileCharts";
import { ProfileModule } from "@/components/public/ProfileModule";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { StarRating } from "@/components/ui";
import { metricHelp } from "@/lib/metric-explanations";
import type { PlayerProfile } from "@/lib/player-profile-types";
import { formatPublicRank } from "@/lib/public-rank-display";
import { buildPositivesOnlyScoutingReport } from "@/lib/scouting-report";

type SearchPlayer = {
  type: "Player";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

async function fetchProfile(slug: string): Promise<PlayerProfile | null> {
  const res = await fetch(`/api/players/${encodeURIComponent(slug)}/profile`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { profile: PlayerProfile };
  return data.profile;
}

async function searchPlayers(query: string): Promise<SearchPlayer[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { results: SearchPlayer[] };
  return data.results.filter((r) => r.type === "Player");
}

function PlayerPicker({ label, slug, onSelect }: { label: string; slug: string; onSelect: (slug: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchPlayer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      setLoading(true);
      setResults(await searchPlayers(query.trim()));
      setLoading(false);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query]);

  return (
    <div className="border border-line-500 bg-white p-3">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-court-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-court-700">Current: {slug || "—"}</p>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search player name"
        className="mt-2 w-full border border-line-500 px-3 py-2 text-sm font-semibold outline-none focus:border-hardwood-600"
      />
      {loading ? <p className="mt-2 text-xs text-court-500">Searching…</p> : null}
      <ul className="mt-2 grid gap-1">
        {results.map((row) => (
          <li key={row.id}>
            <button type="button" onClick={() => onSelect(row.href.replace("/players/", ""))} className="w-full border border-line-500 bg-paper-500 px-2 py-2 text-left text-sm hover:border-hardwood-600">
              <strong className="block font-black text-court-900">{row.title}</strong>
              <span className="text-xs text-court-500">{row.subtitle}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CompareColumn({ profile }: { profile: PlayerProfile }) {
  const report = buildPositivesOnlyScoutingReport(profile);
  const radar = profile.intelligence.percentiles
    .filter((p) => p.percentile !== null)
    .map((p) => ({ label: p.label, value: p.percentile ?? 0 }));

  return (
    <div className="grid gap-3">
      <div className="border border-line-500 bg-white p-4">
        <h2 className="font-display text-2xl font-black text-court-900">{profile.displayName}</h2>
        <p className="text-sm font-semibold text-court-500">{profile.currentTeam}</p>
        <p className="mt-2 font-display text-3xl font-black text-hardwood-600">{profile.rating.toFixed(2)}</p>
        <StarRating stars={profile.starRating} />
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.1em] text-court-500">
          {formatPublicRank(profile.nationalRank)} national · {profile.verifiedGameCount} GP
        </p>
        <Link href={`/players/${profile.slug}`} className="button mt-3 inline-block px-3 py-2 text-sm">Open profile</Link>
      </div>
      <ProfileModule title="Core averages">
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div><strong className="block text-xl font-black">{profile.ppg.toFixed(1)}</strong><span className="text-xs text-court-500">PPG</span></div>
          <div><strong className="block text-xl font-black">{profile.rpg.toFixed(1)}</strong><span className="text-xs text-court-500">RPG</span></div>
          <div><strong className="block text-xl font-black">{profile.apg.toFixed(1)}</strong><span className="text-xs text-court-500">APG</span></div>
        </div>
      </ProfileModule>
      {radar.length >= 3 ? (
        <ProfileModule title="Percentile radar" description={metricHelp("compare")}>
          <RadarChart points={radar} ariaLabel={`${profile.displayName} percentile radar`} />
        </ProfileModule>
      ) : null}
      <ProfileModule title="Strengths">
        <p className="text-sm font-semibold leading-6 text-court-800">{report.summary}</p>
      </ProfileModule>
    </div>
  );
}

export function PlayerCompareClient() {
  const searchParams = useSearchParams();
  const initialA = searchParams.get("a") ?? "";
  const initialB = searchParams.get("b") ?? "";
  const [slugA, setSlugA] = useState(initialA);
  const [slugB, setSlugB] = useState(initialB);
  const [profileA, setProfileA] = useState<PlayerProfile | null>(null);
  const [profileB, setProfileB] = useState<PlayerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [a, b] = await Promise.all([
      slugA ? fetchProfile(slugA) : Promise.resolve(null),
      slugB ? fetchProfile(slugB) : Promise.resolve(null)
    ]);
    setProfileA(a);
    setProfileB(b);
    if (slugA && slugB) {
      if (!a || !b) setError("One or both players could not be loaded.");
      else if (a.ageGroup !== b.ageGroup || a.gender !== b.gender) setError("Compare players in the same age group and gender for a fair view.");
    }
  }, [slugA, slugB]);

  useEffect(() => {
    void load();
  }, [load]);

  const canCompare = useMemo(() => profileA && profileB && profileA.ageGroup === profileB.ageGroup && profileA.gender === profileB.gender, [profileA, profileB]);

  return (
    <PublicPageShell>
      <section className="container-px py-8">
        <h1 className="font-display text-3xl font-black text-court-900">Compare Players</h1>
        <p className="mt-2 max-w-3xl text-sm font-semibold text-court-600">{metricHelp("compare")}</p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <PlayerPicker label="Player A" slug={slugA} onSelect={setSlugA} />
          <PlayerPicker label="Player B" slug={slugB} onSelect={setSlugB} />
        </div>
        {error ? <p className="mt-4 border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{error}</p> : null}
        {canCompare ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <CompareColumn profile={profileA!} />
            <CompareColumn profile={profileB!} />
          </div>
        ) : null}
      </section>
    </PublicPageShell>
  );
}
