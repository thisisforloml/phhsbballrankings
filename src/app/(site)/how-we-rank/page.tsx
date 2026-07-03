import type { LucideIcon } from "lucide-react";
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  ChevronDown,
  ClipboardList,
  Eye,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  UserRound,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { InfoPageNav } from "@/components/public/InfoPageNav";
import { PublicPageShell } from "@/components/public/PublicPageShell";

export const metadata: Metadata = {
  title: "How We Rank",
  description:
    "How Peach Basket evaluates players using verified game performance, consistent methodology, and transparent public boards.",
};

const journeySteps = [
  {
    title: "Verified Game",
    description: "An official competition result is reviewed and logged on the platform.",
    Icon: ShieldCheck,
  },
  {
    title: "Official Statistics",
    description: "Box-score stats are attached to players, teams, and the game record.",
    Icon: ClipboardList,
  },
  {
    title: "Performance Evaluation",
    description: "Each game is assessed using the same documented evaluation framework.",
    Icon: BarChart3,
  },
  {
    title: "Player Rating",
    description: "Verified performances roll into a current rating for the player's age and gender board.",
    Icon: TrendingUp,
  },
  {
    title: "National Rankings",
    description: "Eligible players are ordered on public boards with full profile and game history.",
    Icon: Trophy,
  },
];

const evaluationAreas = [
  {
    title: "Scoring",
    description: "How a player contributes points in official games — volume and scoring role matter.",
    Icon: Target,
  },
  {
    title: "Shooting efficiency",
    description: "How effectively a player converts attempts, including missed shots and shot selection context.",
    Icon: Sparkles,
  },
  {
    title: "Playmaking",
    description: "Assists, ball security, and creation that help teammates succeed in verified box scores.",
    Icon: UserRound,
  },
  {
    title: "Rebounding",
    description: "Offensive and defensive board production that extends possessions or ends opponent trips.",
    Icon: ArrowDown,
  },
  {
    title: "Defense",
    description: "Steals, blocks, and defensive events captured in official stat sheets.",
    Icon: ShieldCheck,
  },
  {
    title: "Overall impact",
    description: "The full box-score picture — not one stat line in isolation.",
    Icon: BarChart3,
  },
];

const changeReasons = [
  {
    title: "New verified games",
    description: "Fresh official results add evidence and can shift a player's current rating.",
  },
  {
    title: "Strong or weak outings",
    description: "A standout game or a rough night affects the rolling picture of production.",
  },
  {
    title: "More complete history",
    description: "As verified sample size grows, ratings reflect a fuller view of performance.",
  },
  {
    title: "Competition context",
    description: "Age group, league, season, and opponent context are part of every evaluation.",
  },
  {
    title: "Continuous updates",
    description: "Corrections, reviewed imports, and eligibility changes can update public boards.",
  },
];

const misconceptions = [
  {
    question: "Why isn't the highest scorer ranked #1?",
    answer:
      "Rankings reflect overall verified production and efficiency across official games — not a single scoring total. A high-volume scorer who hurts efficiency or contributes less elsewhere may rate differently than the top point getter in one stretch.",
  },
  {
    question: "Why did my rating decrease?",
    answer:
      "Ratings update as new verified games are added. A weaker recent performance, a growing sample that balances earlier outliers, or corrected data can all move a rating down — even when a player is still improving.",
  },
  {
    question: "Why isn't every game included?",
    answer:
      "Only reviewed official games with valid box-score data count toward public ratings. Unverified results, incomplete stat sheets, and games still under review are excluded until they pass platform review.",
  },
  {
    question: "Can rankings change every week?",
    answer:
      "Yes. When new official games are imported, corrections are approved, or eligibility status changes, public rankings and profiles can update. The platform is a living record — not a one-time list.",
  },
];

const philosophy = [
  {
    title: "Verified before published",
    description: "Game data is reviewed before it shapes ratings, profiles, and national boards.",
    Icon: ShieldCheck,
  },
  {
    title: "Consistency over highlights",
    description: "One viral clip does not outweigh a body of verified box-score work.",
    Icon: Eye,
  },
  {
    title: "Long-term performance matters",
    description: "Rankings reward sustained production across official games — not a single outlier night.",
    Icon: TrendingUp,
  },
  {
    title: "Transparent methodology",
    description: "Eligibility rules, age groups, and evaluation concepts are documented for the public.",
    Icon: ClipboardList,
  },
  {
    title: "Continuous improvement",
    description: "The platform evolves as coverage grows, data quality improves, and policies are refined.",
    Icon: RefreshCw,
  },
];

