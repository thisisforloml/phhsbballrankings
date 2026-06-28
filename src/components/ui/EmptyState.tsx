type EmptyIcon = "players" | "leagues" | "scores" | "teams";

const icons: Record<EmptyIcon, React.ReactNode> = {
  players: (
    <svg viewBox="0 0 64 64" className="h-16 w-16" aria-hidden="true">
      <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M18 32h28M32 12c6 8 6 32 0 40M32 12c-6 8-6 32 0 40" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M18 50h28" stroke="currentColor" strokeWidth="3" />
    </svg>
  ),
  leagues: (
    <svg viewBox="0 0 64 64" className="h-16 w-16" aria-hidden="true">
      <path d="M18 20h16l12 24H30L18 20Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <path d="M13 16l7 4M46 44l7 4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
  scores: (
    <svg viewBox="0 0 64 64" className="h-16 w-16" aria-hidden="true">
      <rect x="12" y="16" width="40" height="28" rx="3" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M22 28h8M34 28h8M24 52h16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
  teams: (
    <svg viewBox="0 0 64 64" className="h-16 w-16" aria-hidden="true">
      <circle cx="32" cy="20" r="7" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="18" cy="28" r="6" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="46" cy="28" r="6" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M12 48c4-9 15-9 20-1M24 47c4-12 18-12 22 0M32 47c5-8 16-8 20 1" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
};

export function EmptyState({ icon, title, description }: { icon: EmptyIcon; title: string; description?: string }) {
  return (
    <div className="grid place-items-center border border-line-500 bg-white px-6 py-16 text-center">
      <div className="text-hardwood-600">{icons[icon]}</div>
      <h2 className="mt-5 font-display text-2xl font-black text-court-900">{title}</h2>
      <p className="mt-2 max-w-sm text-court-500">{description ?? "Official data will appear here once the selected scope has verified submissions."}</p>
    </div>
  );
}
