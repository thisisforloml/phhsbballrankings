type ImpactGame = {
  homeTeamName?: string;
  awayTeamName?: string;
  playerStats?: Array<{ playerName?: string }>;
};

export type PublishImpactSummary = {
  games: number;
  playerStatRows: number;
  teams: number;
  players: number;
  willRecomputeRatings: boolean;
  willRevalidatePublicViews: boolean;
  publicSurfaces: string[];
};

export function buildPublishImpactSummary(
  preview: { games?: ImpactGame[] } | null | undefined,
  options?: { willRecomputeRatings?: boolean }
): PublishImpactSummary {
  const games = preview?.games?.length ?? 0;
  const playerStatRows = preview?.games?.reduce((sum, game) => sum + (game.playerStats?.length ?? 0), 0) ?? 0;
  const teamNames = new Set<string>();
  const playerNames = new Set<string>();

  for (const game of preview?.games ?? []) {
    if (game.homeTeamName) teamNames.add(game.homeTeamName);
    if (game.awayTeamName) teamNames.add(game.awayTeamName);
    for (const stat of game.playerStats ?? []) {
      if (stat.playerName) playerNames.add(stat.playerName);
    }
  }

  return {
    games,
    playerStatRows,
    teams: teamNames.size,
    players: playerNames.size,
    willRecomputeRatings: options?.willRecomputeRatings ?? true,
    willRevalidatePublicViews: true,
    publicSurfaces: ["/rankings", "/players/[slug]", "/teams", "/games/[id]"]
  };
}
