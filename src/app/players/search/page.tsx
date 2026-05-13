import type { Metadata } from "next";
import { PlayerCard } from "@/components/player-card";
import { getPlayerSummaries } from "@/lib/players";
import { philippineRegions } from "@/lib/regions";

export const metadata: Metadata = {
  title: "Player Search",
  description: "Search OnCourt player profiles by first name, last name, position, and region."
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

  return (
    <main className="section page-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Player directory</p>
          <h1>Player search</h1>
        </div>
        <p>Search existing OnCourt profiles using any combination of name, position, and region.</p>
      </div>
      <form className="ranking-filter-form player-search-form" action="/players/search">
        <label>First name<input name="firstName" defaultValue={searchParams.firstName ?? ""} /></label>
        <label>Last name<input name="lastName" defaultValue={searchParams.lastName ?? ""} /></label>
        <label>Position<input name="position" defaultValue={searchParams.position ?? ""} /></label>
        <label>
          Region
          <select name="region" defaultValue={searchParams.region ?? ""}>
            <option value="">Any region</option>
            {regionOptions.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <button className="button primary" type="submit">Search</button>
      </form>
      <div className="profile-grid wide">
        {filtered.length ? (
          filtered.map((player) => <PlayerCard key={player.id} player={player} />)
        ) : (
          <div className="empty-state">
            {hasQuery ? "No matching profiles found." : "Enter search details to find player profiles."}
          </div>
        )}
      </div>
    </main>
  );
}
