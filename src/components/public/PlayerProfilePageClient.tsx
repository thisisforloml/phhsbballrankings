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
import { PercentileBarList } from "@/components/public/charts/ProfileCharts";

const PROFILE_PANEL = "overflow-hidden rounded-md border border-line-500 bg-white shadow-sm";

function ProfileSectionLabel({ children }: { children: string }) {
  return (
    <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-hardwood-600">
      <span aria-hidden="true" className="inline-block h-4 w-1 rounded-full bg-hardwood-600" />
      {children}
    </h2>
  );
}

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
        <article className={`${PROFILE_PANEL} p-4 md:p-5`}>
          <ProfileSectionLabel>Percentile Rankings</ProfileSectionLabel>
          <p className="mt-2 text-sm font-semibold text-court-500">{intelligence.roleArchetype.label}</p>
          <div className="mt-4">
            <PercentileBarList items={percentileItems} ariaLabel="Board percentile rankings" />
          </div>
        </article>
      ) : null}

      {intelligence.strengthBadges.length ? (
        <article className={`${PROFILE_PANEL} p-4 md:p-5`}>
          <ProfileSectionLabel>Scouting Strengths</ProfileSectionLabel>
          <ul className="mt-4 space-y-2.5">
            {intelligence.strengthBadges.map((badge) => (
              <li key={badge.label} className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-hardwood-600" />
                <span>
                  <strong className="block text-sm font-bold text-court-900">{badge.label}</strong>
                  <span className="text-xs font-medium text-court-500">{badge.reason}</span>
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
        className={`container-px mx-auto w-full bg-paper-500 ${PLAYER_PROFILE_MAX_WIDTH} pb-10 pt-3`}
        aria-live="polite"
      >
        <div
          id={`panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
          className="min-h-[12rem]"
        >
          {activeTab === "recent-form" && (
            <div className="grid gap-3 md:gap-4">
              <PlayerOverviewIntelligence profile={profile} />
              <RecentGames games={recentGames} recentForm={profile.recentForm} />
              <HighlightsPlaceholder />
              <details className={`${PROFILE_PANEL} px-4 py-3 md:px-5`}>
                <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.14em] text-hardwood-600">
                  How is this rating calculated?
                </summary>
                <p className="mt-3 max-w-4xl text-sm leading-6 text-court-600 md:text-base md:leading-7">
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
