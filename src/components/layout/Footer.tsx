import Link from "next/link";

export function Footer() {
  return (
    <footer className="container-px border-t border-surface-200 bg-white py-10 text-ink-500">
      <div className="grid gap-8 md:grid-cols-[1fr_auto_auto_auto] md:items-start">
        <div>
          <strong className="font-display text-3xl text-ink-900">OnCourt Rankings <span className="text-amber-700">PH</span></strong>
          <p className="mt-2 max-w-xl">Verified Philippine basketball rankings, player registry, and competition data.</p>
        </div>
        <nav className="grid gap-3 font-mono text-mono-sm uppercase">
          <strong className="text-ink-900">Rankings</strong>
          <Link href="/rankings">Player Rankings</Link>
          <Link href="/teams">Team Rankings</Link>
          <Link href="/claim">Claim Your Profile</Link>
        </nav>
        <nav className="grid gap-3 font-mono text-mono-sm uppercase">
          <strong className="text-ink-900">Leagues</strong>
          <Link href="/leagues">Leagues</Link>
        </nav>
        <nav className="grid gap-3 font-mono text-mono-sm uppercase">
          <strong className="text-ink-900">Platform</strong>
          <Link href="/partner">Partner</Link>
          <Link href="/licensed">Licensed Data</Link>
          <Link href="/careers">Careers</Link>
        </nav>
      </div>
    </footer>
  );
}
