"use client";

import { useMemo, useState } from "react";
import type { AgeGroup, Gender } from "@/lib/mock-data";
import { ageGroups, genders, leagues, regions, scoreGames } from "@/lib/mock-data";
import { useAuth } from "@/components/auth/AuthContext";
import { EmptyState, PremiumGate, VerifiedBadge } from "@/components/ui";

export default function ScoresPage() {
  const { session } = useAuth();
  const isPremium = Boolean(session?.isPremium);
  const [region, setRegion] = useState("All");
  const [league, setLeague] = useState("All");
  const [ageGroup, setAgeGroup] = useState<"All" | AgeGroup>("All");
  const [gender, setGender] = useState<"All" | Gender>("All");

  const filtered = useMemo(() => scoreGames
    .filter((game) => region === "All" || game.region === region)
    .filter((game) => league === "All" || game.league === league)
    .filter((game) => ageGroup === "All" || game.ageGroup === ageGroup)
    .filter((game) => gender === "All" || game.gender === gender), [ageGroup, gender, league, region]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Map<string, Map<string, typeof filtered>>>();
    filtered.forEach((game) => {
      const regionGroup = groups.get(game.region) ?? new Map<string, Map<string, typeof filtered>>();
      const ageGender = `${game.ageGroup} ${game.gender}`;
      const ageGroupMap = regionGroup.get(ageGender) ?? new Map<string, typeof filtered>();
      const leagueGames = ageGroupMap.get(game.league) ?? [];
      leagueGames.push(game);
      ageGroupMap.set(game.league, leagueGames);
      regionGroup.set(ageGender, ageGroupMap);
      groups.set(game.region, regionGroup);
    });
    return groups;
  }, [filtered]);

  return (
    <main className="bg-surface-50 pb-20">
      <section className="hero-brand pt-32 text-white">
        <div className="container-px py-14">
          <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">Verified Scores</p>
          <h1 className="mt-3 font-display text-stat-lg">Scores</h1>
        </div>
      </section>
      <section className="container-px pt-10">
        {!isPremium ? (
          <div className="mb-6 rounded-lg border border-amber-500 bg-amber-500 p-5 text-navy-950 shadow-sm md:flex md:items-center md:justify-between md:gap-6">
            <p className="font-semibold">Scores are available to Premium members. Unlock full access to view all results, game details, and box scores.</p>
            <a href="/register" className="mt-4 inline-flex rounded-md bg-white px-4 py-2 font-semibold text-navy-800 md:mt-0">Get Premium Access</a>
          </div>
        ) : null}
        <div className="mb-6 grid gap-3 rounded-lg border border-surface-200 bg-white p-4 shadow-sm md:grid-cols-4">
          <select value={region} onChange={(event) => setRegion(event.target.value)} className="rounded-md border border-surface-300 px-3 py-3"><option>All</option>{regions.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={league} onChange={(event) => setLeague(event.target.value)} className="rounded-md border border-surface-300 px-3 py-3"><option>All</option>{leagues.map((item) => <option key={item.id}>{item.name}</option>)}</select>
          <select value={ageGroup} onChange={(event) => setAgeGroup(event.target.value as "All" | AgeGroup)} className="rounded-md border border-surface-300 px-3 py-3"><option>All</option>{ageGroups.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={gender} onChange={(event) => setGender(event.target.value as "All" | Gender)} className="rounded-md border border-surface-300 px-3 py-3"><option>All</option>{genders.map((item) => <option key={item}>{item}</option>)}</select>
        </div>
        {!filtered.length ? <EmptyState icon="scores" title="No scores available" /> : null}
        <div className="grid gap-10">
          {[...grouped.entries()].map(([regionName, ageGroupsMap]) => (
            <section key={regionName} className="grid gap-5">
              <h2 className="font-display text-stat-md text-ink-900">{regionName}</h2>
              {[...ageGroupsMap.entries()].map(([ageGender, leagueMap]) => (
                <section key={ageGender} className="grid gap-4">
                  <h3 className="font-mono text-label uppercase tracking-[0.12em] text-navy-800">{ageGender}</h3>
                  {[...leagueMap.entries()].map(([leagueName, games]) => (
                    <section key={leagueName} className="grid gap-3">
                      <h4 className="font-display text-2xl text-ink-900">{leagueName}</h4>
                      {isPremium ? (
                        <div className="grid gap-4">
                          {games.map((game) => <ScoreCard key={game.id} game={game} />)}
                        </div>
                      ) : (
                        <PremiumGate description="Full scores, game details, and box scores are available behind Premium Access.">
                          <div className="grid gap-4">
                            {games.map((game) => <ScoreCard key={game.id} game={game} />)}
                          </div>
                        </PremiumGate>
                      )}
                    </section>
                  ))}
                </section>
              ))}
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}

function ScoreCard({ game }: { game: (typeof scoreGames)[number] }) {
  return (
    <article className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm md:flex md:items-center md:justify-between md:gap-6">
      <div>
        <p className="font-mono text-mono-sm uppercase text-ink-500">{game.date} · {game.city}</p>
        <h2 className="mt-2 font-display text-3xl">{game.homeTeam} vs {game.awayTeam}</h2>
        <p className="mt-1 text-sm text-ink-500">{game.league}</p>
      </div>
      <div className="mt-4 flex items-center gap-4 md:mt-0">
        <strong className="font-display text-stat-md text-navy-800">{game.homeScore} â€“ {game.awayScore}</strong>
        {game.isVerified ? <VerifiedBadge label="Verified" /> : null}
      </div>
    </article>
  );
}
