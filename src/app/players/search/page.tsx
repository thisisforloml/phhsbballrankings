import type { Metadata } from "next";
import { PlayerCard } from "@/components/player-card";
import { FilterToolbar, FilterToolbarControlClass, FilterToolbarField, FilterToolbarRow } from "@/components/public/FilterToolbar";
import { PageBand } from "@/components/public/PageBand";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { getPlayerSummaries } from "@/lib/players";
import { philippineRegions } from "@/lib/regions";

export const metadata: Metadata = {
  title: "Player Search",
  description: "Search Peach Basket Rankings PH player profiles by first name, last name, position, and region."
};

export default async function PlayerSearchPage({
  searchParams
}: {
  searchParams: { firstName?: string; lastName?: string; position?: string; region?: string };
}) {
  const players = await getPlayerSummaries();
  const firstName = searchParams.firstName?.trim().toLowerCase() ?? "";
  const lastName = searchParams.lastName?.trim().toLowerCase() ?? "";
  const position = searchParams.position?.trim().toLowerCase() ?? "";
  const region = searchParams.region?.trim().toLowerCase() ?? "";
  const regionOptions = Array.from(new Set([...philippineRegions, ...players.map((player) => player.region)])).sort();
  const hasQuery = firstName || lastName || position || region;
  const filtered = hasQuery
    ? players.filter((player) => {
        const names = player.displayName.toLowerCase().split(/\s+/);
        return (
          (!firstName || names[0]?.includes(firstName) || player.displayName.toLowerCase().includes(firstName)) &&
          (!lastName || names.slice(1).join(" ").includes(lastName)) &&
          (!position || (player.position ?? "").toLowerCase().includes(position)) &&
          (!region || player.region.toLowerCase() === region)
        );
      })
    : [];

  const controlClass = FilterToolbarControlClass();

  return (
    <PublicPageShell className="pb-12 pt-24">
      <PageBand
        eyebrow="Player directory"
        title="Player search"
        description="Search existing Peach Basket profiles using name, position, and region."
      />

      <FilterToolbar>
        <form action="/players/search">
          <FilterToolbarRow>
            <FilterToolbarField label="First name" className="min-w-[12rem]">
              <input name="firstName" defaultValue={searchParams.firstName ?? ""} className={controlClass} />
            </FilterToolbarField>
            <FilterToolbarField label="Last name" className="min-w-[12rem]">
              <input name="lastName" defaultValue={searchParams.lastName ?? ""} className={controlClass} />
            </FilterToolbarField>
            <FilterToolbarField label="Position" className="min-w-[10rem]">
              <input name="position" defaultValue={searchParams.position ?? ""} className={controlClass} />
            </FilterToolbarField>
            <FilterToolbarField label="Region" className="min-w-[12rem]">
              <select name="region" defaultValue={searchParams.region ?? ""} className={controlClass}>
                <option value="">Any region</option>
                {regionOptions.map((item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
            </FilterToolbarField>
            <div className="flex min-w-[8rem] flex-1 items-end">
              <button
                className="min-h-9 w-full rounded-sm border border-hardwood-600 bg-hardwood-600 px-4 py-1.5 text-sm font-bold uppercase tracking-[0.04em] text-white hover:border-hardwood-700 hover:bg-hardwood-700"
                type="submit"
              >
                Search
              </button>
            </div>
          </FilterToolbarRow>
        </form>
      </FilterToolbar>

      <section className="container-px mt-8">
        <div className="mx-auto max-w-[74rem]">
          {filtered.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((player) => (
                <PlayerCard key={player.id} player={player} />
              ))}
            </div>
          ) : (
            <div className="rounded-sm border border-line-500 bg-white p-8 text-center text-court-600">
              {hasQuery ? "No matching profiles found." : "Enter search details to find player profiles."}
            </div>
          )}
        </div>
      </section>
    </PublicPageShell>
  );
}
