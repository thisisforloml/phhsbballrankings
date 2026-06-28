"use client";

import type { PlayerProfile } from "@/lib/player-profile-types";
import { buildPositivesOnlyScoutingReport } from "@/lib/scouting-report";
import { ProfileModule } from "@/components/public/ProfileModule";
import { HorizontalBarChart } from "@/components/public/charts/ProfileCharts";
import { PlayerTrendsChart } from "@/components/public/charts/PlayerTrendsChart";

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
      description="Player trends with adjustable rolling averages"
    >
      <PlayerTrendsChart profile={profile} />
    </ProfileModule>
  );
}

// ── Scouting report ───────────────────────────────────────────────────────────

export function PlayerScoutingReport({ profile }: { profile: PlayerProfile }) {
  const report = buildPositivesOnlyScoutingReport(profile);
  return (
    <ProfileModule id="scouting" title="Scouting Report" bodyClassName="p-0">
      <article className="bg-paper-500/45 px-4 py-4 md:px-5 md:py-5">
        <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-hardwood-600">{report.headline}</p>
        <p className="mt-3 w-full text-[0.98rem] font-medium leading-7 text-court-800 md:text-base md:leading-8">
          {report.summary}
        </p>
        {report.limitedSample && (
          <p className="mt-3 text-sm font-semibold text-court-500">
            More games are needed before a full board comparison can be written.
          </p>
        )}
        {report.footnotes.length > 0 && (
          <p className="mt-4 border-t border-line-500/80 pt-3 text-[0.68rem] font-semibold leading-5 text-court-400">
            {report.footnotes.join(" · ")}
          </p>
        )}
      </article>
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
