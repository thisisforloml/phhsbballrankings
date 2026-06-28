"use client";

import Link from "next/link";
import type { PlayerProfile } from "@/lib/player-profile-types";
import { AgeUnverifiedBadge } from "@/components/public/AgeUnverifiedBadge";
import {
  PlayerProfileSectionNav,
  type PlayerProfileSectionId,
} from "@/components/public/PlayerProfileSectionNav";
import { formatHeight } from "@/lib/format";
import { formatPublicRank, isPublicRankBand } from "@/lib/public-rank-display";
import { getProgramAbbreviation, getProgramDisplayName } from "@/lib/uaap-school-display";
import { PlayerMetaPair } from "@/components/public/PlayerMetaPair";
import { StarRating } from "@/components/ui";

export const PLAYER_PROFILE_MAX_WIDTH = "max-w-6xl";

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
      value: formatPublicRank(profile.nationalRank),
      helper: profile.nationalRank ? ageGroupLabel(profile.ageGroup) : "",
      rawRank: profile.nationalRank,
    },
    {
      label: "Region Rank",
      value: formatPublicRank(profile.regionRank),
      helper: profile.regionRank ? profile.region : "",
      rawRank: profile.regionRank,
    },
    {
      label: "Position Rank",
      value: formatPublicRank(profile.positionRank),
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

  return (
    <section className="hero-brand overflow-hidden pt-28 lg:pt-32">
      <div className="container-px py-6 lg:py-8">
        <div
          className={`mx-auto grid w-full items-stretch overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-900 shadow-raised lg:grid-cols-[14.5rem_minmax(0,1fr)_20rem] ${PLAYER_PROFILE_MAX_WIDTH}`}
        >

          <div className="relative min-h-[16rem] overflow-hidden bg-court-900 lg:min-h-[22rem]">
            <span aria-hidden="true" className="absolute -right-10 top-0 h-full w-24 -skew-x-12 bg-hardwood-500/20" />
            <span aria-hidden="true" className="absolute -left-8 bottom-0 h-full w-16 -skew-x-12 bg-white/5" />
            {profile.photoUrl ? (
              <img
                src={profile.photoUrl}
                alt=""
                className="absolute inset-x-0 bottom-0 mx-auto h-full w-full object-contain object-bottom drop-shadow-[0_18px_24px_rgba(0,0,0,0.45)]"
              />
            ) : (
              <span className="absolute inset-0 grid place-items-center font-display text-7xl font-bold text-white/15 lg:text-8xl">
                {initials(profile.displayName)}
              </span>
            )}
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1.5 bg-hardwood-500" />
          </div>

          <div className="flex min-h-0 flex-col justify-center border-b border-neutral-200 px-5 py-4 md:px-6 md:py-5 lg:border-b-0 lg:border-r lg:border-neutral-200">
            <div className="border-b border-neutral-200 pb-3">
              <h1 className="break-words font-display text-[clamp(2rem,3.6vw,3.35rem)] font-extrabold uppercase leading-[1.02] tracking-tight text-neutral-900">
                {profile.displayName}
              </h1>
              {profile.eligibilityVerdict ? (
                <div className="mt-2">
                  <AgeUnverifiedBadge verdict={profile.eligibilityVerdict} className="text-xs" />
                </div>
              ) : null}
            </div>

            <div className="mt-3 w-full rounded-md border border-neutral-100 bg-neutral-50/70 px-4 py-3">
              <div className="grid w-full grid-cols-2 gap-x-6 gap-y-3 lg:gap-x-10">
                {profile.heightCm ? <PlayerMetaPair label="Height" value={formatHeight(profile.heightCm)} /> : null}
                {school ? <PlayerMetaPair label="School" value={school} accent /> : null}
                {classValue ? <PlayerMetaPair label="Class" value={classValue} /> : null}
                {hometown ? <PlayerMetaPair label="Home town" value={hometown} /> : null}
                {profile.position ? <PlayerMetaPair label="Position" value={positionLabel(profile.position)} /> : null}
                <PlayerMetaPair label="Status" value={profileStatus(profile)} />
              </div>
            </div>
          </div>

          <aside className="flex min-h-0 flex-col justify-center gap-4 p-4 md:p-5 lg:justify-between lg:py-5">
            <div>
              <div
                className="rounded-lg border border-hardwood-200/80 bg-gradient-to-br from-accent-50 via-white to-white px-4 py-3 text-center"
                aria-label={`Player rating ${profile.rating.toFixed(2)}, ${profile.starRating} stars`}
              >
                <p
                  className={`font-display text-[clamp(2.75rem,4vw,3.75rem)] font-extrabold leading-none ${
                    profile.rating >= 95 ? "text-hardwood-600" : "text-court-900"
                  }`}
                >
                  {profile.rating.toFixed(2)}
                </p>
                <div className="mt-1.5 flex justify-center">
                  <StarRating stars={profile.starRating} />
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                {ranks.map(({ label, value, helper, rawRank }) => (
                  <div
                    key={label}
                    className="grid grid-cols-[7.25rem_1fr] items-center gap-3 border-b border-neutral-100 pb-2.5 last:border-b-0 last:pb-0"
                  >
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-400">{label}</span>
                    <strong
                      className={`flex items-baseline gap-2 font-bold leading-none text-neutral-900 ${
                        isPublicRankBand(rawRank) ? "text-xl tracking-tight" : "text-stat-sm"
                      }`}
                    >
                      {value}
                      {helper ? (
                        <small className="text-sm font-semibold uppercase tracking-[0.06em] text-neutral-400">{helper}</small>
                      ) : null}
                    </strong>
                  </div>
                ))}
              </div>
            </div>

            <Link href={`/claim?player=${profile.slug}`} className="button primary w-full shrink-0">
              Claim Profile
            </Link>
          </aside>

          <div className="col-span-full">
            <PlayerProfileSectionNav activeId={activeTab} onSelect={onTabChange} />
          </div>
        </div>
      </div>
    </section>
  );
}
