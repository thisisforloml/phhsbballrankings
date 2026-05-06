export function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

export function starText(stars: number): string {
  return "â˜…â˜…â˜…â˜…â˜…".slice(0, stars) + "â˜†â˜†â˜†â˜†â˜†".slice(stars);
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
