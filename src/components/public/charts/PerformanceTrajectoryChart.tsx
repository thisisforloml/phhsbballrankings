"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PlayerProfileGame, PlayerProfileLeague } from "@/lib/player-profile-types";

type TrajectoryMode = "line" | "bars";

type Props = {
  games: PlayerProfileGame[];
  leagues: PlayerProfileLeague[];
  height?: number;
};

// ── helpers ──────────────────────────────────────────────────────────────────

function rollingAvg(values: number[], window = 5): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return Math.round((slice.reduce((a, b) => a + b, 0) / slice.length) * 10) / 10;
  });
}

function tierColor(tier: number) {
  if (tier >= 4) return "#c2410c"; // Elite — hardwood
  if (tier === 3) return "#f59e0b"; // Competitive — amber
  if (tier === 2) return "#60a5fa"; // Developmental — blue
  return "#9ca3af";                 // Entry — gray
}

function tierLabel(tier: number) {
  if (tier >= 4) return "Elite";
  if (tier === 3) return "Competitive";
  if (tier === 2) return "Developmental";
  return "Entry";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatStatLine(game: PlayerProfileGame) {
  const parts = [
    `${game.points} PTS`,
    `${game.rebounds} REB`,
    `${game.assists} AST`,
  ];
  if (game.steals) parts.push(`${game.steals} STL`);
  if (game.blocks) parts.push(`${game.blocks} BLK`);
  return parts.join(" · ");
}

// ── component ─────────────────────────────────────────────────────────────────

export function PerformanceTrajectoryChart({ games, leagues, height = 230 }: Props) {
  const [mode, setMode] = useState<TrajectoryMode>("line");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Build tier lookup from leagues list
  const tierByLeague = useMemo(() => {
    const map: Record<string, number> = {};
    for (const league of leagues) {
      map[league.leagueName] = league.tier;
    }
    return map;
  }, [leagues]);

  // Filter to games with GPS, chronological order
  const gpsGames = useMemo(
    () => [...games].filter((g) => g.finalPerformanceScore !== null).sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime()),
    [games]
  );

  const values = useMemo(() => gpsGames.map((g) => g.finalPerformanceScore!), [gpsGames]);
  const rolling = useMemo(() => rollingAvg(values, 5), [values]);

  if (gpsGames.length < 2) {
    return (
      <div className="flex min-h-[8rem] items-center justify-center border border-line-500 bg-paper-500/40 text-sm font-semibold text-court-500">
        Need at least 2 games with performance scores to render this chart.
      </div>
    );
  }

  // SVG dimensions
  const W = 640;
  const pad = { top: 20, right: 16, bottom: 46, left: 42 };
  const iW = W - pad.left - pad.right;
  const iH = height - pad.top - pad.bottom;

  const n = gpsGames.length;
  const xAt = (i: number) => pad.left + (n <= 1 ? iW / 2 : (i / (n - 1)) * iW);
  const yMax = 100;
  const yAt = (v: number) => pad.top + iH - (Math.max(0, Math.min(100, v)) / yMax) * iH;

  const yTicks = [0, 25, 50, 75, 100];
  const barW = Math.max(4, Math.min(22, (iW / n) * 0.7));

  const hovered = hoverIndex !== null ? gpsGames[hoverIndex] : null;
  // Tooltip flip: stay left of the chart edge
  const tooltipOnLeft = hoverIndex !== null && hoverIndex > n * 0.6;

  // x-axis game labels (only show a few)
  const stride = n <= 8 ? 1 : n <= 16 ? 2 : Math.ceil(n / 8);

  return (
    <div>
      {/* Header row: title + mode toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.12em] text-hardwood-600">
            Game performance score
          </h3>
          <p className="mt-0.5 text-xs font-semibold text-court-500">
            Formula v1 GPS per game · 5-game rolling average
          </p>
        </div>
        <div className="flex gap-1">
          {(["line", "bars"] as TrajectoryMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`border px-2.5 py-1 text-xs font-bold transition ${
                mode === m
                  ? "border-hardwood-600 bg-hardwood-600 text-white"
                  : "border-line-500 bg-white text-court-700 hover:border-hardwood-600"
              }`}
              aria-pressed={mode === m}
            >
              {m === "line" ? "Line" : "Bars"}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="relative mt-3" onMouseLeave={() => setHoverIndex(null)}>
        <svg
          width="100%"
          viewBox={`0 0 ${W} ${height}`}
          role="img"
          aria-label="Game performance score over time"
          className="block"
        >
          {/* Y grid + labels */}
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={pad.left} y1={yAt(tick)}
                x2={pad.left + iW} y2={yAt(tick)}
                stroke="#e8e4df" strokeWidth={1}
              />
              <text
                x={pad.left - 6} y={yAt(tick) + 4}
                textAnchor="end"
                className="fill-court-500 text-[10px] font-semibold"
              >
                {tick}
              </text>
            </g>
          ))}

          {/* Baseline */}
          <line x1={pad.left} y1={pad.top + iH} x2={pad.left + iW} y2={pad.top + iH} stroke="#d4cfc8" strokeWidth={1.5} />

          {/* Bars mode */}
          {mode === "bars" &&
            gpsGames.map((game, i) => {
              const v = game.finalPerformanceScore!;
              const x = xAt(i);
              const barH = (v / yMax) * iH;
              const tier = tierByLeague[game.leagueName] ?? 1;
              const fill = tierColor(tier);
              return (
                <rect
                  key={game.gameId}
                  x={x - barW / 2}
                  y={yAt(v)}
                  width={barW}
                  height={barH}
                  fill={fill}
                  opacity={hoverIndex === null || hoverIndex === i ? 1 : 0.45}
                />
              );
            })}

          {/* Line mode: raw score path */}
          {mode === "line" && (
            <path
              d={values.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ")}
              fill="none"
              stroke="#c2410c"
              strokeWidth={1.5}
              strokeOpacity={0.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Rolling avg — shown in both modes */}
          <path
            d={rolling.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ")}
            fill="none"
            stroke="#c2410c"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* W/L dots on baseline */}
          {gpsGames.map((game, i) => (
            <circle
              key={`wl-${game.gameId}`}
              cx={xAt(i)}
              cy={pad.top + iH + 8}
              r={3}
              fill={game.result === "W" ? "#16a34a" : "#dc2626"}
            />
          ))}

          {/* X-axis game labels */}
          {gpsGames.map((game, i) => {
            if (i % stride !== 0 && i !== n - 1) return null;
            const label = new Date(game.gameDate).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
            const anchor = i === 0 ? "start" : i === n - 1 ? "end" : "middle";
            return (
              <text
                key={`xl-${game.gameId}`}
                x={xAt(i)}
                y={height - 6}
                textAnchor={anchor}
                className="fill-court-500 text-[9px] font-semibold"
              >
                {label}
              </text>
            );
          })}

          {/* Hover crosshair */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={xAt(hoverIndex)} y1={pad.top}
                x2={xAt(hoverIndex)} y2={pad.top + iH}
                stroke="#a8a29e" strokeWidth={1} strokeDasharray="4 3"
              />
              <circle
                cx={xAt(hoverIndex)}
                cy={yAt(rolling[hoverIndex])}
                r={5}
                fill="#c2410c"
                stroke="#fff"
                strokeWidth={1.5}
              />
            </g>
          )}

          {/* Invisible hover hit areas */}
          {gpsGames.map((_, i) => (
            <rect
              key={`hit-${i}`}
              x={xAt(i) - (iW / n / 2)}
              y={pad.top}
              width={iW / n}
              height={iH + 8}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
              style={{ cursor: "pointer" }}
            />
          ))}
        </svg>

        {/* Tooltip overlay */}
        {hovered && hoverIndex !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-52 border border-line-500 bg-white p-2.5 shadow-lg"
            style={{
              left: tooltipOnLeft
                ? `calc(${((xAt(hoverIndex) - pad.left) / iW) * 100}% - 13.5rem)`
                : `calc(${((xAt(hoverIndex) - pad.left) / iW) * 100}% + 0.75rem)`,
              transform: "translateY(-30%)",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`text-[0.62rem] font-bold uppercase tracking-[0.1em] ${hovered.result === "W" ? "text-green-600" : "text-red-600"}`}>
                {hovered.result === "W" ? "Win" : "Loss"} · {hovered.teamScore}–{hovered.opponentScore}
              </span>
              <strong className="font-display text-base font-bold text-hardwood-600">
                {hovered.finalPerformanceScore?.toFixed(1)}
              </strong>
            </div>
            <p className="mt-1 text-sm font-bold text-court-900">vs {hovered.opponentName}</p>
            <p className="text-xs font-semibold text-court-500">{hovered.leagueName}</p>
            <p className="text-xs font-semibold text-court-500">{formatDate(hovered.gameDate)}</p>
            <p className="mt-1.5 text-xs font-semibold text-court-600">{formatStatLine(hovered)}</p>
            <p className="mt-1.5 text-[0.68rem] font-semibold text-court-400">
              5-game avg: {rolling[hoverIndex].toFixed(1)}
            </p>
            <Link
              href={`/games/${hovered.gameId}`}
              className="pointer-events-auto mt-2 block text-[0.68rem] font-bold uppercase tracking-[0.1em] text-hardwood-600 hover:underline"
            >
              View box score →
            </Link>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {mode === "line" && (
          <LegendItem color="#c2410c" opacity={0.5} label="GPS per game" />
        )}
        <LegendItem color="#c2410c" label="5-game avg" bold />
        <LegendItem color="#16a34a" dot label="Win" />
        <LegendItem color="#dc2626" dot label="Loss" />
        {mode === "bars" && (
          <div className="ml-auto flex flex-wrap gap-x-3 gap-y-1">
            {[1, 2, 3, 4].map((t) => (
              <LegendItem key={t} color={tierColor(t)} dot label={tierLabel(t)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LegendItem({
  color,
  label,
  dot = false,
  bold = false,
  opacity = 1,
}: {
  color: string;
  label: string;
  dot?: boolean;
  bold?: boolean;
  opacity?: number;
}) {
  return (
    <span className="flex items-center gap-1.5">
      {dot ? (
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color, opacity }} />
      ) : (
        <span className="inline-block h-[3px] w-4" style={{ backgroundColor: color, opacity }} />
      )}
      <span className={`text-[0.68rem] font-semibold text-court-600 ${bold ? "font-bold" : ""}`}>{label}</span>
    </span>
  );
}
