"use client";

export const PLAYER_PROFILE_SECTIONS = [
  { id: "recent-form", label: "Overview" },
  { id: "analytics", label: "Analytics" },
  { id: "scouting", label: "Scouting" },
  { id: "production", label: "Production" },
  { id: "competition", label: "Competition" },
  { id: "game-log", label: "Game log" },
] as const;

export type PlayerProfileSectionId = (typeof PLAYER_PROFILE_SECTIONS)[number]["id"];

type PlayerProfileSectionNavProps = {
  activeId: PlayerProfileSectionId;
  onSelect: (id: PlayerProfileSectionId) => void;
  variant?: "dark" | "light";
  compact?: boolean;
  className?: string;
  navClassName?: string;
};

export function PlayerProfileSectionNav({
  activeId,
  onSelect,
  variant = "dark",
  compact = false,
  className = "",
  navClassName = "",
}: PlayerProfileSectionNavProps) {
  const isLight = variant === "light";

  return (
    <nav
      aria-label="Profile sections"
      className={`overflow-x-auto scrollbar-none ${isLight ? "border-t border-line-500/60 bg-white" : "border-t border-white/[0.08] bg-scout-800/80"} ${navClassName}`}
    >
      <ul
        className={`flex min-w-max gap-3 md:gap-5 ${compact ? "px-3 md:px-4" : "px-4 md:px-6"} ${className}`}
        role="tablist"
      >
        {PLAYER_PROFILE_SECTIONS.map((section) => {
          const active = activeId === section.id;
          return (
            <li key={section.id} role="presentation">
              <button
                type="button"
                role="tab"
                id={`tab-${section.id}`}
                aria-selected={active}
                aria-controls={`panel-${section.id}`}
                onClick={() => onSelect(section.id)}
                className={`relative block text-[0.68rem] font-medium uppercase tracking-[0.15em] transition md:text-[0.7rem] ${
                  compact ? "px-2 py-1 md:px-3.5 md:py-1.5" : "px-3 py-2 md:px-5 md:py-2.5"
                } ${
                  active
                    ? isLight
                      ? "font-semibold text-court-900 after:absolute after:inset-x-4 after:bottom-0 after:h-px after:bg-hardwood-600/80 md:after:inset-x-5"
                      : "font-semibold text-scout-50 after:absolute after:inset-x-4 after:bottom-0 after:h-px after:bg-scout-orange/80 md:after:inset-x-5"
                    : isLight
                      ? "text-court-400/65 hover:text-court-600"
                      : "text-scout-500/65 hover:text-scout-50"
                }`}
              >
                {section.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
