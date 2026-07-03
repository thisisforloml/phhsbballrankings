import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ChevronDown,
  Database,
  HelpCircle,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { InfoPageNav } from "@/components/public/InfoPageNav";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { publicRankingsCoverageCopy } from "@/lib/public-rankings-coverage";

export const metadata: Metadata = {
  title: "FAQs",
  description:
    "Answers to common questions about Peach Basket rankings, player profiles, verified games, teams, and upcoming features.",
};

type FaqItem = {
  question: string;
  answer: ReactNode;
};

type FaqCategory = {
  id: string;
  title: string;
  description: string;
  Icon: LucideIcon;
  items: FaqItem[];
};

const categories: FaqCategory[] = [
  {
    id: "rankings",
    title: "Rankings",
    description: "How national boards work and why positions change.",
    Icon: Trophy,
    items: [
      {
        question: "How are players ranked?",
        answer: (
          <>
            Players are rated from verified box-score performance in official games, then ordered on public national
            boards by age group and gender. See{" "}
            <Link href="/how-we-rank" className="font-bold text-hardwood-600 hover:underline">
              How We Rank
            </Link>{" "}
            for the full overview — without proprietary formula details.
          </>
        ),
      },
      {
        question: "Why isn't the highest scorer ranked #1?",
        answer:
          "Rankings reflect overall verified production and efficiency across games — not a single scoring total. Defense, playmaking, rebounding, shooting efficiency, and availability all contribute to the public rating.",
      },
      {
        question: "Can rankings change?",
        answer:
          "Yes. When new official games are imported, performances are re-evaluated and public boards can update. Rankings are a living record — not a one-time list.",
      },
      {
        question: "Why did my ranking change?",
        answer:
          "Common reasons include new verified games, a recent strong or weak outing, a growing sample that balances earlier results, corrected data, or eligibility changes on your age and gender board.",
      },
      {
        question: "Why is a player missing from the national board?",
        answer:
          "They may not yet meet verified-game thresholds for that board (U19 Boys generally need 10+ verified games; U19 Girls need 5+), may be outside the selected age group, may have graduated from U19 eligibility, or may still be under data review.",
      },
      {
        question: "How do age groups work?",
        answer:
          "Public boards are organized by U13, U16, and U19 with separate boys and girls rankings. Eligibility uses calendar age as of the evaluation date. U19 athletes leave active boards starting June 1 of their class year.",
      },
    ],
  },
  {
    id: "profiles",
    title: "Player Profiles",
    description: "Photos, bios, corrections, and update timing.",
    Icon: UserRound,
    items: [
      {
        question: "Why doesn't every player have a profile?",
        answer:
          "Profiles are created from verified game participation. If a player has not yet appeared in reviewed official box scores on the platform, they may not have a public dossier.",
      },
      {
        question: "Why doesn't every player have a photo?",
        answer:
          "Photos are added when verified images are available — through imports, admin review, or approved submissions. Many early records were built from stat sheets first; photos are still being completed across the database.",
      },
      {
        question: "Can I request corrections?",
        answer: (
          <>
            Yes. Players, parents or guardians, coaches, schools, and organizers can request review when names, teams,
            stats, or bio fields are inaccurate. Use{" "}
            <Link href="/players/submit-info" className="font-bold text-hardwood-600 hover:underline">
              Submit profile info
            </Link>{" "}
            or reach out through Peach Basket&apos;s contact channels.
          </>
        ),
      },
      {
        question: "How often are profiles updated?",
        answer:
          "Profiles update when new verified games are published, corrections are approved, or admin-reviewed bio changes are applied. There is no fixed public schedule — updates follow official data imports and review.",
      },
    ],
  },
  {
    id: "verified-games",
    title: "Verified Games",
    description: "What counts on Peach Basket and how stats are reviewed.",
    Icon: ShieldCheck,
    items: [
      {
        question: "What is a verified game?",
        answer:
          "A verified game is an official competition result with reviewed box-score data logged on Peach Basket. Unverified uploads, incomplete stat sheets, and games still under review are not used for public ratings until they pass platform review.",
      },
      {
        question: "Why aren't all leagues included?",
        answer:
          "Coverage grows as organizers partner with Peach Basket and submit official results for review. Not every competition in the Philippines is in the database yet — inclusion depends on verified imports and data quality.",
      },
      {
        question: "How are statistics verified?",
        answer:
          "Stat sheets and game files go through admin review before they become official records. Names, teams, scores, and player lines are checked for consistency before games affect ratings, profiles, and standings.",
      },
    ],
  },
  {
    id: "teams-leagues",
    title: "Teams & Leagues",
    description: "Getting competitions and programs onto the platform.",
    Icon: Building2,
    items: [
      {
        question: "How can a league be included?",
        answer: (
          <>
            Tournament organizers and league operators can partner with Peach Basket to submit official results for
            review. Start at the{" "}
            <Link href="/partner" className="font-bold text-hardwood-600 hover:underline">
              league partnership page
            </Link>{" "}
            or contact Peach Basket through the channels listed in the site footer.
          </>
        ),
      },
      {
        question: "Can schools submit games?",
        answer:
          "School and club programs typically work through their league or tournament organizer, who submits official results for platform review. Direct school submissions may be coordinated through Peach Basket admin when appropriate.",
      },
      {
        question: "Why is my team missing?",
        answer:
          "The team may not yet be linked to a reviewed import, may use a different name in stat sheets, or may belong to a competition not yet on the platform. Contact your organizer or Peach Basket if you believe official games were omitted.",
      },
    ],
  },
  {
    id: "data-updates",
    title: "Data & Updates",
    description: "What Peach Basket does and does not promise.",
    Icon: Database,
    items: [
      {
        question: "Do rankings guarantee recruitment or scholarships?",
        answer:
          "No. Rankings and ratings are informational. They do not guarantee recruitment, scholarships, team selection, playing time, or future performance.",
      },
      {
        question: "What happens when new official games are added?",
        answer:
          "New verified games can update player ratings, national board order, team standings, and profile game logs. The public site reflects the latest reviewed official record.",
      },
      {
        question: "Can rankings update after corrections?",
        answer:
          "Yes. Approved fixes to names, teams, duplicate records, or stat errors can change ratings, board placement, and profile history. Peach Basket preserves review trails for sensitive corrections.",
      },
    ],
  },
  {
    id: "future",
    title: "Future Features",
    description: "What is on the roadmap — without fixed launch dates.",
    Icon: Sparkles,
    items: [
      {
        question: "What features are coming soon?",
        answer: (
          <>
            Active development includes broader age-group board coverage ({publicRankingsCoverageCopy.plannedLabel.toLowerCase()}),
            verified highlight embeds on profiles, and the profile claim workflow. Coverage and features roll out as
            verified game volume and review capacity grow.
          </>
        ),
      },
      {
        question: "Will player comparison be available?",
        answer: (
          <>
            Yes — a{" "}
            <Link href="/players/compare" className="font-bold text-hardwood-600 hover:underline">
              player comparison
            </Link>{" "}
            tool is already available for side-by-side review. Additional analytics and chart overlays are planned as the
            platform matures.
          </>
        ),
      },
      {
        question: "Will recruiting tools be added?",
        answer:
          "Peach Basket already supports U19 class-year filtering on rankings where enabled, and continues to build recruiting context around verified competition history. Deeper recruiting views are planned without changing how national rank is calculated.",
      },
      {
        question: "Will players eventually be able to claim their profiles?",
        answer: (
          <>
            Yes. Profile claiming is in development — the public{" "}
            <Link href="/claim" className="font-bold text-hardwood-600 hover:underline">
              Claim Profile
            </Link>{" "}
            flow will open after the review workflow is ready. Claim buttons remain visible on profiles in preparation
            for that launch.
          </>
        ),
      },
    ],
  },
];

