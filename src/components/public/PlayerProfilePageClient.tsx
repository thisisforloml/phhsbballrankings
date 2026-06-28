"use client";

import { useState } from "react";
import type { PlayerProfile } from "@/lib/player-profile-types";
import type { GameResult } from "@/lib/mock-data";
import { RecentGames } from "@/components/sections";
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
            <div className="grid gap-3 md:gap-4">
              <RecentGames games={recentGames} recentForm={profile.recentForm} />
              <details className="border border-line-500 bg-white px-4 py-3 md:px-5">
                <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.14em] text-court-900">
                  How is this rating calculated?
                </summary>
                <p className="mt-3 max-w-4xl text-sm leading-6 text-court-700 md:text-base md:leading-7">
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
