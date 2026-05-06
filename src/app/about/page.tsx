export default function AboutPage() {
  return (
    <main className="bg-surface-50 pb-20">
      <section className="hero-brand pt-32 text-white">
        <div className="container-px py-14">
          <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">Methodology</p>
          <h1 className="mt-3 font-display text-stat-lg">How Ratings Work</h1>
          <p className="mt-4 max-w-3xl text-white/70">OnCourt Rankings Philippines combines verified production, competition quality, opponent strength, and team context. Boys become leaderboard eligible after 10 verified official games; girls become eligible after 8.</p>
        </div>
      </section>
      <section className="container-px grid gap-4 pt-10 md:grid-cols-2">
        {["Production Score", "League Weight", "Opponent Factor", "Team Context"].map((title) => (
          <article key={title} className="rounded-lg border border-surface-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-3xl">{title}</h2>
            <p className="mt-2 text-ink-600">This factor is reviewed only from verified official game data and updated through the weekly ratings process.</p>
          </article>
        ))}
      </section>
    </main>
  );
}
