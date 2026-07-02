import type { ReactNode } from "react";

import { PublicPageShell } from "@/components/public/PublicPageShell";

export const metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for Peach Basket Rankings PH."
};

const lastUpdated = "Last updated: [Month Day, Year]";

export default function PrivacyPage() {
  return (
    <PublicPageShell className="pb-20 pt-28">
      <article className="container-px mx-auto max-w-4xl py-10">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-hardwood-600">{lastUpdated}</p>
        <h1 className="mt-3 font-display text-4xl font-bold leading-tight text-court-900 md:text-5xl">Privacy Policy</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-court-700">
          Peach Basket Rankings PH is a basketball player visibility and rankings platform. This policy explains how we collect, use, review, display, and protect information connected to accounts, submissions, players, teams, leagues, and game statistics.
        </p>

        <div className="mt-8 grid gap-7">
          <PolicySection title="Who We Are">
            <p>Peach Basket Rankings PH is operated by [Legal/Business Name Placeholder]. For privacy questions, correction requests, or youth athlete data concerns, contact [privacy@oncourtrankings.ph].</p>
          </PolicySection>

          <PolicySection title="Information We Collect">
            <List>
              <li>Account and contact information from users, organizers, administrators, coaches, and other authorized representatives.</li>
              <li>Uploaded files and submitted game data, including box scores, stat sheets, CSV/XLSX files, JSON files, rosters, notes, and supporting documents.</li>
              <li>Player profile fields such as name, school/team/program, age group, year of birth where available and appropriate, city/region, height, position, class year, rankings, ratings, game logs, and competition history.</li>
              <li>Team, program, league, competition, schedule, score, and game-stat information.</li>
              <li>Usage, log, security, device, and technical information needed to operate and protect the platform.</li>
            </List>
          </PolicySection>

          <PolicySection title="Where Data Comes From">
            <p>Data may come from leagues, organizers, official stat sheets, submitted box scores, public or official competition sources where applicable, administrator-entered corrections, and review workflows used to improve data quality.</p>
          </PolicySection>

          <PolicySection title="How We Use Information">
            <List>
              <li>Operate player rankings, team rankings, player profiles, team profiles, game logs, league pages, and box-score analytics.</li>
              <li>Review, validate, normalize, import, and correct submitted statistics and uploaded files.</li>
              <li>Prevent duplicate player/team records and improve data quality.</li>
              <li>Communicate with organizers, account holders, and authorized representatives.</li>
              <li>Maintain platform security, prevent misuse, and troubleshoot technical issues.</li>
            </List>
          </PolicySection>

          <PolicySection title="Public Visibility">
            <p>Rankings, player profiles, team profiles, league context, game results, and game statistics may be publicly visible. Sensitive account information, passwords, private contact details, and internal administrative notes are not intended for public display.</p>
          </PolicySection>

          <PolicySection title="Youth Athlete Data">
            <p>Because Peach Basket Rankings PH includes youth and high school basketball data, we aim to limit public profiles to sports-relevant information. We prefer year of birth over full birthdate for public display where age context is needed, avoid unnecessary sensitive data, and take correction or removal requests from parents, guardians, schools, coaches, players, and authorized representatives seriously.</p>
          </PolicySection>

          <PolicySection title="Data Retention">
            <p>Account information is generally retained while an account remains active or as needed for platform operations. Game and stat records may be retained for historical, competition, audit, and ranking integrity unless correction, blocking, or removal is justified. Uploaded files may be retained for review and audit purposes unless deleted under a retention policy or approved request.</p>
          </PolicySection>

          <PolicySection title="Rights and Requests">
            <p>Depending on applicable law, individuals may request access, correction, deletion, blocking, objection, withdrawal of consent where applicable, or review of published data. Requests may require identity or authority verification, especially when youth athlete data is involved.</p>
          </PolicySection>

          <PolicySection title="Security and Service Providers">
            <p>We use reasonable technical and organizational safeguards, restricted administrative access, and review workflows to protect information. We may use third-party providers for hosting, databases, analytics/logging, email, authentication, storage, or similar operations. We do not promise perfect security, but we work to protect the platform and respond responsibly to issues.</p>
          </PolicySection>

          <PolicySection title="Contact">
            <p>Privacy contact: [privacy@oncourtrankings.ph]. Business/legal name: [Legal/Business Name Placeholder].</p>
          </PolicySection>
        </div>
      </article>
    </PublicPageShell>
  );
}

function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="border-b border-line-500 pb-2 font-display text-2xl font-bold leading-tight text-court-900">{title}</h2>
      <div className="mt-3 grid gap-3 leading-7 text-court-700">{children}</div>
    </section>
  );
}

function List({ children }: { children: ReactNode }) {
  return <ul className="grid gap-2 pl-5 marker:text-hardwood-600 [&>li]:list-disc">{children}</ul>;
}
