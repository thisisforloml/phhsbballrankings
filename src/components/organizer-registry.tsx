"use client";

import { FormEvent, useEffect, useState } from "react";
import type { PlayerSummary } from "@/lib/types";
import { philippineRegions } from "@/lib/regions";

type TeamSide = "home" | "away";

interface PlayerRow {
  id: number;
  team: TeamSide;
}

export function OrganizerRegistry({ players }: { players: PlayerSummary[] }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");
  const [homeRows, setHomeRows] = useState<PlayerRow[]>([{ id: 1, team: "home" }]);
  const [awayRows, setAwayRows] = useState<PlayerRow[]>([{ id: 1, team: "away" }]);

  useEffect(() => {
    const saved = sessionStorage.getItem("oncourtOrganizerSession");
    if (saved) {
      const parsed = JSON.parse(saved) as { username: string };
      setUsername(parsed.username);
      setIsLoggedIn(true);
    }
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginMessage("Checking account...");
    const form = new FormData(event.currentTarget);
    const nextUsername = String(form.get("username") ?? "");
    const password = String(form.get("password") ?? "");

    const response = await fetch("/api/organizer/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: nextUsername, password })
    });
    const result = (await response.json()) as { ok: boolean; message?: string };

    if (result.ok) {
      setUsername(nextUsername);
      setIsLoggedIn(true);
      sessionStorage.setItem("oncourtOrganizerSession", JSON.stringify({ username: nextUsername }));
      setLoginMessage("");
    } else {
      setLoginMessage(result.message ?? "Login failed.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitMessage("Saving submitted game...");
    const form = new FormData(event.currentTarget);
    const rows = [...homeRows, ...awayRows];
    const playerStats = rows
      .map((row) => ({
        team: row.team,
        name: String(form.get(`${row.team}-player-${row.id}`) ?? ""),
        jerseyNumber: String(form.get(`${row.team}-number-${row.id}`) ?? ""),
        starter: form.get(`${row.team}-starter-${row.id}`) === "on",
        position: String(form.get(`${row.team}-position-${row.id}`) ?? ""),
        points: Number(form.get(`${row.team}-points-${row.id}`)),
        offensiveRebounds: Number(form.get(`${row.team}-oreb-${row.id}`) || 0),
        defensiveRebounds: Number(form.get(`${row.team}-dreb-${row.id}`) || 0),
        rebounds: Number(form.get(`${row.team}-rebounds-${row.id}`) || 0),
        assists: Number(form.get(`${row.team}-assists-${row.id}`) || 0),
        minutes: Number(form.get(`${row.team}-minutes-${row.id}`) || 0),
        steals: Number(form.get(`${row.team}-steals-${row.id}`) || 0),
        blocks: Number(form.get(`${row.team}-blocks-${row.id}`) || 0),
        turnovers: Number(form.get(`${row.team}-turnovers-${row.id}`) || 0),
        foulsDrawn: Number(form.get(`${row.team}-fouls-drawn-${row.id}`) || 0),
        plusMinus: Number(form.get(`${row.team}-plus-minus-${row.id}`) || 0),
        fieldGoalsMade: Number(form.get(`${row.team}-fgm-${row.id}`) || 0),
        fieldGoalsAttempt: Number(form.get(`${row.team}-fga-${row.id}`) || 0),
        twoMade: Number(form.get(`${row.team}-twom-${row.id}`) || 0),
        twoAttempt: Number(form.get(`${row.team}-twoa-${row.id}`) || 0),
        threeMade: Number(form.get(`${row.team}-threem-${row.id}`) || 0),
        threeAttempt: Number(form.get(`${row.team}-threea-${row.id}`) || 0),
        freeThrowsMade: Number(form.get(`${row.team}-ftm-${row.id}`) || 0),
        freeThrowsAttempt: Number(form.get(`${row.team}-fta-${row.id}`) || 0),
        fouls: Number(form.get(`${row.team}-fouls-${row.id}`) || 0)
      }))
      .filter((row) => row.name.trim());

    const response = await fetch("/api/organizer/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        leagueName: form.get("leagueName"),
        date: form.get("date"),
        venueName: form.get("venueName"),
        city: form.get("city"),
        region: form.get("region"),
        homeTeam: form.get("homeTeam"),
        awayTeam: form.get("awayTeam"),
        homeScore: Number(form.get("homeScore")),
        awayScore: Number(form.get("awayScore")),
        homeQ1: Number(form.get("homeQ1") || 0),
        homeQ2: Number(form.get("homeQ2") || 0),
        homeQ3: Number(form.get("homeQ3") || 0),
        homeQ4: Number(form.get("homeQ4") || 0),
        awayQ1: Number(form.get("awayQ1") || 0),
        awayQ2: Number(form.get("awayQ2") || 0),
        awayQ3: Number(form.get("awayQ3") || 0),
        awayQ4: Number(form.get("awayQ4") || 0),
        sourceNotes: form.get("sourceNotes"),
        players: playerStats
      })
    });
    const result = (await response.json()) as { ok: boolean; message?: string };

    setSubmitMessage(
      result.ok
        ? "Saved. The game is submitted for administrator verification before it affects rankings."
        : result.message ?? "Submission failed."
    );
  }

  function addPlayer(side: TeamSide) {
    if (side === "home") {
      setHomeRows((rows) => [...rows, { id: Math.max(...rows.map((row) => row.id)) + 1, team: "home" }]);
    } else {
      setAwayRows((rows) => [...rows, { id: Math.max(...rows.map((row) => row.id)) + 1, team: "away" }]);
    }
  }

  if (!isLoggedIn) {
    return (
      <section className="login-shell">
        <form className="login-panel" onSubmit={handleLogin}>
          <p className="eyebrow">Restricted access</p>
          <h2>Organizer login</h2>
          <p>
            Only approved organizer accounts can input tournaments and stats. If an organizer does not
            have a valid account, they are not allowed to submit game data.
          </p>
          <label>
            Username
            <input name="username" type="text" placeholder="Username" required />
          </label>
          <label>
            Password
            <input name="password" type="password" placeholder="Enter password" required />
          </label>
          <button className="button primary" type="submit">
            Log in
          </button>
          <a className="button secondary" href="/partner" target="_blank">
            Apply for organizer account
          </a>
          {loginMessage ? <p className="form-message">{loginMessage}</p> : null}
        </form>
      </section>
    );
  }

  return (
    <form className="organizer-workspace" onSubmit={handleSubmit}>
      <div className="portal-header">
        <div>
          <p className="eyebrow">Stats portal</p>
          <h2>Submit official game stats</h2>
        </div>
        <a className="button secondary" href="/administrator" target="_blank">
          Administrator
        </a>
        <button
          className="button secondary"
          type="button"
          onClick={() => {
            sessionStorage.removeItem("oncourtOrganizerSession");
            setIsLoggedIn(false);
          }}
        >
          Log out
        </button>
      </div>

      <datalist id="player-options">
        {players.map((player) => (
          <option key={player.id} value={player.displayName} />
        ))}
      </datalist>

      <section className="stat-entry full-width">
        <h2>Game details</h2>
        <label>
          League name
          <input name="leagueName" type="text" placeholder="Official league name" required />
        </label>
        <div className="form-grid two">
          <label>
            Date
            <input name="date" type="date" required />
          </label>
          <label>
            Venue
            <input name="venueName" type="text" placeholder="Official venue" />
          </label>
        </div>
        <div className="form-grid two">
          <label>
            City
            <input name="city" type="text" placeholder="Official game city" required />
          </label>
          <label>
            Region
            <select name="region" required defaultValue="">
              <option value="" disabled>Select region</option>
              {philippineRegions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-grid two">
          <label>
            Team 1
            <input name="homeTeam" type="text" placeholder="Official team name" required />
          </label>
          <label>
            Team 2
            <input name="awayTeam" type="text" placeholder="Official team name" required />
          </label>
        </div>
        <div className="form-grid four">
          <label>Team 1 Q1<input name="homeQ1" type="number" min="0" /></label>
          <label>Team 1 Q2<input name="homeQ2" type="number" min="0" /></label>
          <label>Team 1 Q3<input name="homeQ3" type="number" min="0" /></label>
          <label>Team 1 Q4<input name="homeQ4" type="number" min="0" /></label>
          <label>Team 2 Q1<input name="awayQ1" type="number" min="0" /></label>
          <label>Team 2 Q2<input name="awayQ2" type="number" min="0" /></label>
          <label>Team 2 Q3<input name="awayQ3" type="number" min="0" /></label>
          <label>Team 2 Q4<input name="awayQ4" type="number" min="0" /></label>
        </div>
        <div className="form-grid two">
          <label>
            Team 1 final score
            <input name="homeScore" type="number" min="0" placeholder="0" required />
          </label>
          <label>
            Team 2 final score
            <input name="awayScore" type="number" min="0" placeholder="0" required />
          </label>
        </div>
      </section>

      <div className="team-stat-columns">
        <TeamPlayerStats side="home" title="Team 1 players" rows={homeRows} addPlayer={addPlayer} />
        <TeamPlayerStats side="away" title="Team 2 players" rows={awayRows} addPlayer={addPlayer} />
      </div>

      <section className="stat-entry full-width">
        <label>
          Official source · notes
          <textarea name="sourceNotes" placeholder="Official box score link, stat sheet reference, scorer notes, or verification context." />
        </label>
        <button className="button primary" type="submit">
          Submit for verification
        </button>
        {submitMessage ? <p className="form-message">{submitMessage}</p> : null}
        <p>
          Existing players appear as suggestions. New player names are saved to the directory with the
          submitted game and can be completed later by the administrator.
        </p>
      </section>
    </form>
  );
}

