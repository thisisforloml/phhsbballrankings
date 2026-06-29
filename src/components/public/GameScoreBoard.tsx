import Link from "next/link";
import { MapPin } from "lucide-react";
import { ScoutSectionLabel } from "@/components/public/ScoutSectionLabel";
import { getProgramAbbreviation } from "@/lib/uaap-school-display";

type GameScoreBoardGame = {
  id: string;
  gameDate: Date | string;
  verificationStatus?: string;
  seasonName?: string;
  leagueName?: string;
  homeScore: number;
  awayScore: number;
  homeTeam: { name: string };
  awayTeam: { name: string };
};

type DateGroup = {
  key: string;
  label: string;
  live?: boolean;
  games: GameScoreBoardGame[];
};

function toDateKey(value: Date | string) {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function formatGroupLabel(dateKey: string, todayKey: string, yesterdayKey: string) {
  if (dateKey === todayKey) return "Today";
  if (dateKey === yesterdayKey) return "Yesterday";
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  });
}

function groupGamesByDate(games: GameScoreBoardGame[]): DateGroup[] {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  const sorted = [...games].sort((left, right) => toDateKey(right.gameDate).localeCompare(toDateKey(left.gameDate)));
  const buckets = new Map<string, GameScoreBoardGame[]>();

  for (const game of sorted) {
    const key = toDateKey(game.gameDate);
    const list = buckets.get(key) ?? [];
    list.push(game);
    buckets.set(key, list);
  }

  return Array.from(buckets.entries()).map(([key, groupGames]) => ({
    key,
    label: formatGroupLabel(key, todayKey, yesterdayKey),
    live: key === todayKey,
    games: groupGames,
  }));
}

export function GameScoreBoard({ games }: { games: GameScoreBoardGame[] }) {
  const groups = groupGamesByDate(games);

  return (
    <div className="grid gap-8">
      {groups.map((group) => (
        <section key={group.key}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <ScoutSectionLabel>{group.label}</ScoutSectionLabel>
            {group.live ? (
              <span className="rounded-sm bg-scout-orange px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-white">
                Recent
              </span>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.games.map((game) => (
              <GameScoreCard key={game.id} game={game} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function GameScoreCard({ game }: { game: GameScoreBoardGame }) {
  const homeWon = game.homeScore > game.awayScore;
  const awayWon = game.awayScore > game.homeScore;
  const leagueLabel = game.leagueName || game.seasonName || "Official game";
  const gameDate = toDateKey(game.gameDate);

  return (
    <Link
      href={`/games/${game.id}`}
      className="grid gap-3 rounded-sm border border-white/[0.08] bg-scout-800/80 p-4 transition hover:border-scout-orange/40 hover:bg-scout-800"
    >
      <div className="flex items-center justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-[0.1em]">
        <span className="truncate text-white/50">{leagueLabel}</span>
        <span className="shrink-0 text-white/40">Final · {gameDate}</span>
      </div>
      <div className="grid gap-2">
        <TeamScoreLine name={game.homeTeam.name} score={game.homeScore} winner={homeWon} />
        <TeamScoreLine name={game.awayTeam.name} score={game.awayScore} winner={awayWon} />
      </div>
      <p className="flex items-center gap-1 text-[0.65rem] font-semibold text-white/35">
        <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
        Verified official result
      </p>
    </Link>
  );
}

function TeamScoreLine({ name, score, winner }: { name: string; score: number; winner: boolean }) {
  const display = getProgramAbbreviation(name) || name;
  return (
    <div className="flex items-center justify-between gap-3">
      <span
        className={`truncate text-sm font-bold uppercase tracking-wide ${winner ? "text-white" : "text-white/45"}`}
        title={name}
      >
        {display}
      </span>
      <span
        className={`font-numeric shrink-0 text-2xl font-normal leading-none ${winner ? "text-white" : "text-white/40"}`}
      >
        {score}
      </span>
    </div>
  );
}
