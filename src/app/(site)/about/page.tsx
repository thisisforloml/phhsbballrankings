import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  ClipboardCheck,
  Eye,
  GraduationCap,
  Heart,
  LineChart,
  Medal,
  Scale,
  School,
  ShieldCheck,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { InfoPageNav } from "@/components/public/InfoPageNav";
import { PublicPageShell } from "@/components/public/PublicPageShell";

export const metadata: Metadata = {
  title: "About Peach Basket",
  description:
    "Peach Basket is the public home for verified Philippine youth basketball rankings, player profiles, game data, and league coverage.",
};

const challenges = [
  {
    title: "Fragmented competition",
    description:
      "Tournaments, school leagues, and club circuits often live in separate silos — hard to compare players across regions or seasons.",
    Icon: Users,
  },
  {
    title: "Limited visibility",
    description:
      "Strong performances in smaller competitions rarely reach coaches, recruiters, or families outside the immediate program.",
    Icon: Eye,
  },
  {
    title: "Inconsistent evaluation",
    description:
      "Without shared standards, talent gets judged on reputation, highlights, or word of mouth instead of verified production.",
    Icon: Scale,
  },
  {
    title: "No central verified record",
    description:
      "Box scores, rosters, and results are scattered — making it difficult to build a credible public history for any athlete.",
    Icon: ClipboardCheck,
  },
];

const platformFeatures = [
  {
    title: "National Rankings",
    description: "Public boards by age group and gender, built from reviewed game data and documented eligibility rules.",
    href: "/rankings",
    Icon: Trophy,
  },
  {
    title: "Player Profiles",
    description: "Searchable dossiers with ratings, game logs, competition context, and performance trends over time.",
    href: "/players/search",
    Icon: UserRound,
  },
  {
    title: "Verified Game Data",
    description: "Official box scores and game results reviewed before they become part of the public record.",
    href: "/games",
    Icon: ShieldCheck,
  },
  {
    title: "Performance Analytics",
    description: "Rolling trends, benchmarks, and rating methodology that explain how production translates into rankings.",
    href: "/how-we-rank",
    Icon: LineChart,
  },
  {
    title: "League Coverage",
    description: "League and team directories that connect competitions, standings, and the players who compete in them.",
    href: "/leagues",
    Icon: Medal,
  },
];

const beneficiaries = [
  {
    title: "Players",
    description: "A public profile backed by verified games — not just clips or social reach.",
    Icon: UserRound,
  },
  {
    title: "Parents",
    description: "Clear context on where their athlete plays, how they are rated, and what data supports those rankings.",
    Icon: Heart,
  },
  {
    title: "Coaches",
    description: "Roster history, competition splits, and trend lines to support development and recruiting conversations.",
    Icon: GraduationCap,
  },
  {
    title: "Schools",
    description: "Program visibility tied to official results and the athletes representing the school on court.",
    Icon: School,
  },
  {
    title: "Recruiters",
    description: "Searchable national boards with eligibility signals and consistent player dossiers across competitions.",
    Icon: BarChart3,
  },
  {
    title: "Leagues",
    description: "A trusted public record after reviewed imports — helping organizers showcase verified competition.",
    Icon: Building2,
  },
  {
    title: "Basketball fans",
    description: "One place to follow rankings, games, teams, and the next generation of Philippine talent.",
    Icon: Users,
  },
];

const principles = [
  {
    title: "Verified before published",
    description: "Game data is reviewed before it shapes public rankings, profiles, and standings.",
    Icon: ShieldCheck,
  },
  {
    title: "Data over popularity",
    description: "Ratings reflect box-score production in official games — not hype, followers, or self-reported stats.",
    Icon: BarChart3,
  },
  {
    title: "Consistent methodology",
    description: "Documented formulas, eligibility rules, and age groups so numbers mean the same thing everywhere.",
    Icon: Scale,
  },
  {
    title: "Transparent rankings",
    description: "Users can read how ratings work, what qualifies a player for a board, and what each label represents.",
    Icon: Eye,
  },
  {
    title: "Athlete-first platform",
    description: "The product is built so Filipino youth players gain visibility through credible competition history.",
    Icon: Heart,
  },
];

