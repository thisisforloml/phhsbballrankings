import Link from "next/link";

type GameListGame = {
  id: string;
  gameNumber?: string | null;
  gameDate: Date | string;
  verificationStatus?: string;
  seasonName?: string;
  leagueName?: string;
  homeScore: number;
  awayScore: number;
  homeTeam: { name: string };
  awayTeam: { name: string };
};

export function GameList({ games }: { games: GameListGame[] }) {
  return (
    <div className="grid gap-2">
      {games.map((game) => {
        const homeWon = game.homeScore > game.awayScore;
        const awayWon = game.awayScore > game.homeScore;
        const gameDate = typeof game.gameDate === "string" ? game.gameDate.slice(0, 10) : game.gameDate.toISOString().slice(0, 10);
        const leagueLabel = game.leagueName || game.seasonName || "Official game";

        return (
          <Link
            key={game.id}
            href={`/games/${game.id}`}
            className="grid gap-3 border border-line-500 bg-white px-3 py-3 transition hover:border-court-900 hover:bg-paper-500"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <strong className="block text-xs font-bold text-hardwood-600">{gameDate}</strong>
                <small className="mt-1 block truncate text-xs font-semibold text-court-500" title={leagueLabel}>{leagueLabel}</small>
              </div>
              <GameStatusBadge status={game.verificationStatus} />
            </div>
            <span className="grid gap-2">
              <TeamLine name={game.homeTeam.name} score={game.homeScore} winner={homeWon} />
              <TeamLine name={game.awayTeam.name} score={game.awayScore} winner={awayWon} />
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function GameStatusBadge({ status }: { status?: string }) {
  const label = status === "VERIFIED" ? "Verified" : status === "SUBMITTED" ? "Official" : "Recorded";
  const tone = status === "VERIFIED" ? "border-win-text/30 bg-win-bg text-win-text" : "border-line-500 bg-paper-500 text-court-600";

  return (
    <span className={`shrink-0 border px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] ${tone}`}>
      {label}
    </span>
  );
}

function TeamLine({ name, score, winner }: { name: string; score: number; winner: boolean }) {
  return (
    <span className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-3">
      <strong className={`truncate text-sm leading-tight md:text-base ${winner ? "font-black text-court-900" : "font-semibold text-court-500"}`} title={name}>{name}</strong>
      <strong className={`text-right font-display text-lg font-black leading-none md:text-xl ${winner ? "text-hardwood-600" : "text-court-500"}`}>{score}</strong>
    </span>
  );
}
