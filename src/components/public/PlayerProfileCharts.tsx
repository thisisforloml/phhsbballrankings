"use client";

import { PlayerPercentileRadar } from "@/components/public/charts/PlayerPercentileRadar";
import { PlayerStatRelationshipsChart } from "@/components/public/charts/PlayerStatRelationshipsChart";
import { PlayerTrendsChart } from "@/components/public/charts/PlayerTrendsChart";
import { HorizontalBarChart } from "@/components/public/charts/ProfileCharts";
import { ProfileModule } from "@/components/public/ProfileModule";
import type { PlayerProfile } from "@/lib/player-profile-types";

// ── Main performance dashboard ────────────────────────────────────────────────

export function PlayerPerformanceDashboard({ profile }: { profile: PlayerProfile }) {
  if (profile.allGames.length < 2) {
    return (
      <ProfileModule
        id="analytics"
        title="Performance Analytics"
        description="Player trends with adjustable rolling averages"
      >
        <p className="text-sm font-semibold text-court-500">Need at least 2 verified games to chart player trends.</p>
      </ProfileModule>
    );
  }

  return (
    <ProfileModule
      id="analytics"
      title="Performance Analytics"
      description="Trends, board context, percentile profile, and stat relationships"
    >
      <div className="grid gap-8">
        <PlayerPercentileRadar profile={profile} />

        <PlayerTrendsChart profile={profile} />
        <PlayerStatRelationshipsChart profile={profile} />
      </div>
    </ProfileModule>
  );
}

// ── Scouting report (temporarily hidden from profile tab) ─────────────────────

export function PlayerScoutingReport({ profile: _profile }: { profile: PlayerProfile }) {
  return (
    <ProfileModule id="scouting" title="Scouting">
      <p className="text-sm font-semibold text-court-500">Scouting report coming soon.</p>
    </ProfileModule>
  );
}

// ── League split (kept for PlayerCompetitionModule to consume) ────────────────

export function PlayerLeagueSplitChart({ profile }: { profile: PlayerProfile }) {
  if (profile.leagues.length < 2) return null;
  const rows = profile.leagues.map((league) => ({
    label: `${league.leagueName} (${league.gamesPlayed} GP)`,
    value: league.avgPoints,
    detail: `${league.avgRebounds.toFixed(1)} RPG · ${league.avgAssists.toFixed(1)} APG`,
  }));
  return (
    <ProfileModule title="Competition Scoring Split">
      <HorizontalBarChart ariaLabel="Average points per game by competition" rows={rows} />
    </ProfileModule>
  );
}
