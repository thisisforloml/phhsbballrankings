import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Careers · Peach Basket Rankings PH",
  description: "Open roles for Peach Basket Rankings PH."
};

const roles = [
  {
    title: "Data Operations Coordinator",
    meta: "Part-time · Remote (Philippines)",
    description: "Responsible for reviewing and verifying submitted game statistics, flagging discrepancies, and coordinating with organizers.",
    skills: ["Attention to detail", "Basketball knowledge", "Basic spreadsheet proficiency"]
  },
  {
    title: "Junior Web Developer",
    meta: "Part-time or Project-based · Remote",
    description: "Support frontend and backend development of the Peach Basket Rankings PH platform.",
    skills: ["React", "TypeScript", "Next.js", "PostgreSQL"]
  },
  {
    title: "Statistical Analyst",
    meta: "Part-time · Remote (Philippines)",
    description: "Assist in validating player ratings, formula calibration, and data quality audits after each monthly update.",
    skills: ["Statistics", "Python or R", "Basketball analytics knowledge"]
  },
  {
    title: "League Partnerships Associate",
    meta: "Part-time · Remote (Philippines)",
    description: "Identify and onboard league partners across regions.",
    skills: ["Communication", "Sports network", "Organized follow-through"]
  },
  {
    title: "Graphic Designer",
    meta: "Project-based · Remote",
    description: "Design award certificates, shareable player cards, and marketing materials.",
    skills: ["Adobe Illustrator", "Figma", "Sports aesthetic sensibility"]
  }
];

export default function CareersPage() {
  return (
    <main className="bg-surface-50 pb-20">
      <section className="hero-brand pt-32 text-white">
        <div className="container-px py-14">
          <h1 className="font-display text-5xl font-extrabold">Join the Team</h1>
          <p className="mt-4 max-w-2xl text-lg text-navy-200">
            Help build the Philippines&apos; most credible basketball data platform.
          </p>
        </div>
      </section>

      <section className="container-px grid gap-8 pt-10">
        <article className="rounded-lg border border-surface-200 border-l-[3px] border-l-navy-800 bg-navy-50 p-6 shadow-sm">
          <p className="max-w-4xl leading-7 text-ink-700">
            Peach Basket Rankings PH is a small team doing serious work. We are building infrastructure for Philippine basketball that has never existed before. If you care about sports, data, and doing things right, we want to hear from you.
          </p>
        </article>

        <section>
          <p className="label">Open Roles</p>
          <div className="mt-4 grid gap-4">
            {roles.map((role) => (
              <article key={role.title} className="rounded-lg border border-surface-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-[1.75rem] font-bold text-navy-800">{role.title}</h2>
                    <p className="mt-1 font-mono text-mono-sm uppercase text-surface-400">{role.meta}</p>
                  </div>
                  <a
                    href={`mailto:careers@oncourtrankings.ph?subject=${encodeURIComponent(`Application: ${role.title}`)}`}
                    className="rounded-md border border-navy-800 px-4 py-2 font-semibold text-navy-800 hover:bg-navy-50"
                  >
                    Apply for This Role
                  </a>
                </div>
                <p className="mt-4 max-w-3xl text-surface-600">{role.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {role.skills.map((skill) => (
                    <span key={skill} className="rounded-full bg-navy-50 px-3 py-1 font-mono text-mono-sm uppercase text-navy-800">
                      {skill}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <p className="rounded-lg border border-surface-200 bg-white p-5 text-surface-600 shadow-sm">
          Don&apos;t see a role that fits? Send your resume and a note about how you&apos;d contribute to careers@oncourtrankings.ph. We read everything.
        </p>
      </section>
    </main>
  );
}
