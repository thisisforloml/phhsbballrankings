"use client";

import { useState } from "react";
import type { PlayerProfile } from "@/lib/player-profile-types";
import type { GameResult } from "@/lib/mock-data";
import { RecentGames } from "@/components/sections";
import { HighlightsPlaceholder } from "@/components/public/HighlightsPlaceholder";
import {
  PlayerFullGameLog,
  PlayerRankingTrend,
  PlayerSeasonProduction,
  PlayerCompetitionModule,
} from "@/components/public/PlayerAnalytics";
import {
  PlayerPerformanceDashboard,
  PlayerScoutingReport,
} from "@/components/public/PlayerProfileCharts";
import { PlayerProfileHeader, PLAYER_PROFILE_MAX_WIDTH } from "@/components/public/PlayerProfileHeader";
import type { PlayerProfileSectionId } from "@/components/public/PlayerProfileSectionNav";
import { ScoutSectionLabel } from "@/components/public/ScoutSectionLabel";
import { PercentileBarList } from "@/components/public/charts/ProfileCharts";

function PlayerOverviewIntelligence({ profile }: { profile: PlayerProfile }) {
  const { intelligence } = profile;
  const percentileItems = intelligence.percentiles
    .filter((item) => item.key !== "sample")
    .map((item) => ({
      key: item.key,
      label: item.label,
      percentile: item.percentile,
      detail: item.comparisonCount > 0 ? `vs ${item.comparisonCount} board peers` : "Limited sample",
    }));

  if (!percentileItems.length && !intelligence.strengthBadges.length) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {percentileItems.length ? (
        <article className="rounded-sm border border-white/[0.08] bg-scout-800/80 p-4 md:p-5">
          <ScoutSectionLabel>Percentile Rankings</ScoutSectionLabel>
          <p className="mt-2 text-sm font-semibold text-scout-500">{intelligence.roleArchetype.label}</p>
          <div className="mt-4 [&_strong]:text-scout-orange-bright [&_span]:text-scout-50 [&_.text-court-500]:text-scout-500 [&_.text-court-900]:text-scout-50 [&_.bg-line-500]:bg-scout-700">
            <PercentileBarList items={percentileItems} ariaLabel="Board percentile rankings" />
          </div>
        </article>
      ) : null}

      {intelligence.strengthBadges.length ? (
        <article className="rounded-sm border border-white/[0.08] bg-scout-800/80 p-4 md:p-5">
          <ScoutSectionLabel>Scouting Strengths</ScoutSectionLabel>
          <ul className="mt-4 space-y-2.5">
            {intelligence.strengthBadges.map((badge) => (
              <li key={badge.label} className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-scout-orange" />
                <span>
                  <strong className="block text-sm font-bold text-scout-50">{badge.label}</strong>
                  <span className="text-xs font-medium text-scout-500">{badge.reason}</span>
                </span>
              </li>
            ))}
          </ul>
        </article>
      ) : null}
    </div>
  );
}

type PlayerProfilePageClientProps = {
  profile: PlayerProfile;
  recentGames: GameResult[];
};

export function PlayerProfilePageClient({ profile, recentGames }: PlayerProfilePageClientProps) {
  const [activeTab, setActiveTab] = useState<PlayerProfileSectionId>("recent-form");

  return (
    <>
      <PlayerProfileHeader profile={profile} activeTab={activeTab} onTabChange={setActiveTab} />

      <section
        className={`container-px mx-auto w-full ${PLAYER_PROFILE_MAX_WIDTH} py-5 pb-12 md:py-6`}
        aria-live="polite"
      >
        <div
          id={`panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
          className="min-h-[12rem]"
        >
          {activeTab === "recent-form" && (
            <div className="grid gap-4 md:gap-5">
              <PlayerOverviewIntelligence profile={profile} />
              <RecentGames games={recentGames} recentForm={profile.recentForm} />
              <HighlightsPlaceholder />
              <details className="rounded-sm border border-white/[0.08] bg-scout-800/80 px-4 py-3 md:px-5">
                <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.14em] text-scout-orange-bright">
                  How is this rating calculated?
                </summary>
                <p className="mt-3 max-w-4xl text-sm leading-6 text-scout-500 md:text-base md:leading-7">
                  Your Peach Basket rating is built from verified box scores. Each game gets a performance score measured
                  against other players in the same competition, and those scores are averaged into the rating on this
                  profile. To appear on the public rankings board, U19 boys need at least 10 verified games and U19
                  girls need at least 5.
                </p>
              </details>
            </div>
          )}

          {activeTab === "analytics" && <PlayerPerformanceDashboard profile={profile} />}
          {activeTab === "scouting" && <PlayerScoutingReport profile={profile} />}
          {activeTab === "production" && <PlayerSeasonProduction profile={profile} />}
          {activeTab === "competition" && (
            <div className="grid gap-3 md:gap-4">
              <PlayerCompetitionModule profile={profile} participation={profile.competitionParticipation} />
              <PlayerRankingTrend profile={profile} />
            </div>
          )}
          {activeTab === "game-log" && <PlayerFullGameLog profile={profile} />}
        </div>
      </section>
    </>
  );
}
