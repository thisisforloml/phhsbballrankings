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
    <footer className="container-px border-t border-court-800 bg-court-900 py-10 text-white/62">
      <div className="grid gap-8 md:grid-cols-[1fr_auto_auto_auto] md:items-start">
        <div>
          <strong className="font-display text-3xl font-black text-white">OnCourt Rankings <span className="text-gold-500">PH</span></strong>
          <p className="mt-3 text-sm text-white/55">Philippine youth hoops rankings from official game data.</p>
          <p className="mt-2 text-sm text-white/55">Contact: {contactNumber}</p>
        </div>
        <nav className="grid gap-3 text-xs font-bold uppercase tracking-[0.12em]">
          <strong className="text-white">Rankings</strong>
          <Link href="/rankings">Player Rankings</Link>
          <Link href="/teams">Team Standings</Link>
          <Link href="/claim">Claim Your Profile</Link>
        </nav>
        <nav className="grid gap-3 text-xs font-bold uppercase tracking-[0.12em]">
          <strong className="text-white">Platform</strong>
          <Link href="/leagues">Leagues</Link>
          <Link href="/how-we-rank">How We Rank</Link>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Use</Link>
        </nav>
        <nav className="grid gap-3 text-xs font-bold uppercase tracking-[0.12em]">
          <strong className="text-white">Contact</strong>
          {socialLinks.map((link) => (
            <a key={link.label} href={link.href} target={link.external ? "_blank" : undefined} rel={link.external ? "noreferrer" : undefined}>{link.label}</a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
