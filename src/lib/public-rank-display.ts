export function formatPublicRank(rank: number | null | undefined) {
  if (!rank || rank < 1) return "-";
  if (rank <= 100) return `#${rank}`;

  const bandStart = Math.floor((rank - 101) / 50) * 50 + 101;
  return `#${bandStart}-${bandStart + 49}`;
}

export function isPublicRankBand(rank: number | null | undefined) {
  return Boolean(rank && rank > 100);
}
