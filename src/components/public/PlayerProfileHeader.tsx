"use client";

import Link from "next/link";
import type { PlayerProfile } from "@/lib/player-profile-types";
import { AgeUnverifiedBadge } from "@/components/public/AgeUnverifiedBadge";
import {
  PlayerProfileSectionNav,
  type PlayerProfileSectionId,
} from "@/components/public/PlayerProfileSectionNav";
import { formatHeight } from "@/lib/format";
import { formatBoardRank, isPublicRankBand } from "@/lib/public-rank-display";
import { getProgramAbbreviation, getProgramDisplayName } from "@/lib/uaap-school-display";
import { ProfileQuickActions } from "@/components/public/ProfileQuickActions";
import { ScoutRankChange } from "@/components/public/ScoutRankChange";
import { StarRating } from "@/components/ui";

export const PLAYER_PROFILE_MAX_WIDTH = "max-w-[74rem]";

const POSITION_LABELS: Record<string, string> = {
  C: "Center",
  PF: "Power Forward",
  SF: "Small Forward",
  SG: "Shooting Guard",
  PG: "Point Guard",
  G: "Guard",
  F: "Forward",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function positionLabel(position: string) {
  const key = position.trim().toUpperCase();
  return POSITION_LABELS[key] ?? position;
}

function ageGroupLabel(ageGroup: PlayerProfile["ageGroup"]) {
  return ageGroup.replace(/^U/, "") + "U";
}

function schoolFullName(profile: PlayerProfile) {
  if (profile.schoolOverride?.trim()) return profile.schoolOverride.trim();
  if (profile.currentTeam?.trim()) return getProgramDisplayName(profile.currentTeam);
  return null;
}

function profileStatus(profile: PlayerProfile) {
  if (!profile.currentTeam?.trim()) return "Not listed";
  const abbrev = getProgramAbbreviation(profile.currentTeam);
  if (profile.nationalRank) return `Ranked · ${abbrev}`;
  return `Listed · ${abbrev}`;
}

function rankRows(profile: PlayerProfile) {
  return [
    {
      label: "National Rank",
      value: formatBoardRank(profile.nationalRank),
      helper: profile.nationalRank ? ageGroupLabel(profile.ageGroup) : "",
      rawRank: profile.nationalRank,
    },
    {
      label: "Region Rank",
      value: formatBoardRank(profile.regionRank),
      helper: profile.regionRank ? profile.region : "",
      rawRank: profile.regionRank,
    },
    {
      label: "Position Rank",
      value: formatBoardRank(profile.positionRank),
      helper: profile.positionRank && profile.position ? profile.position : "",
      rawRank: profile.positionRank,
    },
  ].filter((row) => row.label !== "Position Rank" || Boolean(profile.positionRank && profile.position));
}

type PlayerProfileHeaderProps = {
  profile: PlayerProfile;
  activeTab: PlayerProfileSectionId;
  onTabChange: (id: PlayerProfileSectionId) => void;
};

export function PlayerProfileHeader({ profile, activeTab, onTabChange }: PlayerProfileHeaderProps) {
  const ranks = rankRows(profile);
  const school = schoolFullName(profile);
  const classValue = profile.classYear?.replace(/^Class of\s+/i, "") ?? null;
  const hometown = profile.city?.trim() || null;
  const trendDelta = profile.rankingTrend[0]?.movement ?? 0;

  const statStrip = [
    { label: "PPG", value: profile.ppg.toFixed(1) },
    { label: "RPG", value: profile.rpg.toFixed(1) },
    { label: "APG", value: profile.apg.toFixed(1) },
    { label: "GP", value: String(profile.verifiedGameCount) },
    { label: "TS%", value: profile.shooting.trueShootingPct != null ? `${profile.shooting.trueShootingPct.toFixed(1)}%` : "—" },
  ];

  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-scout-900 pt-24 text-scout-50 lg:pt-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top_left,rgba(212,114,13,0.1),transparent_60%)]"
      />
      <div className="container-px relative py-6 lg:py-8">
        <div className={`mx-auto ${PLAYER_PROFILE_MAX_WIDTH}`}>
          <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[7rem_minmax(0,1fr)_auto] lg:grid-cols-[9rem_minmax(0,1fr)_14rem] lg:gap-8">
            <div className="prospect-portrait-frame relative mx-auto aspect-[3/4] w-28 overflow-hidden rounded-sm border border-white/10 md:mx-0 md:w-full md:max-w-[9rem]">
              {profile.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  alt=""
                  className="absolute inset-x-0 bottom-0 z-[1] h-[92%] w-full object-contain object-bottom"
                />
              ) : (
                <span className="absolute inset-0 grid place-items-center font-display text-5xl font-bold text-white/10">
                  {initials(profile.displayName)}
                </span>
              )}
            </div>

            <div>
              {profile.nationalRank ? (
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className="font-numeric text-5xl font-normal leading-none text-scout-orange-bright md:text-6xl">
                    {formatBoardRank(profile.nationalRank)}
                  </span>
                  <div>
                    <div className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-scout-500">National Rank</div>
                    <ScoutRankChange delta={trendDelta} />
                  </div>
                </div>
              ) : null}

              <h1 className="font-display text-[clamp(2rem,4vw,3.25rem)] font-bold uppercase leading-[1.02] tracking-tight text-white">
                {profile.displayName}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-scout-500">
                {profile.position ? (
                  <span className="rounded-sm border border-white/10 bg-scout-800 px-2 py-0.5 text-xs font-bold uppercase tracking-[0.08em] text-scout-50">
                    {positionLabel(profile.position)}
                  </span>
                ) : null}
                {school ? <span>{school}</span> : null}
                {classValue ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Class of {classValue}</span>
                  </>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-scout-500">
                {profile.heightCm ? <span>HT {formatHeight(profile.heightCm)}</span> : null}
                {hometown ? <span>{hometown}</span> : null}
                <span>{profileStatus(profile)}</span>
              </div>

              {profile.eligibilityVerdict ? (
                <div className="mt-3">
                  <AgeUnverifiedBadge verdict={profile.eligibilityVerdict} className="text-xs" />
                </div>
              ) : null}
            </div>

            <aside className="flex flex-col gap-4 md:items-end md:text-right">
              <div
                className="w-full rounded-sm border border-white/10 bg-scout-800/80 px-4 py-3 text-center md:max-w-[14rem]"
                aria-label={`Player rating ${profile.rating.toFixed(2)}, ${profile.starRating} stars`}
              >
                <p className="font-numeric text-[clamp(2.5rem,4vw,3.5rem)] font-normal italic leading-none text-white">
                  {profile.rating.toFixed(2)}
                </p>
                <div className="mt-1.5 flex justify-center md:justify-end">
                  <StarRating stars={profile.starRating} />
                </div>
              </div>

              <div className="grid w-full gap-2 md:max-w-[14rem]">
                {ranks.map(({ label, value, helper, rawRank }) => (
                  <div
                    key={label}
                    className="grid grid-cols-[6.5rem_1fr] items-center gap-2 border-b border-white/[0.06] pb-2 last:border-b-0 last:pb-0"
                  >
                    <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-scout-500">{label}</span>
                    <strong
                      className={`flex items-baseline justify-end gap-2 font-numeric leading-none text-scout-50 ${
                        isPublicRankBand(rawRank) ? "text-base" : "text-xl"
                      }`}
                    >
                      {value}
                      {helper ? (
                        <small className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-scout-500">{helper}</small>
                      ) : null}
                    </strong>
                  </div>
                ))}
              </div>

              <ProfileQuickActions slug={profile.slug} displayName={profile.displayName} />
              <Link
                href={`/claim?player=${profile.slug}`}
                className="inline-flex w-full justify-center rounded-sm bg-scout-orange px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-white transition hover:bg-scout-orange-bright md:max-w-[14rem]"
              >
                Claim Profile
              </Link>
            </aside>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-white/[0.08] bg-white/[0.08] sm:grid-cols-5">
            {statStrip.map(({ label, value }) => (
              <div key={label} className="bg-scout-800 px-3 py-3 text-center sm:px-4 sm:py-4">
                <div className="font-numeric text-xl font-normal leading-none text-scout-50 md:text-2xl">{value}</div>
                <div className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-scout-500">{label}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 overflow-hidden rounded-sm border border-white/[0.08]">
            <PlayerProfileSectionNav activeId={activeTab} onSelect={onTabChange} />
          </div>
        </div>
      </div>
    </section>
  );
}
