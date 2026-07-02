import Link from "next/link";

import { ScoutSectionLabel } from "@/components/public/ScoutSectionLabel";
import type { TeamStandingRow } from "@/lib/team-rankings-types";
import { getProgramAbbreviation } from "@/lib/uaap-school-display";

type LeagueStandingsPanelProps = {
  rows: Array<TeamStandingRow & { visibleRank: number }>;
};

export function LeagueStandingsPanel({ rows }: LeagueStandingsPanelProps) {
  if (!rows.length) {
    return (
      <div className="rounded-sm border border-white/[0.08] bg-scout-800/40 p-6 text-sm text-scout-500">
        Standings will appear once official games are recorded for this league.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-sm border border-white/[0.08] bg-scout-800/80">
      <div className="border-b border-white/10 px-4 py-3">
        <ScoutSectionLabel>Standings</ScoutSectionLabel>
      </div>
      <div className="hidden grid-cols-[2.5rem_minmax(10rem,1fr)_2.5rem_2.5rem_4rem] gap-2 border-b border-white/10 px-4 py-2 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-white/40 lg:grid">
        <span>#</span>
        <span>Team</span>
        <span className="text-center">W</span>
        <span className="text-center">L</span>
        <span className="text-center">PCT</span>
      </div>
      {rows.map((team) => (
        <Link
          key={team.id}
          href={`/teams/${team.teamId}`}
          className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem_2.5rem_4rem] items-center gap-2 border-b border-white/5 px-4 py-3 last:border-b-0 transition hover:bg-white/5 lg:grid-cols-[2.5rem_minmax(10rem,1fr)_2.5rem_2.5rem_4rem]"
        >
          <span className="font-numeric text-lg font-normal leading-none text-scout-orange-bright">{team.visibleRank}</span>
          <span className="min-w-0">
            <strong className="block truncate text-sm font-bold text-white">{team.displayName}</strong>
            <small className="block text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-white/40">
              {getProgramAbbreviation(team.internalTeamName) || team.internalTeamName}
            </small>
          </span>
          <span className="text-center font-numeric text-sm font-normal text-white">{team.wins}</span>
          <span className="text-center font-numeric text-sm font-normal text-white/55">{team.losses}</span>
          <span className="text-center font-numeric text-sm font-normal text-white">
            {team.winPercentage.toFixed(3).replace(/^0/, "")}
          </span>
        </Link>
      ))}
    </div>
  );
}

type LeagueInfoPanelProps = {
  items: Array<{ label: string; value: string }>;
};

export function LeagueInfoPanel({ items }: LeagueInfoPanelProps) {
  return (
    <div className="rounded-sm border border-white/10 bg-court-800/40">
      <div className="border-b border-white/10 px-4 py-3">
        <ScoutSectionLabel>League info</ScoutSectionLabel>
      </div>
      <dl className="divide-y divide-white/5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <dt className="font-semibold text-white/45">{item.label}</dt>
            <dd className="text-right font-medium text-white">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
