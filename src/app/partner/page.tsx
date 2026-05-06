"use client";

import { useState } from "react";
import { regions } from "@/lib/mock-data";

const coverageOptions = ["U13 Boys", "U13 Girls", "U16 Boys", "U16 Girls", "U19 Boys", "U19 Girls"];
const bodies = ["FIBA Philippines", "DepEd", "CHED", "LGU", "Private"];

export default function PartnerPage() {
  const [submitted, setSubmitted] = useState(false);
  const [statusEmail, setStatusEmail] = useState("");

  return (
    <main className="bg-surface-50 pb-20">
      <section className="hero-brand pt-32 text-white">
        <div className="container-px py-14">
          <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">League Partnership</p>
          <h1 className="mt-3 font-display text-stat-lg">Partner With OnCourt</h1>
          <p className="mt-5 max-w-3xl whitespace-pre-line text-lg leading-8 text-white/75">{`We work with leagues, schools, and tournament organizers across the Philippines
to build the most complete basketball database in the country. When your league
partners with OnCourt Rankings Philippines, your players earn verified national rankings based on
their real performance - and your competition gets recognized on a national stage.

We handle the rankings. You focus on the game.`}</p>
        </div>
      </section>
      <section className="container-px grid gap-6 pt-10 lg:grid-cols-[1fr_0.75fr]">
        <form onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }} className="grid gap-4 rounded-lg border border-surface-200 bg-white p-6 shadow-sm">
          {submitted ? (
            <div>
              <h2 className="font-display text-3xl">Thank you.</h2>
              <p className="mt-2 text-ink-600">Thank you. We'll review your submission and reach out within 5 business days.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold">Organization or League Name<input className="rounded-md border border-surface-300 px-3 py-3" required /></label>
                <label className="grid gap-2 text-sm font-semibold">Region<select className="rounded-md border border-surface-300 px-3 py-3">{regions.map((region) => <option key={region}>{region}</option>)}</select></label>
                <label className="grid gap-2 text-sm font-semibold">City<input className="rounded-md border border-surface-300 px-3 py-3" required /></label>
                <label className="grid gap-2 text-sm font-semibold">Governing or sanctioning body<select className="rounded-md border border-surface-300 px-3 py-3">{bodies.map((body) => <option key={body}>{body}</option>)}</select></label>
                <label className="grid gap-2 text-sm font-semibold">Estimated number of teams<input className="rounded-md border border-surface-300 px-3 py-3" type="number" min="1" required /></label>
                <label className="grid gap-2 text-sm font-semibold">Games per team per season<input className="rounded-md border border-surface-300 px-3 py-3" type="number" min="1" required /></label>
                <label className="grid gap-2 text-sm font-semibold">Contact person full name<input className="rounded-md border border-surface-300 px-3 py-3" required /></label>
                <label className="grid gap-2 text-sm font-semibold">Email address<input className="rounded-md border border-surface-300 px-3 py-3" type="email" required /></label>
              </div>
              <fieldset className="grid gap-3 rounded-md border border-surface-200 p-4">
                <legend className="px-1 font-mono text-mono-sm uppercase text-ink-500">Age groups covered</legend>
                <div className="grid gap-2 md:grid-cols-3">
                  {coverageOptions.map((option) => (
                    <label key={option} className="flex items-center gap-2 text-sm font-semibold text-ink-700">
                      <input type="checkbox" className="h-4 w-4 accent-navy-800" /> {option}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="grid gap-2 text-sm font-semibold">Brief description of the league<textarea className="min-h-28 rounded-md border border-surface-300 px-3 py-3" maxLength={300} required /></label>
              <label className="grid gap-2 text-sm font-semibold">Optional: League charter, sanction letter, or schedule<input className="rounded-md border border-surface-300 px-3 py-3" type="file" accept="application/pdf" /></label>
              <button className="button primary" type="submit">Submit Partnership</button>
            </>
          )}
        </form>
        <section className="h-fit rounded-lg border border-surface-200 bg-white p-6 shadow-sm">
          <h2 className="font-display text-3xl">Status Check</h2>
          <p className="mt-2 text-ink-600">Enter your email to check submission status.</p>
          <label className="mt-4 grid gap-2 text-sm font-semibold">Email<input value={statusEmail} onChange={(event) => setStatusEmail(event.target.value)} className="rounded-md border border-surface-300 px-3 py-3" type="email" /></label>
          <button className="button secondary mt-4" type="button">Check Status</button>
          {statusEmail ? <p className="mt-4 rounded-md bg-surface-100 p-3 text-ink-600">Pending</p> : null}
        </section>
      </section>
    </main>
  );
}
