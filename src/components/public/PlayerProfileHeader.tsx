"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Globe, Shirt, Trophy, type LucideIcon } from "lucide-react";
import type { PlayerProfile } from "@/lib/player-profile-types";
import { AgeUnverifiedBadge } from "@/components/public/AgeUnverifiedBadge";
import {
  PlayerProfileSectionNav,
  type PlayerProfileSectionId,
} from "@/components/public/PlayerProfileSectionNav";
import { ProfileShareButton } from "@/components/public/ProfileQuickActions";
import { StarRating } from "@/components/ui";
import { formatHeight } from "@/lib/format";
import { formatPublicRank, isPublicRankBand } from "@/lib/public-rank-display";
import { getProgramDisplayName } from "@/lib/uaap-school-display";

export const PLAYER_PROFILE_MAX_WIDTH = "max-w-[950px]";

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

function schoolName(profile: PlayerProfile) {
  if (profile.schoolOverride?.trim()) return profile.schoolOverride.trim();
  if (profile.currentTeam?.trim()) return getProgramDisplayName(profile.currentTeam);
  return null;
}

function classDisplay(classYear: string | null) {
  if (!classYear?.trim()) return null;
  if (/^class of\s+/i.test(classYear)) return classYear.trim();
  return `Class of ${classYear.trim()}`;
}

function nationalRankHeadline(rank: number | null) {
  if (rank == null) return null;
  if (isPublicRankBand(rank)) return formatPublicRank(rank);
  return `#${rank}`;
}

function ordinalRank(rank: number | null | undefined) {
  if (!rank || rank < 1) return "—";
  if (rank > 100) return formatPublicRank(rank);

  const mod100 = rank % 100;
  const mod10 = rank % 10;
  let suffix = "th";
  if (mod100 < 11 || mod100 > 13) {
    if (mod10 === 1) suffix = "st";
    else if (mod10 === 2) suffix = "nd";
    else if (mod10 === 3) suffix = "rd";
  }
  return `${rank}${suffix}`;
}

function commitmentStatusLabel(profile: PlayerProfile): string {
  if (profile.commitmentStatus === "COMMITTED") {
    return profile.committedUniversity?.trim() ? profile.committedUniversity.trim() : "Committed";
  }
  return "Undeclared";
}

const META_LABEL_CLASS = "text-[0.625rem] font-bold uppercase tracking-[0.16em] text-court-500";

function DossierPortrait({ profile }: { profile: PlayerProfile }) {
  return (
    <div className="prospect-portrait-frame relative h-full w-full">
      {profile.photoUrl ? (
        <img
          src={profile.photoUrl}
          alt=""
          className="block h-full w-full object-cover object-top"
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center font-display text-5xl font-bold text-white/10">
          {initials(profile.displayName)}
        </span>
      )}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 z-10 h-1 bg-hardwood-600" />
    </div>
  );
}

function MetaColumn({
  label,
  children,
  className = "",
  valueClassName = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <p className={META_LABEL_CLASS}>{label}</p>
      <p className={`text-sm font-bold leading-tight text-court-900 ${valueClassName}`}>{children}</p>
    </div>
  );
}

function DossierIdentity({
  profile,
  school,
  hometown,
}: {
  profile: PlayerProfile;
  school: string | null;
  hometown: string | null;
}) {
  const rankHeadline = nationalRankHeadline(profile.nationalRank);
  const classYear = classDisplay(profile.classYear);
  const position = profile.position ? positionLabel(profile.position) : null;
  const height = profile.heightCm ? formatHeight(profile.heightCm) : null;
  const status = commitmentStatusLabel(profile);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className={`flex min-w-0 flex-col ${rankHeadline ? "gap-4" : "gap-2"}`}>
        {rankHeadline ? (
          <p
            className="font-numeric text-[clamp(2.25rem,5vw,3.25rem)] font-black leading-none text-hardwood-600"
            aria-label={`National rank ${rankHeadline}`}
          >
            {rankHeadline}
          </p>
        ) : null}

        <h1 className="min-w-0 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-black uppercase leading-[0.9] tracking-tight text-court-900">
          {profile.displayName}
        </h1>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {position ? (
            <span className="rounded-sm bg-court-900 px-1.5 py-px text-[0.625rem] font-bold uppercase tracking-wide text-white">
              {position}
            </span>
          ) : null}
          {school || classYear ? (
            <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-sm leading-tight">
              {school ? (
                <span className="font-semibold text-court-700" title={school}>
                  {school}
                </span>
              ) : null}
              {school && classYear ? <span className="text-court-300">·</span> : null}
              {classYear ? <span className="whitespace-nowrap font-display text-court-500">{classYear}</span> : null}
            </span>
          ) : null}
          {profile.eligibilityVerdict ? (
            <AgeUnverifiedBadge verdict={profile.eligibilityVerdict} className="text-xs" />
          ) : null}
        </div>
      </div>

      <div className="flex min-w-0 items-start divide-x divide-[#eeeeee]">
        <MetaColumn label="Height" className="shrink-0 pr-4" valueClassName="whitespace-nowrap">
          {height ?? "—"}
        </MetaColumn>
        <MetaColumn
          label="Hometown"
          className="min-w-0 flex-1 px-4"
          valueClassName="leading-snug [overflow-wrap:anywhere]"
        >
          {hometown ?? "—"}
        </MetaColumn>
        <MetaColumn label="Status" className="shrink-0 pl-4" valueClassName="whitespace-nowrap">
          {status}
        </MetaColumn>
      </div>
    </div>
  );
}

