import { getPublicLeagues } from "@/lib/public-site-data";
import { LeaguesClient } from "./LeaguesClient";

export default async function LeaguesPage() {
  const leagues = await getPublicLeagues();

  return (
    <main className="bg-surface-50 pb-20">
      <section className="hero-brand pt-32 text-white">
        <div className="container-px py-14">
          <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">League Directory</p>
          <h1 className="mt-3 font-display text-stat-lg">Verified Leagues</h1>
          <p className="mt-4 max-w-2xl text-white/70">Official competitions feeding the national player registry and rankings model.</p>
        </div>
      </section>
      <LeaguesClient leagues={leagues} />
    </main>
  );
}