export default function AboutPage() {
  return (
    <PublicPageShell className="pb-0 pt-0">
      <section className="relative isolate overflow-hidden border-b border-line-500 bg-court-900 pt-28 text-white md:pt-32">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,135,10,0.18),transparent_55%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 top-1/2 hidden h-72 w-72 -translate-y-1/2 rounded-full border border-white/10 md:block"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-hardwood-600/60 to-transparent"
        />
        <div className="container-px relative py-12 md:py-20">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-hardwood-500">About Peach Basket</p>
          <h1 className="mt-4 max-w-4xl font-display text-[clamp(2.25rem,5.5vw,4rem)] font-bold leading-[1.02] tracking-tight">
            Philippine youth basketball,
            <span className="text-hardwood-500"> made visible.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base font-medium leading-7 text-white/72 md:text-lg">
            Peach Basket is the public home for verified rankings, player profiles, game logs, and league coverage —
            built so talent across the Philippines can be discovered through credible competition data.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/rankings" className="button primary px-5 py-2.5 text-xs tracking-[0.1em]">
              View Rankings
            </Link>
            <Link href="/how-we-rank" className="button secondary border-white/20 bg-white/10 px-5 py-2.5 text-xs tracking-[0.1em] text-white hover:bg-white/15">
              How We Rank
            </Link>
          </div>
        </div>
      </section>

      <section className="container-px border-b border-line-500 py-6">
        <InfoPageNav current="about" />
      </section>

      <AboutSection
        eyebrow="The problem"
        title="Why Peach Basket exists"
        description="Philippine youth basketball is full of talent — but the information about that talent is often scattered, uneven, and hard to trust at scale."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {challenges.map(({ title, description, Icon }) => (
            <ChallengeCard key={title} title={title} description={description} Icon={Icon} />
          ))}
        </div>
      </AboutSection>

      <AboutSection
        eyebrow="The platform"
        title="What Peach Basket does"
        description="One database for the public record of youth basketball — from national boards to individual game logs."
        className="bg-paper-500/60"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {platformFeatures.map(({ title, description, href, Icon }) => (
            <FeatureCard key={title} title={title} description={description} href={href} Icon={Icon} />
          ))}
        </div>
      </AboutSection>

      <AboutSection
        eyebrow="Who it's for"
        title="Who benefits"
        description="Peach Basket serves everyone invested in Philippine youth basketball — from the athlete on the floor to the organizer running the competition."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {beneficiaries.map(({ title, description, Icon }) => (
            <AudienceCard key={title} title={title} description={description} Icon={Icon} />
          ))}
        </div>
      </AboutSection>

      <AboutSection
        eyebrow="How we operate"
        title="Our principles"
        description="These guide every ranking, profile, and import on the platform."
        className="bg-paper-500/60"
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {principles.map((item, index) => (
            <PrincipleCard key={item.title} index={index + 1} {...item} />
          ))}
        </div>
      </AboutSection>

      <section className="border-t border-line-500 bg-court-900 py-16 text-white md:py-24">
        <div className="container-px mx-auto max-w-4xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-hardwood-500">Our vision</p>
          <h2 className="mt-4 font-display text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-tight">
            The trusted basketball intelligence platform for the Philippines
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/72 md:text-lg">
            We are building a national record where every verified game adds context — so players from every region can
            be discovered, evaluated fairly, and supported through data that coaches, families, recruiters, and fans can
            trust.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-7 text-white/55">
            Peach Basket does not replace coaching, scouting, or player development. It gives the ecosystem cleaner
            evidence: who played, where they played, and how they produced in official competition.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/rankings" className="button primary px-5 py-2.5 text-xs tracking-[0.1em]">
              Explore Rankings
            </Link>
            <Link href="/faqs" className="button secondary border-white/20 bg-transparent px-5 py-2.5 text-xs tracking-[0.1em] text-white hover:bg-white/10">
              Read FAQs
            </Link>
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}

function AboutSection({
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

function ChallengeCard({
  title,
  description,
  Icon,
}: {
  title: string;
  description: string;
  Icon: LucideIcon;
}) {
  return (
    <article className="rounded-sm border border-line-500 bg-white p-6 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-paper-500 text-hardwood-600">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 font-display text-lg font-bold text-court-900">{title}</h3>
      <p className="mt-2 text-sm font-medium leading-6 text-court-600">{description}</p>
    </article>
  );
}

function FeatureCard({
  title,
  description,
  href,
  Icon,
}: {
  title: string;
  description: string;
  href: string;
  Icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-sm border border-line-500 bg-white p-6 shadow-sm transition hover:border-hardwood-600/40 hover:shadow-md"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-court-900 text-hardwood-500 transition group-hover:bg-hardwood-600 group-hover:text-white">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 font-display text-lg font-bold text-court-900">{title}</h3>
      <p className="mt-2 flex-1 text-sm font-medium leading-6 text-court-600">{description}</p>
      <span className="mt-4 text-xs font-bold uppercase tracking-[0.1em] text-hardwood-600 group-hover:underline">
        Learn more →
      </span>
    </Link>
  );
}

function AudienceCard({
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
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-paper-500 text-court-900">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <h3 className="font-display text-base font-bold text-court-900">{title}</h3>
      </div>
      <p className="mt-3 text-sm font-medium leading-6 text-court-600">{description}</p>
    </article>
  );
}

function PrincipleCard({
  index,
  title,
  description,
  Icon,
}: {
  index: number;
  title: string;
  description: string;
  Icon: LucideIcon;
}) {
  return (
    <article className="relative overflow-hidden rounded-sm border border-line-500 bg-white p-6 shadow-sm">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-2 -top-4 font-display text-7xl font-bold leading-none text-court-900/[0.04]"
      >
        {index}
      </span>
      <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-line-500 text-hardwood-600">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 font-display text-lg font-bold text-court-900">{title}</h3>
      <p className="mt-2 text-sm font-medium leading-6 text-court-600">{description}</p>
    </article>
  );
}
