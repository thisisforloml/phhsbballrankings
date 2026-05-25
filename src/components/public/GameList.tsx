import Link from "next/link";

type GameListGame = {
  id: string;
  gameNumber: string | null;
  gameDate: Date;
  verificationStatus: string;
  seasonName: string;
  homeScore: number;
  awayScore: number;
  homeTeam: { name: string };
  awayTeam: { name: string };
};

export function GameList({ games }: { games: GameListGame[] }) {
  return (
    <div className="grid gap-3">
      {games.map((game) => {
        const homeWon = game.homeScore > game.awayScore;
        const awayWon = game.awayScore > game.homeScore;
        return (
          <Link key={game.id} href={`/games/${game.id}`} className="grid gap-3 border border-line-500 bg-white p-4 transition hover:border-court-900 hover:bg-paper-500 lg:grid-cols-[9rem_1fr_8rem] lg:items-center">
            <span>
              <strong className="block text-xs font-black uppercase tracking-[0.12em] text-hardwood-600">{game.gameNumber ?? "Game"}</strong>
              <small className="mt-1 block text-xs font-semibold text-court-500">{game.gameDate.toISOString().slice(0, 10)}</small>
            </span>
            <span className="grid gap-2">
              <TeamLine name={game.homeTeam.name} score={game.homeScore} winner={homeWon} />
              <TeamLine name={game.awayTeam.name} score={game.awayScore} winner={awayWon} />
            </span>
            <span className="text-left lg:text-right">
              <strong className="block text-xs font-black uppercase tracking-[0.12em] text-court-500">{game.verificationStatus}</strong>
              <small className="mt-1 block text-xs font-semibold text-court-500">{game.seasonName}</small>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function TeamLine({ name, score, winner }: { name: string; score: number; winner: boolean }) {
  return (
    <span className="grid grid-cols-[1fr_auto] items-center gap-4">
      <strong className={`truncate text-lg leading-tight ${winner ? "font-black text-court-900" : "font-semibold text-court-500"}`}>{name}</strong>
      <strong className={`font-display text-2xl font-black leading-none ${winner ? "text-hardwood-600" : "text-court-500"}`}>{score}</strong>
    </span>
  );
}

