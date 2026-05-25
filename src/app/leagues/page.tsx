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
            title="Competition Hubs"
            dark
          />
        </div>
      </section>
      <LeaguesClient leagues={leagues} />
    </PublicPageShell>
  );
}