function TeamPlayerStats({
  side,
  title,
  rows,
  addPlayer
}: {
  side: TeamSide;
  title: string;
  rows: PlayerRow[];
  addPlayer: (side: TeamSide) => void;
}) {
  return (
    <section className="stat-entry">
      <div className="portal-header compact">
        <h2>{title}</h2>
        <button className="button secondary" type="button" onClick={() => addPlayer(side)}>
          Add player {rows.length + 1}
        </button>
      </div>
      {rows.map((row, index) => (
        <article className="player-stat-card" key={`${side}-${row.id}`}>
          <h3>Player {index + 1}</h3>
          <div className="form-grid two">
            <label>
              No.
              <input name={`${side}-number-${row.id}`} placeholder="No." />
            </label>
            <label>
              Starter
              <input name={`${side}-starter-${row.id}`} type="checkbox" />
            </label>
            <label>
              Player name
              <input name={`${side}-player-${row.id}`} list="player-options" placeholder="Existing or new player name" required />
            </label>
            <label>
              Position
              <input name={`${side}-position-${row.id}`} placeholder="PG, SG, SF, PF, C" />
            </label>
          </div>
          <div className="form-grid three">
            <label>
              Points
              <input name={`${side}-points-${row.id}`} type="number" min="0" required />
            </label>
            <label>
              Rebounds
              <input name={`${side}-rebounds-${row.id}`} type="number" min="0" />
            </label>
            <label>
              Assists
              <input name={`${side}-assists-${row.id}`} type="number" min="0" />
            </label>
          </div>
          <details>
            <summary>Advanced stats · metrics</summary>
            <div className="form-grid three">
              <label>Minutes<input name={`${side}-minutes-${row.id}`} type="number" min="0" step="0.1" /></label>
              <label>Steals<input name={`${side}-steals-${row.id}`} type="number" min="0" /></label>
              <label>Blocks<input name={`${side}-blocks-${row.id}`} type="number" min="0" /></label>
              <label>Turnovers<input name={`${side}-turnovers-${row.id}`} type="number" min="0" /></label>
              <label>Off. Reb<input name={`${side}-oreb-${row.id}`} type="number" min="0" /></label>
              <label>Def. Reb<input name={`${side}-dreb-${row.id}`} type="number" min="0" /></label>
              <label>FG made<input name={`${side}-fgm-${row.id}`} type="number" min="0" /></label>
              <label>FG attempted<input name={`${side}-fga-${row.id}`} type="number" min="0" /></label>
              <label>2PT made<input name={`${side}-twom-${row.id}`} type="number" min="0" /></label>
              <label>2PT attempted<input name={`${side}-twoa-${row.id}`} type="number" min="0" /></label>
              <label>3PT made<input name={`${side}-threem-${row.id}`} type="number" min="0" /></label>
              <label>3PT attempted<input name={`${side}-threea-${row.id}`} type="number" min="0" /></label>
              <label>FT made<input name={`${side}-ftm-${row.id}`} type="number" min="0" /></label>
              <label>FT attempted<input name={`${side}-fta-${row.id}`} type="number" min="0" /></label>
              <label>Fouls<input name={`${side}-fouls-${row.id}`} type="number" min="0" /></label>
              <label>Fouls drawn<input name={`${side}-fouls-drawn-${row.id}`} type="number" min="0" /></label>
              <label>+/-<input name={`${side}-plus-minus-${row.id}`} type="number" /></label>
            </div>
          </details>
        </article>
      ))}
    </section>
  );
}
