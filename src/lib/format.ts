export function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

export function starText(stars: number): string {
  const clampedStars = Math.max(0, Math.min(5, Math.round(stars)));
  return "*".repeat(clampedStars) + "-".repeat(5 - clampedStars);
}

export function trendText(trend: number): string {
  if (trend > 0) return `+${trend}`;
  if (trend < 0) return String(trend);
  return "Even";
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function formatHeight(heightCm: number | null | undefined): string {
  if (!heightCm) return "Height not listed";

  const totalInches = Math.round(heightCm / 2.54);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;

  return `${heightCm} cm (${feet}'${inches}\")`;
}

export function getPlayerProfileHref(player: { id?: string | null; slug?: string | null; displayName?: string | null }): string {
  if (player.slug) return `/players/${player.slug}`;
  if (player.displayName) return `/players/${slugify(player.displayName)}`;
  return `/players/${player.id ?? ""}`;
}