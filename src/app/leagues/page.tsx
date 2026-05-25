import { getPublicLeagues } from "@/lib/public-site-data";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { SectionHeader } from "@/components/public/SectionHeader";
import { LeaguesClient } from "./LeaguesClient";

export default async function LeaguesPage() {
  const leagues = await getPublicLeagues();

  return (
    <PublicPageShell className="pb-20">
      <section className="hero-brand pt-32 text-white">
        <div className="container-px py-14">
          <SectionHeader
            eyebrow="League Directory"
            title="Competition Hubs"
            description="Official competitions feeding player profiles, team standings, game logs, and rankings."
            dark
          />
        </div>
      </section>
      <LeaguesClient leagues={leagues} />
    </PublicPageShell>
  );
}

