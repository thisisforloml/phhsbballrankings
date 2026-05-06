import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Methodology",
  description: "OnCourt rating formula, league quality scoring, verification policy, and integrity safeguards."
};

const leagueCriteria = [
  ["Governing body sanction", "20 pts", "Recognition by FIBA Philippines, BAP, DepEd, CHED, PSC, NSA, LGU, or documented private organizer."],
  ["Team count", "15 pts", "Each age bracket is scored independently so multi-age leagues cannot inflate quality."],
  ["Games per team", "20 pts", "Rewards leagues that can produce meaningful samples and support the gender-specific eligibility rules."],
  ["Stat compliance", "20 pts", "New leagues receive a provisional first-season score, then actual compliance replaces it."],
  ["Player quality index", "25 pts", "Median player rating prevents one elite player from inflating a weak league."]
];

const formulaSteps = [
  ["Production Score", "Points, assists, rebounds, and submitted box score metrics are weighted by role and game context."],
  ["League Weight", "League governance, team count, season volume, and stat compliance scale production by competition quality."],
  ["Opponent Factor", "Strong games against stronger teams are worth more, clamped between 0.85 and 1.15."],
  ["Team Context Factor", "Players carrying weaker supporting casts are protected from context bias."],
  ["Recency Average", "Recent games carry more weight through a simple exponential decay model."],
  ["Bayesian Shrinkage", "Small samples are pulled toward the age-bracket mean until the player reaches ranking eligibility."]
];

export default function MethodologyPage() {
  return (
    <main className="section page-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Transparent and defensible</p>
          <h1>OnCourt methodology</h1>
        </div>
        <p>
          OnCourt is a context-aware rating system. It does not rank players by raw box-score totals alone.
          Every public rating is based on verified official games, league quality, opponent strength, team
          context, recency, and sample-size controls.
        </p>
      </div>

      <section className="method-section">
        <h2>Leaderboard eligibility</h2>
        <p>
          Boys must have at least 10 verified official games to appear on any public leaderboard. Girls
          must have at least 8 verified official games. Players below the applicable threshold remain
          searchable in the registry, but they are hidden from ranked lists.
        </p>
      </section>

      <section className="method-section">
        <h2>Age brackets</h2>
        <div className="formula-grid compact">
          <article>
            <strong>U13</strong>
            <span>Example 2025 season: born 2012â€“2013.</span>
          </article>
          <article>
            <strong>U16</strong>
            <span>Example 2025 season: born 2009â€“2011.</span>
          </article>
          <article>
            <strong>U19</strong>
            <span>Example 2025 season: born 2007â€“2008.</span>
          </article>
        </div>
      </section>

      <section className="method-section">
        <h2>League quality score</h2>
        <div className="workflow">
          {leagueCriteria.map(([title, points, description]) => (
            <article key={title}>
              <span>{points}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="method-section">
        <h2>Rating formula</h2>
        <div className="formula-grid">
          {formulaSteps.map(([title, description]) => (
            <article key={title}>
              <strong>{title}</strong>
              <span>{description}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="method-section">
        <h2>Integrity safeguards</h2>
        <div className="license-panel">
          <ul>
            <li>Only verified games affect ratings and leaderboards.</li>
            <li>Corrections to verified stats require an audit-log reason, old value, and new value.</li>
            <li>Formula versions are stored separately from raw stats so recalculations are non-destructive.</li>
            <li>Weekly ranking snapshots are preserved as historical records.</li>
            <li>The one-team-per-season roster constraint prevents manipulation.</li>
            <li>Performance scores are capped at 100 to prevent outliers from distorting the distribution.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
