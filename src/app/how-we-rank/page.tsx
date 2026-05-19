import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How We Rank",
  description: "How OnCourt Rankings PH calculates Formula v1 player ratings and public ranking eligibility."
};

const starBands = [
  ["Below 60", "1 star"],
  ["60-69", "2 stars"],
  ["70-79", "3 stars"],
  ["80-89", "4 stars"],
  ["90-100", "5 stars"]
];

const modelInputs = [
  ["Shooting efficiency", "Made shots, missed shots, free throws, effective field goal percentage, and true shooting context help separate efficient scoring from high-volume scoring."],
  ["Possession control", "Offensive rebounds extend possessions, defensive rebounds finish stops, and turnovers end possessions without a shot."],
  ["Creation", "Assists receive creation credit while avoiding full double-counting of the teammate's made basket."],
  ["Defense", "Steals are credited as direct possession gains. Blocks are credited as defensive events with conservative possession-retention assumptions."],
  ["Costs", "Missed field goals, missed free throws, turnovers, and fouls are treated as costs because they reduce team scoring chances or give value back to the opponent."]
];

export default function HowWeRankPage() {
  return (
    <main className="section page-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">How We Rank</p>
          <h1>Formula v1 methodology</h1>
        </div>
        <p>
          Formula v1 is a possession-informed, transparent baseline model. It uses verified box-score data to estimate game-level production, scales those game scores inside comparable pools, then averages eligible games into current player ratings.
        </p>
      </div>

      <section className="method-section">
        <h2>What Formula v1 considers</h2>
        <div className="formula-grid">
          {modelInputs.map(([title, description]) => (
            <article key={title}>
              <strong>{title}</strong>
              <span>{description}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="method-section">
        <h2>Scoring workflow</h2>
        <p>
          Each verified GameStat row receives a raw game value based on possession-informed box-score logic. That raw value is scaled within the same league-season, gender, and age-group pool so players are compared against the right context. PlayerRating then represents the current average of a player's Formula v1 scaled game scores.
        </p>
        <p>
          The exact model parameters are versioned internally and reviewed for calibration as more verified historical data becomes available. The public page explains the factors considered without exposing every coefficient.
        </p>
      </section>

      <section className="method-section">
        <h2>Star bands</h2>
        <div className="formula-grid compact">
          {starBands.map(([rating, stars]) => (
            <article key={rating}>
              <strong>{rating}</strong>
              <span>{stars}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="method-section">
        <h2>Public eligibility</h2>
        <p>
          PlayerRating can exist before a player is public-ranking eligible. Current Formula v1 launch thresholds are U19 Boys with 10 or more verified games and U19 Girls with 5 or more verified games. Public RankingSnapshot rows include eligible players only.
        </p>
      </section>

      <section className="method-section">
        <h2>Age and class context</h2>
        <p>
          Age matters because production should be interpreted relative to maturity and development stage. A younger athlete producing against older competition may carry more long-term upside. Formula v1 does not apply an age modifier yet because birthDate coverage is still incomplete.
        </p>
        <p>
          Class-year context is handled separately from the rating formula. Athletes remain ranking-eligible through May 31 of their class year. Starting June 1 of that class year, they are excluded from active youth ranking snapshots. Age-group eligibility also advances every June 1: U13 covers age 13 and below, U16 covers ages 14-16, and U19 covers ages 17-19.
        </p>
        <p>
          Players do not reset to zero when advancing age groups. A future rating policy should provide a discounted carryover baseline from prior age-group performance, then fade that carryover as new verified games are recorded in the higher age group. Formula v1 does not implement carryover yet; current ratings still come from verified game data in the player's current age group.
        </p>
      </section>


      <section className="method-section">
        <h2>Ranking limitations</h2>
        <p>
          Rankings are informational and depend on verified stat availability. Missing box scores, incomplete birth dates, small sample sizes, stat corrections, and roster identity repairs can change ratings and public order. The model does not yet include carryover ratings, full schedule-strength calibration, play-by-play context, or scouting evaluation.
        </p>
      </section>
      <section className="method-section">
        <h2>Refresh schedule</h2>
        <p>
          Ratings are planned to refresh monthly on the first day of the month after admin validation. Formula changes, imports, and snapshot generation remain controlled admin workflows.
        </p>
      </section>
    </main>
  );
}

