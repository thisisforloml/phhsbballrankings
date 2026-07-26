import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { loadAdminLeaguesList } from "@/lib/admin/load-admin-leagues-list";
import { getCompetitionBracketLabel, getLeagueFamilyName } from "@/lib/competition-hierarchy";
import { requireAdminUser } from "@/lib/portal-auth";

import { LeagueCreateForm } from "./LeagueCreateForm";

export const metadata = {
  title: "Leagues & Competitions | Admin",
  description: "Manage leagues, seasons, and competition brackets.",
};

export default async function AdminLeaguesPage() {
  const [, leagues] = await Promise.all([requireAdminUser(), loadAdminLeaguesList()]);

  const groups = new Map<string, Map<string, Array<{
    id: string;
    name: string;
    bracket: string;
    tier: number;
    games: number;
  }>>>();

  for (const league of leagues) {
    const family = getLeagueFamilyName(league.name, league.organizerName);
    const seasons = league.seasons.length
      ? league.seasons
      : [{ id: "none", name: "No season", seasonYear: 0, _count: { games: 0 } }];

    for (const season of seasons) {
      const seasonLabel = season.seasonYear ? season.name + " (" + season.seasonYear + ")" : season.name;
      const bySeason = groups.get(family) ?? new Map();
      const brackets = bySeason.get(seasonLabel) ?? [];
      brackets.push({
        id: league.id,
        name: league.name,
        bracket: getCompetitionBracketLabel(league.name, league.ageGroup),
        tier: league.tier,
        games: season._count.games,
      });
      bySeason.set(seasonLabel, brackets);
      groups.set(family, bySeason);
    }
  }

  const sortedGroups = Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right));

  return (
    <>
      <AdminPageHeader
        eyebrow="Competition directory"
        title="Leagues & Competitions"
        description="League → Season → bracket. Open a bracket to manage its games."
        statusBadge={leagues.length + " competition records"}
      />
      <LeagueCreateForm />

      <div className="grid gap-3">
        {sortedGroups.map(([family, seasons]) => (
          <section key={family} className="overflow-hidden border border-surface-200 bg-white shadow-sm">
            <div className="border-b border-surface-200 bg-navy-950 px-4 py-3 text-white">
              <h2 className="font-display text-lg font-bold">{family}</h2>
            </div>
            <div className="divide-y divide-surface-200">
              {Array.from(seasons.entries())
                .sort(([left], [right]) => right.localeCompare(left))
                .map(([season, brackets]) => (
                  <div key={season} className="grid gap-2 px-4 py-3 md:grid-cols-[14rem_1fr]">
                    <h3 className="font-semibold text-navy-900">{season}</h3>
                    <div className="flex flex-wrap gap-2">
                      {brackets
                        .sort((left, right) => left.bracket.localeCompare(right.bracket))
                        .map((competition) => (
                          <Link
                            key={competition.id + season}
                            href={"/admin/leagues/" + competition.id}
                            prefetch={false}
                            className="inline-flex items-center gap-2 border border-surface-200 bg-surface-50 px-3 py-2 text-sm hover:border-orange-300"
                          >
                            <strong className="text-navy-900">{competition.bracket}</strong>
                            <span className="text-ink-500">{competition.games} games</span>
                            <span className="text-ink-400">Tier {competition.tier}</span>
                          </Link>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        ))}
        {!sortedGroups.length ? (
          <p className="border border-dashed border-surface-300 bg-white p-6 text-sm text-ink-500">No leagues yet.</p>
        ) : null}
      </div>
    </>
  );
}