export default function FaqsPage() {
  return (
    <PublicPageShell className="pb-0 pt-0">
      <section className="relative isolate overflow-hidden border-b border-line-500 bg-court-900 pt-28 text-white md:pt-32">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,135,10,0.14),transparent_55%)]"
        />
        <div className="container-px relative py-12 md:py-20">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-hardwood-500">Help Center</p>
          <h1 className="mt-4 max-w-3xl font-display text-[clamp(2.25rem,5.5vw,4rem)] font-bold leading-[1.02] tracking-tight">
            Frequently Asked Questions
          </h1>
          <p className="mt-6 max-w-2xl text-base font-medium leading-7 text-white/72 md:text-lg">
            Quick answers about rankings, player profiles, verified games, teams, and how Peach Basket works — for
            players, families, coaches, recruiters, and organizers.
          </p>
        </div>
      </section>

      <section className="container-px border-b border-line-500 py-6">
        <InfoPageNav current="faqs" />
      </section>

      <section className="container-px section-y">
        <div className="mx-auto max-w-5xl">
          <CalloutBox
            title="New to Peach Basket?"
            Icon={HelpCircle}
          >
            Peach Basket is a public Philippine youth basketball database — verified game data, national rankings, player
            profiles, team standings, and league coverage in one place.{" "}
            <Link href="/about" className="font-bold text-hardwood-600 hover:underline">
              Read About Peach Basket
            </Link>
          </CalloutBox>

          <nav aria-label="FAQ categories" className="mt-10 flex flex-wrap gap-2">
            {categories.map(({ id, title, Icon }) => (
              <a
                key={id}
                href={`#${id}`}
                className="inline-flex items-center gap-2 rounded-sm border border-line-500 bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-court-700 transition hover:border-hardwood-600 hover:text-hardwood-600"
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {title}
              </a>
            ))}
          </nav>

          <div className="mt-10 grid gap-10">
            {categories.map((category) => (
              <FaqCategorySection key={category.id} category={category} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line-500 bg-paper-500/80 py-16 md:py-20">
        <div className="container-px mx-auto max-w-3xl">
          <article className="rounded-sm border border-line-500 bg-white p-8 shadow-sm md:p-10">
            <div className="flex h-11 w-11 items-center justify-center rounded-sm bg-court-900 text-hardwood-500">
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="mt-5 font-display text-2xl font-bold text-court-900">Need more help?</h2>
            <p className="mt-3 text-sm font-medium leading-6 text-court-600 md:text-base">
              If you cannot find an answer here, reach out to Peach Basket. Include the player, team, or game in
              question so we can route your request.
            </p>
            <ul className="mt-6 grid gap-3 text-sm font-medium text-court-700 sm:grid-cols-2">
              <li>
                <a
                  href="https://wa.me/639762165301"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-hardwood-600 hover:underline"
                >
                  WhatsApp
                </a>{" "}
                · player and parent questions
              </li>
              <li>
                <Link href="/partner" className="font-bold text-hardwood-600 hover:underline">
                  League partnership
                </Link>{" "}
                · organizer and league inclusion
              </li>
              <li>
                <Link href="/players/submit-info" className="font-bold text-hardwood-600 hover:underline">
                  Submit profile info
                </Link>{" "}
                · bio and correction requests
              </li>
              <li>
                <Link href="/how-we-rank" className="font-bold text-hardwood-600 hover:underline">
                  How We Rank
                </Link>{" "}
                · methodology overview
              </li>
            </ul>
          </article>
        </div>
      </section>
    </PublicPageShell>
  );
}

function FaqCategorySection({ category }: { category: FaqCategory }) {
  const { id, title, description, Icon, items } = category;

  return (
    <section id={id} className="scroll-mt-28">
      <div className="mb-5 flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-court-900 text-hardwood-500">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold text-court-900">{title}</h2>
          <p className="mt-1 text-sm font-medium text-court-600">{description}</p>
        </div>
      </div>

      <div className="divide-y divide-line-500 rounded-sm border border-line-500 bg-white shadow-sm">
        {items.map((item) => (
          <FaqAccordion key={item.question} question={item.question} answer={item.answer} />
        ))}
      </div>
    </section>
  );
}

function FaqAccordion({ question, answer }: FaqItem) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left font-display text-base font-bold text-court-900 marker:content-none hover:bg-paper-500/50 [&::-webkit-details-marker]:hidden">
        {question}
        <ChevronDown
          className="h-5 w-5 shrink-0 text-court-500 transition group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="border-t border-line-500 px-5 py-4 text-sm font-medium leading-6 text-court-600">{answer}</div>
    </details>
  );
}

function CalloutBox({
  title,
  children,
  Icon,
}: {
  title: string;
  children: ReactNode;
  Icon: LucideIcon;
}) {
  return (
    <aside className="rounded-sm border-l-4 border-hardwood-600 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-paper-500 text-hardwood-600">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <h2 className="font-display text-lg font-bold text-court-900">{title}</h2>
      </div>
      <p className="mt-3 text-sm font-medium leading-6 text-court-600">{children}</p>
    </aside>
  );
}
