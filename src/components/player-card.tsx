import Link from "next/link";

import { leaderboardMinimumGamesForGender } from "@/lib/demo-data";
import { initials } from "@/lib/format";
import type { PlayerSummary } from "@/lib/types";

export function PlayerCard({ player }: { player: PlayerSummary }) {
  const minimumGames = leaderboardMinimumGamesForGender(player.gender);
  const eligibility = player.games >= minimumGames ? "Leaderboard eligible" : "Searchable, not ranked yet";

  return (
    <Link className="profile-card" href={`/players/${player.slug}`}>
      <div className="profile-top">
        <div className="profile-name">
          {player.photoUrl ? (
            <img className="avatar image-avatar" src={player.photoUrl} alt="" />
          ) : (
            <span className="avatar">{initials(player.displayName)}</span>
          )}
          <span>
            <strong>{player.displayName}</strong>
            <span>
              {player.city} · {player.ageGroup}
            </span>
          </span>
        </div>
        <span className="rating-badge">{player.rating.toFixed(0)}</span>
      </div>
      <div className="stat-row">
        <span>
          <strong>{player.ppg}</strong> PPG
        </span>
        <span>
          <strong>{player.rpg}</strong> RPG
        </span>
        <span>
          <strong>{player.apg}</strong> APG
        </span>
      </div>
      <p className="card-note">{eligibility}</p>
    </Link>
  );
}
