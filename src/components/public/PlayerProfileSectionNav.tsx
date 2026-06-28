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
};

export function PlayerProfileSectionNav({ activeId, onSelect }: PlayerProfileSectionNavProps) {
  return (
    <nav aria-label="Profile sections" className="overflow-x-auto border-t border-neutral-200 bg-white">
      <ul className="flex min-w-max px-2 md:px-4" role="tablist">
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
                className={`block border-b-2 px-3 py-3 text-xs font-bold uppercase tracking-[0.08em] transition md:px-4 md:text-sm ${
                  active
                    ? "border-accent-500 text-neutral-900"
                    : "border-transparent text-neutral-500 hover:border-accent-300 hover:text-neutral-800"
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
