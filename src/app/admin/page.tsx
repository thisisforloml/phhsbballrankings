"use client";

import { useState } from "react";

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(false);

  if (!loggedIn) {
    return (
      <main className="bg-surface-50 pb-20">
        <section className="hero-brand pt-32 text-white">
          <div className="container-px py-14">
            <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">OnCourt Admin Panel</p>
            <h1 className="mt-3 font-display text-stat-lg">Administrator Login</h1>
          </div>
        </section>
        <section className="container-px pt-10">
          <form onSubmit={(event) => { event.preventDefault(); setLoggedIn(true); }} className="mx-auto grid max-w-xl gap-4 rounded-lg border border-surface-200 bg-white p-6 shadow-sm">
            <label className="grid gap-2 font-semibold">Username<input className="rounded-md border border-surface-300 px-3 py-3" defaultValue="DarwinOwner" required /></label>
            <label className="grid gap-2 font-semibold">Password<input className="rounded-md border border-surface-300 px-3 py-3" type="password" required /></label>
            <button className="button primary">Login</button>
          </form>
        </section>
      </main>
    );
  }

  const panels = [
    "Review organizer applications",
    "Review submitted games and stat sheets",
    "Manage league tiers and verification status",
    "Review player profile claim requests",
    "System-wide compliance and submission stats",
    "User management",
    "Full audit log",
    "System health dashboard",
    "Revenue/licensing inquiry log"
  ];

  return (
    <main className="bg-surface-50 pb-20 pt-28">
      <section className="container-px">
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <p className="label">Owner Account</p>
          <h1 className="font-display text-stat-md">Administrator Dashboard</h1>
          <p className="mt-2 text-ink-600">Role hierarchy: owner &gt; oncourt_team &gt; organizer &gt; statistician &gt; player.</p>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {panels.map((panel, index) => (
            <article key={panel} className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
              <span className="font-display text-stat-sm text-navy-800">{index + 1}</span>
              <h2 className="mt-2 font-semibold">{panel}</h2>
              <div className="mt-4 flex gap-2">
                <button className="button primary">Approve</button>
                <button className="button secondary">Reject</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
