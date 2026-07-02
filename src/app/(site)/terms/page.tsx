import type { ReactNode } from "react";

import { PublicPageShell } from "@/components/public/PublicPageShell";

export const metadata = {
  title: "Terms of Use",
  description: "Terms of Use for Peach Basket Rankings PH."
};

const lastUpdated = "Last updated: [Month Day, Year]";

export default function TermsPage() {
  return (
    <PublicPageShell className="pb-20 pt-28">
      <article className="container-px mx-auto max-w-4xl py-10">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-hardwood-600">{lastUpdated}</p>
        <h1 className="mt-3 font-display text-4xl font-bold leading-tight text-court-900 md:text-5xl">Terms of Use</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-court-700">
          These Terms govern access to and use of Peach Basket Rankings PH. By using the platform, creating an account, submitting data, or viewing rankings and profiles, you agree to these Terms.
        </p>

        <div className="mt-8 grid gap-7">
          <TermsSection title="Platform Purpose">
            <p>Peach Basket Rankings PH provides informational basketball rankings, profiles, game logs, box-score analytics, and team/league context from official, organizer-submitted, and admin-reviewed game data. The platform does not guarantee recruitment, scholarships, selection, playing time, endorsements, or athletic outcomes.</p>
          </TermsSection>

          <TermsSection title="Accounts">
            <p>Account holders are responsible for providing accurate information, protecting login credentials, and using the platform only for authorized purposes. Peach Basket Rankings PH may suspend or restrict accounts that misuse the service or submit unauthorized information.</p>
          </TermsSection>

          <TermsSection title="Organizer and Stat Submitter Responsibilities">
            <List>
              <li>You must have authority to submit game, player, team, league, or competition data.</li>
              <li>You must make reasonable efforts to submit accurate, complete, and non-misleading statistics.</li>
              <li>You must not upload malicious, false, defamatory, infringing, private, or unauthorized content.</li>
              <li>You must not misuse youth athlete information or submit data in a way that creates safety, privacy, or integrity concerns.</li>
            </List>
          </TermsSection>

          <TermsSection title="Data Review and Corrections">
            <p>Peach Basket Rankings PH may review, normalize, edit, reject, hide, remove, or correct submitted data. Users, parents/guardians, schools, coaches, organizers, and authorized representatives may request corrections. Rankings, ratings, records, and profiles may change after corrections, imports, duplicate cleanup, or methodology updates.</p>
          </TermsSection>

          <TermsSection title="Ratings and Rankings">
            <p>Ratings and rankings are analytical estimates based on available game data. They are not subjective scouting promises, guarantees, or final judgments of athlete potential. Peach Basket Rankings PH may publish high-level methodology while keeping proprietary implementation details, internal weights, constants, and code confidential. The methodology may evolve over time.</p>
          </TermsSection>

          <TermsSection title="Prohibited Uses">
            <List>
              <li>Scraping, crawling, bulk extraction, resale, or commercial reuse without written permission.</li>
              <li>Impersonation, harassment, intimidation, or misuse of athlete data.</li>
              <li>False submissions, unauthorized access, attempts to bypass security, or interference with platform operations.</li>
              <li>Uploading malware, harmful files, or content that violates rights, privacy, or applicable law.</li>
            </List>
          </TermsSection>

          <TermsSection title="Intellectual Property and Submitted Data">
            <p>Peach Basket Rankings PH branding, user interface, ranking presentation, methodology, analytics structure, and platform materials are protected. Submitters retain whatever rights they have in submitted data, but grant Peach Basket Rankings PH permission to receive, process, normalize, analyze, display, publish, correct, and retain that data for platform operations, rankings, profiles, analytics, and competition records.</p>
          </TermsSection>

          <TermsSection title="Disclaimers and Limitation of Liability">
            <p>The platform is provided as-is and as available. Data may contain errors, omissions, delays, or disputed records. Peach Basket Rankings PH does not guarantee uninterrupted availability, perfect accuracy, or any recruitment, scholarship, or competitive outcome. To the extent allowed by law, Peach Basket Rankings PH is not liable for indirect, incidental, consequential, or special damages arising from use of the platform.</p>
          </TermsSection>

          <TermsSection title="Suspension, Removal, and Governing Law">
            <p>Peach Basket Rankings PH may suspend accounts, remove content, or restrict access when needed for accuracy, privacy, safety, legal compliance, or platform integrity. These Terms are intended to be governed by the laws of the Philippines unless final legal counsel advises otherwise.</p>
          </TermsSection>

          <TermsSection title="Contact">
            <p>Questions or concerns: [support@oncourtrankings.ph]. Business/legal name: [Legal/Business Name Placeholder].</p>
          </TermsSection>
        </div>
      </article>
    </PublicPageShell>
  );
}

function TermsSection({ title, children }: { title: string; children: ReactNode }) {
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
