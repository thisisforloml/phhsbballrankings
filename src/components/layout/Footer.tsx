import Link from "next/link";
import { BRAND_NAME_FULL } from "@/lib/brand";
import type { PublicTrustMeta } from "@/lib/public-rankings-coverage";

const quickLinks = [
  { label: "Players", href: "/rankings" },
  { label: "Teams", href: "/teams" },
  { label: "Leagues", href: "/leagues" },
  { label: "Games", href: "/games" },
  { label: "About", href: "/about" },
  { label: "How We Rank", href: "/how-we-rank" },
  { label: "FAQs", href: "/faqs" },
  { label: "Claim Profile", href: "/claim" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Use", href: "/terms" },
];

const connectLinks = [
  { label: "Facebook", href: "https://facebook.com/oncourtrankingsph", external: true },
  { label: "WhatsApp", href: "https://wa.me/639762165301", external: true },
  { label: "Viber", href: "tel:+639762165301", external: false },
];

function formatTrustDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  });
}

export function Footer({ trustMeta }: { trustMeta?: PublicTrustMeta }) {
  const copyrightYear = new Date().getFullYear();
  const lastUpdatedLabel = trustMeta?.lastUpdated ? formatTrustDate(trustMeta.lastUpdated) : null;

  return (
    <footer className="container-px border-t border-white/10 bg-court-900 py-10 text-white">
      <nav
        aria-label="Footer navigation"
        className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-6 gap-y-3 text-center text-sm font-medium text-white/80 [&_a]:transition [&_a:hover]:text-gold-500"
      >
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="mx-auto mt-8 flex max-w-5xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-center text-sm text-white/65">
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
      <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-6 text-white/55">
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
