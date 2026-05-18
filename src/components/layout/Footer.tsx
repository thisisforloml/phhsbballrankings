import Link from "next/link";

const contactNumber = "+63 9762165301";
const socialLinks = [
  // TODO: Replace placeholder Facebook URL with the official OnCourt page when available.
  { label: "Facebook", href: "https://facebook.com/oncourtrankingsph", external: true },
  { label: "WhatsApp", href: "https://wa.me/639762165301", external: true },
  { label: "Viber", href: "tel:+639762165301", external: false },
  { label: "Telegram", href: "tel:+639762165301", external: false }
];

export function Footer() {
  return (
    <footer className="container-px border-t border-surface-200 bg-white py-10 text-ink-500">
      <div className="grid gap-8 md:grid-cols-[1fr_auto_auto_auto] md:items-start">
        <div>
          <strong className="font-display text-3xl text-ink-900">OnCourt Rankings <span className="text-amber-700">PH</span></strong>
          <p className="mt-3 text-sm text-ink-500">Contact: {contactNumber}</p>
        </div>
        <nav className="grid gap-3 font-mono text-mono-sm uppercase">
          <strong className="text-ink-900">Rankings</strong>
          <Link href="/rankings">Player Rankings</Link>
          <Link href="/teams">Team Rankings</Link>
          <Link href="/claim">Claim Your Profile</Link>
        </nav>
        <nav className="grid gap-3 font-mono text-mono-sm uppercase">
          <strong className="text-ink-900">Platform</strong>
          <Link href="/leagues">Leagues</Link>
          <Link href="/how-we-rank">How We Rank</Link>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Use</Link>
        </nav>
        <nav className="grid gap-3 font-mono text-mono-sm uppercase">
          <strong className="text-ink-900">Contact</strong>
          {socialLinks.map((link) => (
            <a key={link.label} href={link.href} target={link.external ? "_blank" : undefined} rel={link.external ? "noreferrer" : undefined}>{link.label}</a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
