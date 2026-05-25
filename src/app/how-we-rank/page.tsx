import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { SectionHeader } from "@/components/public/SectionHeader";

export const metadata: Metadata = {
  title: "How We Rank",
  description: "How OnCourt Rankings PH explains verified stats, Formula v1 player ratings, team standings, and ranking confidence."
};

const ratingInputs = [
  ["Game statistics", "Box-score production is the foundation: points, shooting, rebounds, assists, steals, blocks, turnovers, fouls, and possession value."],
  ["Competition pool", "Formula v1 scales game scores inside comparable league, season, gender, and age-group pools so numbers are not read in isolation."],
  ["League tier", "League quality is tracked as context. Formula v1 currently keeps leagueWeight neutral until enough historical data exists for calibration."],
  ["Opponent level", "Opponent and schedule strength matter for evaluation. Full opponent-strength adjustment is planned, but not claimed as complete in Formula v1."],
  ["Teammate quality", "Role and team context affect production. OnCourt surfaces team and roster context, while deeper teammate-adjusted modeling remains a future layer."],
  ["Age and class context", "Age bracket, class year, and playing-up context help interpret development stage. Formula v1 is conservative until birthdate coverage improves."]
];

const confidenceRows = [
  ["Verified games", "Public rankings require enough official game data before a player appears on the board."],
  ["Sample size", "A player with more verified games carries more confidence than a player with only a short stat record."],
  ["Source quality", "Cleaner box scores, complete rosters, and corrected team/player identities improve ranking reliability."],
  ["Monthly snapshots", "Public ranking rows are generated as controlled snapshots so changes can be reviewed over time."]
];

const starBands = [
  ["Below 60", "1 star"],
  ["60-69", "2 stars"],
  ["70-79", "3 stars"],
  ["80-89", "4 stars"],
  ["90-100", "5 stars"]
];

export default function HowWeRankPage() {
  return (
    <PublicPageShell className="pb-20 pt-28">
      <section className="hero-brand text-white">
        <div className="container-px py-14">
          <SectionHeader
            eyebrow="How We Rank"
            title="Verified stats first. Context always."
            description="OnCourt is a Philippine youth basketball rankings platform built around official game data, transparent confidence rules, and scouting context that improves as more verified games are added."
            dark
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <HeroMetric label="Player Rankings" value="Ratings" />
            <HeroMetric label="Team Standings" value="Records" />
            <HeroMetric label="League Context" value="Scope" />
          </div>
        </div>
      </section>

      <section className="container-px grid gap-10 py-10">
        <MethodBlock eyebrow="What OnCourt Ranks" title="Three different views, one verified data layer">
          <div className="grid gap-4 md:grid-cols-3">
            <DefinitionCard title="Player rankings" description="Player rankings use Formula v1 ratings from verified GameStat rows and public eligibility rules." />
            <DefinitionCard title="Team standings" description="Team pages show wins, losses, points for, points allowed, and differential from official Game records." />
            <DefinitionCard title="League context" description="League and game pages show where the performance happened: competition, season, age group, gender, teams, and box score." />
          </div>
        </MethodBlock>

        <MethodBlock eyebrow="Formula v1" title="What the player rating considers">
          <div className="grid gap-3">
            {ratingInputs.map(([title, description]) => <MethodRow key={title} title={title} description={description} />)}
          </div>
        </MethodBlock>

        <MethodBlock eyebrow="Eligibility" title="Minimum verified games">
          <div className="grid gap-4 md:grid-cols-2">
            <ThresholdCard title="Boys rankings" value="10+" description="Current public board threshold across boys age groups." />
            <ThresholdCard title="Girls rankings" value="5+" description="Current public board threshold for girls rankings while the dataset grows." />
          </div>
          <p className="mt-5 max-w-4xl leading-7 text-court-700">
            PlayerRating can exist before a player appears publicly. The public board is intentionally stricter because rankings should not overstate a small sample.
          </p>
        </MethodBlock>

        <MethodBlock eyebrow="Confidence" title="Why more verified data matters">
          <div className="grid gap-3">
            {confidenceRows.map(([title, description]) => <MethodRow key={title} title={title} description={description} />)}
          </div>
        </MethodBlock>

        <MethodBlock eyebrow="Star Bands" title="Rating-to-star guide">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {starBands.map(([rating, stars]) => (
              <div key={rating} className="border border-line-500 bg-white p-4">
                <strong className="block font-display text-stat-sm font-black text-court-900">{rating}</strong>
                <span className="mt-1 block text-xs font-black uppercase tracking-[0.12em] text-hardwood-600">{stars}</span>
              </div>
            ))}
          </div>
        </MethodBlock>

        <MethodBlock eyebrow="Age and Class" title="Development context">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <CopyPanel>
              Class year is the year when the player turns 19 on or before March 31. January-March birth months use birthYear + 19; April-December birth months use birthYear + 20.
            </CopyPanel>
            <CopyPanel>
              Age-group eligibility advances every June 1. U13 covers ages 11-13, U16 covers ages 14-16, and U19 covers ages 17-19. Playing up is visible as context, but carryover ratings are not implemented in Formula v1 yet.
            </CopyPanel>
          </div>
        </MethodBlock>

        <MethodBlock eyebrow="Limitations" title="What the rankings are not">
          <div className="border border-line-500 bg-court-900 p-6 text-white">
            <p className="max-w-5xl leading-7 text-white/76">
              OnCourt rankings are informational. They depend on verified stat availability, complete player identity, accurate team records, and enough games to reduce noise. Formula v1 does not claim perfect scouting evaluation, full schedule-strength modeling, play-by-play context, or future projection. Those layers require more data and calibration.
            </p>
          </div>
        </MethodBlock>
      </section>
    </PublicPageShell>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/15 bg-white/10 p-4">
      <strong className="block font-display text-stat-sm font-black text-white">{value}</strong>
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-white/62">{label}</span>
    </div>
  );
}

function MethodBlock({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-5">
        <SectionHeader eyebrow={eyebrow} title={title} />
      </div>
      {children}
    </section>
  );
}

function DefinitionCard({ title, description }: { title: string; description: string }) {
  return (
    <article className="border border-line-500 bg-white p-5">
      <h2 className="font-display text-2xl font-black leading-tight text-court-900">{title}</h2>
      <p className="mt-3 leading-7 text-court-600">{description}</p>
    </article>
  );
}

function MethodRow({ title, description }: { title: string; description: string }) {
  return (
    <article className="grid gap-3 border border-line-500 bg-white p-5 md:grid-cols-[16rem_1fr] md:items-start">
      <strong className="font-display text-2xl font-black leading-tight text-court-900">{title}</strong>
      <p className="leading-7 text-court-600">{description}</p>
    </article>
  );
}

function ThresholdCard({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <article className="border border-line-500 bg-white p-5">
      <strong className="block font-display text-stat-lg font-black leading-none text-hardwood-600">{value}</strong>
      <h2 className="mt-3 font-display text-2xl font-black text-court-900">{title}</h2>
      <p className="mt-2 leading-7 text-court-600">{description}</p>
    </article>
  );
}

function CopyPanel({ children }: { children: ReactNode }) {
  return <p className="border border-line-500 bg-white p-5 leading-7 text-court-700">{children}</p>;
}