export default function HowWeRankPage() {
  return (
    <PublicPageShell className="pb-0 pt-0">
      <section className="relative isolate overflow-hidden border-b border-line-500 bg-court-900 pt-28 text-white md:pt-32">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(245,135,10,0.16),transparent_55%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-hardwood-600/60 to-transparent"
        />
        <div className="container-px relative py-12 md:py-20">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-hardwood-500">Methodology</p>
          <h1 className="mt-4 max-w-4xl font-display text-[clamp(2.25rem,5.5vw,4rem)] font-bold leading-[1.02] tracking-tight">
            How Peach Basket Rankings Work
          </h1>
          <p className="mt-6 max-w-2xl text-base font-medium leading-7 text-white/72 md:text-lg">
            Rankings are built from verified game performance and a consistent evaluation methodology — not popularity,
            social reach, or reputation.
          </p>
        </div>
      </section>

      <section className="container-px border-b border-line-500 py-6">
        <InfoPageNav current="how-we-rank" />
      </section>

      <RankSection
        eyebrow="The process"
        title="The ranking journey"
        description="Every public rating follows the same path — from an official game to a place on the national board."
      >
        <RankingJourney />
      </RankSection>

      <RankSection
        eyebrow="Evaluation"
        title="What we evaluate"
        description="Peach Basket looks at the full box-score picture. We do not publish proprietary weights, formulas, or internal tuning."
        className="bg-paper-500/60"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {evaluationAreas.map(({ title, description, Icon }) => (
            <ConceptCard key={title} title={title} description={description} Icon={Icon} />
          ))}
        </div>
        <CalloutPanel title="Public board eligibility" className="mt-8">
          <p>
            National boards list players who meet verified-game thresholds and documented eligibility for their age group
            and gender. Boys boards generally require more verified games than girls boards at launch. U13, U16, and U19
            each maintain separate boys and girls rankings.
          </p>
          <p className="mt-3">
            A player may have a profile before appearing on a national board if they have not yet met the public
            threshold or are outside the selected board.
          </p>
        </CalloutPanel>
      </RankSection>

      <RankSection
        eyebrow="Movement"
        title="Why rankings change"
        description="Ratings and board positions are not frozen — they respond to new evidence and platform updates."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {changeReasons.map(({ title, description }) => (
            <article key={title} className="rounded-sm border border-line-500 bg-white p-5 shadow-sm">
              <h3 className="font-display text-base font-bold text-court-900">{title}</h3>
              <p className="mt-2 text-sm font-medium leading-6 text-court-600">{description}</p>
            </article>
          ))}
        </div>
      </RankSection>

      <RankSection
        eyebrow="Clarity"
        title="Common misconceptions"
        description="Straight answers to the questions players, parents, and coaches ask most often."
        className="bg-paper-500/60"
      >
        <div className="mx-auto max-w-3xl divide-y divide-line-500 rounded-sm border border-line-500 bg-white shadow-sm">
          {misconceptions.map(({ question, answer }) => (
            <details key={question} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left font-display text-base font-bold text-court-900 marker:content-none hover:bg-paper-500/50 [&::-webkit-details-marker]:hidden">
                {question}
                <ChevronDown
                  className="h-5 w-5 shrink-0 text-court-500 transition group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="border-t border-line-500 px-5 py-4 text-sm font-medium leading-6 text-court-600">
                {answer}
              </p>
            </details>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-3xl text-center text-sm font-medium text-court-500">
          More questions?{" "}
          <Link href="/faqs" className="font-bold text-hardwood-600 hover:underline">
            Read the full FAQ
          </Link>
        </p>
      </RankSection>

      <RankSection eyebrow="Principles" title="Our philosophy" description="What guides every rating on Peach Basket.">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {philosophy.map(({ title, description, Icon }) => (
            <PhilosophyCard key={title} title={title} description={description} Icon={Icon} />
          ))}
        </div>
      </RankSection>

      <section className="border-t border-line-500 bg-court-900 py-16 text-white md:py-24">
        <div className="container-px mx-auto max-w-3xl text-center">
          <h2 className="font-display text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-tight">
            More transparent, data-informed evaluation
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/72 md:text-lg">
            Peach Basket is committed to making basketball evaluation clearer for players, families, coaches, recruiters,
            and organizers — grounded in verified games and consistent public standards.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-7 text-white/55">
            Rankings are informational. They do not guarantee recruitment, scholarships, team selection, or future
            performance.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/rankings" className="button primary px-5 py-2.5 text-xs tracking-[0.1em]">
              Explore Rankings
            </Link>
            <Link
              href="/players/search"
              className="button secondary border-white/20 bg-transparent px-5 py-2.5 text-xs tracking-[0.1em] text-white hover:bg-white/10"
            >
              View Player Profiles
            </Link>
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}

function RankSection({
  eyebrow,
  title,
  description,
  children,
  className = "",
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`section-y ${className}`}>
      <div className="container-px">
        <div className="mx-auto mb-10 max-w-3xl md:mb-12">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-hardwood-600">{eyebrow}</p>
          <h2 className="mt-2 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold leading-tight text-court-900">
            {title}
          </h2>
          <p className="mt-4 text-base font-medium leading-7 text-court-600">{description}</p>
        </div>
        {children}
      </div>
    </section>
  );
}

function RankingJourney() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col gap-3 md:hidden">
        {journeySteps.map((step, index) => (
          <div key={step.title}>
            <JourneyStepCard {...step} step={index + 1} />
            {index < journeySteps.length - 1 ? (
              <div className="flex justify-center py-1 text-hardwood-600" aria-hidden="true">
                <ArrowDown className="h-5 w-5" />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="hidden items-stretch gap-2 md:flex">
        {journeySteps.map((step, index) => (
          <div key={step.title} className="flex min-w-0 flex-1 items-stretch">
            <JourneyStepCard {...step} step={index + 1} className="flex-1" />
            {index < journeySteps.length - 1 ? (
              <div className="flex w-8 shrink-0 items-center justify-center text-hardwood-600" aria-hidden="true">
                <ArrowRight className="h-5 w-5" />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function JourneyStepCard({
  step,
  title,
  description,
  Icon,
  className = "",
}: {
  step: number;
  title: string;
  description: string;
  Icon: LucideIcon;
  className?: string;
}) {
  return (
    <article
      className={`flex flex-col rounded-sm border border-line-500 bg-white p-4 shadow-sm ${className}`}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-court-900 text-xs font-bold text-hardwood-500">
          {step}
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-paper-500 text-hardwood-600">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
      <h3 className="mt-3 font-display text-sm font-bold leading-tight text-court-900 md:text-base">{title}</h3>
      <p className="mt-2 flex-1 text-xs font-medium leading-5 text-court-600 md:text-sm md:leading-6">
        {description}
      </p>
    </article>
  );
}

function ConceptCard({
  title,
  description,
  Icon,
}: {
  title: string;
  description: string;
  Icon: LucideIcon;
}) {
  return (
    <article className="rounded-sm border border-line-500 bg-white p-5 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-court-900 text-hardwood-500">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 font-display text-lg font-bold text-court-900">{title}</h3>
      <p className="mt-2 text-sm font-medium leading-6 text-court-600">{description}</p>
    </article>
  );
}

function PhilosophyCard({
  title,
  description,
  Icon,
}: {
  title: string;
  description: string;
  Icon: LucideIcon;
}) {
  return (
    <article className="flex h-full flex-col rounded-sm border border-line-500 bg-white p-5 shadow-sm">
      <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-line-500 text-hardwood-600">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <h3 className="mt-4 font-display text-base font-bold text-court-900">{title}</h3>
      <p className="mt-2 text-sm font-medium leading-6 text-court-600">{description}</p>
    </article>
  );
}

function CalloutPanel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={`rounded-sm border-l-4 border-hardwood-600 bg-white p-6 shadow-sm ${className}`}
    >
      <h3 className="font-display text-lg font-bold text-court-900">{title}</h3>
      <div className="mt-3 text-sm font-medium leading-6 text-court-600">{children}</div>
    </aside>
  );
}