function RankRow({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1.55fr)_4.25rem] items-center gap-x-2 py-2.5 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-center gap-2.5 pl-3">
        <Icon className="h-5 w-5 shrink-0 text-court-900" aria-hidden="true" />
        <span className={META_LABEL_CLASS}>{label}</span>
      </div>
      <div className="flex w-full flex-col items-center gap-0.5 text-center">
        <span className="font-display text-base font-extrabold tabular-nums leading-tight text-court-900">{value}</span>
        {helper ? (
          <span className="text-[0.625rem] font-medium uppercase tracking-wide text-court-500">{helper}</span>
        ) : null}
      </div>
    </div>
  );
}

function DossierRating({ profile }: { profile: PlayerProfile }) {
  const ranks = [
    {
      icon: Trophy,
      label: "National",
      value: ordinalRank(profile.nationalRank),
      helper: profile.nationalRank ? ageGroupLabel(profile.ageGroup) : "",
    },
    {
      icon: Globe,
      label: "Region",
      value: ordinalRank(profile.regionRank),
      helper: profile.regionRank ? profile.region : "",
    },
    {
      icon: Shirt,
      label: "Position",
      value: ordinalRank(profile.positionRank),
      helper: profile.positionRank && profile.position ? profile.position : "",
    },
  ].filter((row) => row.label !== "Position" || Boolean(profile.positionRank && profile.position));

  return (
    <div className="flex h-full w-full flex-col justify-between gap-3 pt-5 pb-2 pl-3 pr-4">
      <div className="text-center">
        <p
          className="font-numeric text-[clamp(2.5rem,5vw,3.5rem)] font-black italic leading-none text-hardwood-600"
          aria-label={`Overall rating ${profile.rating.toFixed(2)}`}
        >
          {profile.rating.toFixed(2)}
        </p>
        <div className="mt-1.5 flex justify-center">
          <StarRating stars={profile.starRating} />
        </div>
      </div>

      {ranks.length ? (
        <div className="divide-y divide-[#eeeeee]">
          {ranks.map(({ icon, label, value, helper }) => (
            <RankRow key={label} icon={icon} label={label} value={value} helper={helper} />
          ))}
        </div>
      ) : (
        <div aria-hidden="true" />
      )}

      <Link
        href={`/claim?player=${profile.slug}`}
        className="mb-2 inline-flex w-full justify-center rounded-md bg-court-900 px-3 py-2 text-[0.625rem] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-court-800"
      >
        Claim Profile
      </Link>
    </div>
  );
}

type PlayerProfileHeaderProps = {
  profile: PlayerProfile;
  activeTab: PlayerProfileSectionId;
  onTabChange: (id: PlayerProfileSectionId) => void;
};

export function PlayerProfileHeader({ profile, activeTab, onTabChange }: PlayerProfileHeaderProps) {
  const school = schoolName(profile);
  const hometown = profile.city?.trim() || null;

  return (
    <section className="bg-paper-500 pt-20 lg:pt-24">
      <div className="container-px pb-3">
        <article
          className={`mx-auto w-full overflow-hidden rounded-[12px] border border-line-500/80 bg-white shadow-panel ${PLAYER_PROFILE_MAX_WIDTH}`}
        >
          <div className="flex w-full min-w-0 flex-col items-stretch overflow-visible p-4 max-md:h-auto md:h-[330px] md:flex-row md:items-center md:gap-6 md:p-[15px]">
            <div className="h-[300px] w-[220px] shrink-0 overflow-hidden rounded-md max-md:aspect-[3/4] max-md:h-auto max-md:w-full">
              <DossierPortrait profile={profile} />
            </div>

            <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col justify-center self-stretch md:h-full md:pr-4">
              <ProfileShareButton
                slug={profile.slug}
                displayName={profile.displayName}
                variant="plain"
                className="absolute right-0 top-0 z-20 md:hidden"
              />
              <DossierIdentity profile={profile} school={school} hometown={hometown} />
            </div>

            <div className="relative flex w-full shrink-0 flex-col max-md:border-t max-md:border-[#eeeeee] max-md:pt-4 md:h-[330px] md:w-[270px] md:justify-center md:py-[15px]">
              <div
                aria-hidden="true"
                className="absolute left-0 top-1/2 hidden h-[65%] w-px -translate-y-1/2 bg-[#eeeeee] md:block"
              />
              <ProfileShareButton
                slug={profile.slug}
                displayName={profile.displayName}
                variant="plain"
                className="absolute left-4 top-[14%] z-20 hidden md:inline-flex"
              />
              <DossierRating profile={profile} />
            </div>
          </div>

          <PlayerProfileSectionNav
            activeId={activeTab}
            onSelect={onTabChange}
            variant="light"
            compact
          />
        </article>
      </div>
    </section>
  );
}
