"use client";

import { useState } from "react";

import { HighlightsPlaceholder } from "@/components/public/HighlightsPlaceholder";
import {
  PlayerCompetitionModule,
  PlayerFullGameLog,
  PlayerRankingTrend,
  PlayerSeasonProduction,
} from "@/components/public/PlayerAnalytics";
import {
  PlayerPerformanceDashboard,
  PlayerScoutingReport,
} from "@/components/public/PlayerProfileCharts";
import { PLAYER_PROFILE_MAX_WIDTH,PlayerProfileHeader } from "@/components/public/PlayerProfileHeader";
import type { PlayerProfileSectionId } from "@/components/public/PlayerProfileSectionNav";
import { RecentGames } from "@/components/sections";
import type { GameResult } from "@/lib/mock-data";
import type { PlayerProfile } from "@/lib/player-profile-types";

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

  if (!intelligence.strengthBadges.length) return null;

  return (
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

      <section className="bg-paper-500 pb-10 pt-3" aria-live="polite">
        <div className="container-px">
          <div className={`mx-auto w-full ${PLAYER_PROFILE_MAX_WIDTH}`}>
            <div
              id={`panel-${activeTab}`}
              role="tabpanel"
              aria-labelledby={`tab-${activeTab}`}
              className="min-h-[12rem] w-full"
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
          </div>
        </div>
      </section>
    </>
  );
}
