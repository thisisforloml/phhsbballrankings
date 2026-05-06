"use client";

import { FormEvent, useEffect, useState } from "react";

type RequestRow = Record<string, string | number | boolean | null>;

interface AdministratorRequests {
  playerSubmissions: RequestRow[];
  organizerApplications: RequestRow[];
}

export default function AdministratorPage() {
  const [username, setUsername] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [message, setMessage] = useState("");
  const [requests, setRequests] = useState<AdministratorRequests>({
    playerSubmissions: [],
    organizerApplications: []
  });

  useEffect(() => {
    const saved = sessionStorage.getItem("oncourtAdministratorSession");
    if (saved) {
      const parsed = JSON.parse(saved) as { username: string };
      setUsername(parsed.username);
      setIsLoggedIn(true);
      void loadRequests(parsed.username);
    }
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextUsername = String(form.get("username") ?? "");
    const password = String(form.get("password") ?? "");
    const response = await fetch("/api/organizer/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: nextUsername, password })
    });
    const result = (await response.json()) as { ok: boolean; user?: { role: string }; message?: string };
    if (result.ok && result.user?.role === "ADMIN") {
      sessionStorage.setItem("oncourtAdministratorSession", JSON.stringify({ username: nextUsername }));
      setUsername(nextUsername);
      setIsLoggedIn(true);
      setMessage("");
      await loadRequests(nextUsername);
    } else {
      setMessage(result.message ?? "Administrator login required.");
    }
  }

  async function loadRequests(nextUsername = username) {
    const response = await fetch("/api/administrator/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: nextUsername })
    });
    const result = (await response.json()) as { ok: boolean; message?: string } & AdministratorRequests;
    if (result.ok) {
      setRequests({
        playerSubmissions: result.playerSubmissions,
        organizerApplications: result.organizerApplications
      });
    } else {
      setMessage(result.message ?? "Unable to load requests.");
    }
  }

  async function handleAction(type: "player" | "organizer", id: string, action: "APPROVE" | "REJECT") {
    setMessage(`${action === "APPROVE" ? "Approving" : "Rejecting"} request...`);
    const response = await fetch("/api/administrator/requests", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, type, id, action })
    });
    const result = (await response.json()) as { ok: boolean; message?: string };
    setMessage(result.message ?? (result.ok ? "Request updated." : "Action failed."));
    if (result.ok) await loadRequests();
  }

  if (!isLoggedIn) {
    return (
      <main className="section page-shell">
        <form className="login-panel" onSubmit={handleLogin}>
          <p className="eyebrow">Administrator only</p>
          <h1>Administrator dashboard</h1>
          <label>Username<input name="username" defaultValue="DarwinOwner" required /></label>
          <label>Password<input name="password" type="password" required /></label>
          <button className="button primary" type="submit">Log in</button>
          {message ? <p className="form-message">{message}</p> : null}
        </form>
      </main>
    );
  }

  return (
    <main className="section page-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Administrator dashboard</p>
          <h1>Requests</h1>
        </div>
        <div className="button-row">
          <button className="button secondary" onClick={() => loadRequests()} type="button">Refresh</button>
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              sessionStorage.removeItem("oncourtAdministratorSession");
              setIsLoggedIn(false);
            }}
          >
            Log out
          </button>
        </div>
      </div>
      {message ? <p className="form-message dashboard-message">{message}</p> : null}
      <section className="owner-grid">
        <RequestColumn
          title="Player profile submissions"
          rows={requests.playerSubmissions}
          type="player"
          onAction={handleAction}
        />
        <RequestColumn
          title="Organizer applications"
          rows={requests.organizerApplications}
          type="organizer"
          onAction={handleAction}
        />
      </section>
    </main>
  );
}

function RequestColumn({
  title,
  rows,
  type,
  onAction
}: {
  title: string;
  rows: RequestRow[];
  type: "player" | "organizer";
  onAction: (type: "player" | "organizer", id: string, action: "APPROVE" | "REJECT") => void;
}) {
  return (
    <section className="stat-entry">
      <h2>{title}</h2>
      <div className="request-list">
        {rows.length ? (
          rows.map((row) => (
            <article className="request-card" key={String(row.id)}>
              {row.photoUrl ? <img className="request-photo" src={String(row.photoUrl)} alt="" /> : null}
              {Object.entries(row)
                .filter(([key]) => !["id", "reviewedAt", "photoUrl"].includes(key))
                .map(([key, value]) => (
                  <p key={key}>
                    <strong>{humanLabel(key)}</strong>
                    <span>{value ? String(value) : "None"}</span>
                  </p>
                ))}
              {row.status === "PENDING" ? (
                <div className="request-actions">
                  <button className="button primary" type="button" onClick={() => onAction(type, String(row.id), "APPROVE")}>
                    Approve
                  </button>
                  <button className="button secondary" type="button" onClick={() => onAction(type, String(row.id), "REJECT")}>
                    Reject
                  </button>
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <p className="form-message">No requests yet.</p>
        )}
      </div>
    </section>
  );
}

function humanLabel(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}
