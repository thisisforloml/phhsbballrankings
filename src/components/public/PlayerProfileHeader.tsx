import Link from "next/link";
import type { PlayerProfile } from "@/lib/player-profile";
import { formatHeight } from "@/lib/format";
import { RatingBadge, StarRating, VerifiedBadge } from "@/components/ui";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function rankText(value: number | null) {
  return value ? `#${value}` : "Unavailable";
}

function profileMeta(profile: PlayerProfile) {
  return [
    ["School / Program", profile.currentTeam],
    ["Class Year", profile.classYear ?? "Not on record"],
    ["Position", profile.position ?? "Not listed"],
    ["Height", formatHeight(profile.heightCm)]
  ];
}

function rankCards(profile: PlayerProfile) {
  return [
    ["National Rank", rankText(profile.nationalRank), profile.nationalRank ? "Current public board" : "Not enough public data"],
    ["Region Rank", rankText(profile.regionRank), profile.regionRank ? profile.region : "Region rank unavailable"],
    ["Position Rank", rankText(profile.positionRank), profile.positionRank && profile.position ? profile.position : "Position rank unavailable"]
  ];
}

export function PlayerProfileHeader({ profile }: { profile: PlayerProfile }) {
  return (
    <section className="hero-brand pt-32 text-white">
      <div className="container-px grid gap-8 py-12 lg:grid-cols-[1fr_24rem] lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            {profile.nationalRank ? <VerifiedBadge label="" /> : null}
            <span className="text-xs font-black uppercase tracking-[0.16em] text-gold-500">Player Profile</span>
          </div>
          <h1 className="mt-5 max-w-5xl font-display text-[clamp(3.4rem,9vw,7.25rem)] font-black leading-none">
            {profile.displayName}
          </h1>
          <p className="mt-5 max-w-3xl text-lg font-medium leading-8 text-white/72">
            {profile.currentTeam} | {profile.city}, {profile.region}
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {profileMeta(profile).map(([label, value]) => (
              <div key={label} className="border border-white/15 bg-white/10 p-4">
                <strong className="block text-lg font-black text-white">{value}</strong>
                <span className="mt-1 block text-xs font-bold uppercase tracking-[0.12em] text-white/55">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <aside className="border border-gold-500 bg-paper-500 p-6 text-court-900 shadow-[8px_8px_0_#d97706]">
          <div className="flex items-start justify-between gap-4 border-b border-line-500 pb-5">
            <span className="grid size-20 place-items-center overflow-hidden border border-court-900 bg-court-900 text-2xl font-black text-gold-500">
              {profile.photoUrl ? <img src={profile.photoUrl} alt="" className="h-full w-full object-cover" /> : initials(profile.displayName)}
            </span>
            <div className="text-right">
              <RatingBadge rating={profile.rating} large />
              <div className="mt-2 flex justify-end"><StarRating stars={profile.starRating} /></div>
              <p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-court-500">{profile.verifiedGameCount} verified games</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {rankCards(profile).map(([label, value, helper]) => (
              <div key={label} className="grid grid-cols-[8rem_1fr] items-center gap-3 border-b border-line-500 pb-3 last:border-b-0 last:pb-0">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-court-500">{label}</span>
                <span>
                  <strong className="block text-3xl font-black leading-none text-court-900">{value}</strong>
                  <small className="mt-1 block text-xs font-semibold text-court-500">{helper}</small>
                </span>
              </div>
            ))}
          </div>

          <Link href={`/claim?player=${profile.slug}`} className="button primary mt-6 w-full">Claim Profile</Link>
        </aside>
      </div>
    </section>
  );
}
