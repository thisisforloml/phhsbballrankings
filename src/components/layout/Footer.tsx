"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BRAND_NAME_FULL } from "@/lib/brand";
import type { PublicTrustMeta } from "@/lib/public-rankings-coverage";

type FooterLink = {
  label: string;
  href: string;
};

const footerLinkGroups: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: "Explore",
    links: [
      { label: "Players", href: "/rankings" },
      { label: "Teams", href: "/teams" },
      { label: "Leagues", href: "/leagues" },
      { label: "Games", href: "/games" },
      { label: "Saved Players", href: "/saved" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "About", href: "/about" },
      { label: "How We Rank", href: "/how-we-rank" },
      { label: "FAQs", href: "/faqs" },
    ],
  },
  {
    title: "Organization",
    links: [{ label: "For organizers", href: "/portal/login" }],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Use", href: "/terms" },
    ],
  },
];

const quickLinks = footerLinkGroups.flatMap((group) => group.links);

const connectLinks = [
  { label: "Facebook", href: "https://facebook.com/oncourtrankingsph", external: true },
  { label: "WhatsApp", href: "https://wa.me/639762165301", external: true },
  { label: "Viber", href: "tel:+639762165301", external: false },
];

const footerLinkClass = "text-sm font-medium text-white/80 transition hover:text-gold-500";

function formatTrustDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  });
}

export function Footer({ trustMeta }: { trustMeta?: PublicTrustMeta }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const copyrightYear = new Date().getFullYear();
  const lastUpdatedLabel = trustMeta?.lastUpdated ? formatTrustDate(trustMeta.lastUpdated) : null;

  return (
    <footer
      className={`container-px border-t border-white/10 bg-court-900 text-white ${
        isHome ? "py-6 md:py-10" : "py-6 md:py-10"
      }`}
    >
      <nav aria-label="Footer navigation" className="mx-auto max-w-5xl md:hidden">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          {footerLinkGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-white/45">{group.title}</p>
              <ul className="space-y-1.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={footerLinkClass}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <nav
        aria-label="Footer navigation"
        className="mx-auto hidden max-w-5xl flex-wrap items-center justify-center gap-x-6 gap-y-3 text-center md:flex [&_a]:transition [&_a:hover]:text-gold-500"
      >
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href} className={`${footerLinkClass} text-center`}>
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="mx-auto mt-5 flex max-w-5xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-center text-sm text-white/65 md:mt-8">
        {connectLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target={link.external ? "_blank" : undefined}
            rel={link.external ? "noreferrer" : undefined}
            className="transition hover:text-gold-500"
          >
            {link.label}
          </a>
        ))}
      </div>
      <p className="mx-auto mt-4 max-w-3xl text-center text-xs leading-5 text-white/55 md:mt-6 md:leading-6">
        © {copyrightYear} {BRAND_NAME_FULL}
        {lastUpdatedLabel ? (
          <>
            {" "}
            · Data from verified official games · Updated {lastUpdatedLabel}
          </>
        ) : (
          <> · Data from verified official games</>
        )}
      </p>
    </footer>
  );
}
