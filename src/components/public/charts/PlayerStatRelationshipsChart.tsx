"use client";

import { useMemo, useState } from "react";

import type { PlayerProfile, PlayerProfileGame } from "@/lib/player-profile-types";

type RelationshipStatId =
  | "points"
  | "minutes"
  | "rebounds"
  | "assists"
  | "steals"
  | "blocks"
  | "turnovers"
  | "trueShootingPct"
  | "finalPerformanceScore";

type RelationshipStat = {
  id: RelationshipStatId;
  label: string;
  read: (game: PlayerProfileGame) => number | null;
};

const RELATIONSHIP_STATS: RelationshipStat[] = [
  { id: "points", label: "Points", read: (game) => game.points },
  { id: "minutes", label: "Minutes", read: (game) => (game.minutes !== null && game.minutes > 0 ? game.minutes : null) },
  { id: "rebounds", label: "Rebounds", read: (game) => game.rebounds },
  { id: "assists", label: "Assists", read: (game) => game.assists },
  { id: "steals", label: "Steals", read: (game) => game.steals },
  { id: "blocks", label: "Blocks", read: (game) => game.blocks },
  { id: "turnovers", label: "Turnovers", read: (game) => game.turnovers },
  { id: "trueShootingPct", label: "True shooting %", read: (game) => game.trueShootingPct },
  { id: "finalPerformanceScore", label: "GPS", read: (game) => game.finalPerformanceScore },
];

function firstDifferentStat(excludeId: RelationshipStatId): RelationshipStatId {
  return RELATIONSHIP_STATS.find((item) => item.id !== excludeId)!.id;
}

function paddedDomain(min: number, max: number, padRatio = 0.08) {
  if (min === max) {
    const buffer = Math.max(1, Math.abs(min) * 0.1);
    return { min: min - buffer, max: max + buffer };
  }
  const span = max - min;
  const pad = span * padRatio;
  return { min: min - pad, max: max + pad };
}

function pearson(pairs: Array<{ x: number; y: number }>) {
  if (pairs.length < 2) return null;
  const xs = pairs.map((pair) => pair.x);
  const ys = pairs.map((pair) => pair.y);
  const xMean = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const yMean = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  let numerator = 0;
  let xDen = 0;
  let yDen = 0;
  for (let index = 0; index < pairs.length; index += 1) {
    const xDiff = xs[index] - xMean;
    const yDiff = ys[index] - yMean;
    numerator += xDiff * yDiff;
    xDen += xDiff * xDiff;
    yDen += yDiff * yDiff;
  }
  if (!xDen || !yDen) return null;
  return numerator / Math.sqrt(xDen * yDen);
}

function describeCorrelation(value: number | null) {
  if (value === null) return "Not enough paired games";
  const abs = Math.abs(value);
  const direction = value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
  const strength = abs >= 0.7 ? "strong" : abs >= 0.4 ? "moderate" : abs >= 0.2 ? "light" : "weak";
  return `${strength} ${direction} relationship (r = ${value.toFixed(2)})`;
}

function formatGameDate(iso: string) {
  return new Date(iso).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatStatValue(value: number, statId: RelationshipStatId) {
  if (statId === "trueShootingPct") return `${value.toFixed(1)}%`;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

type Props = {
  profile: PlayerProfile;
};

export function PlayerStatRelationshipsChart({ profile }: Props) {
  const [xStatId, setXStatId] = useState<RelationshipStatId>("minutes");
  const [yStatId, setYStatId] = useState<RelationshipStatId>("points");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const xStat = RELATIONSHIP_STATS.find((item) => item.id === xStatId)!;
  const yStat = RELATIONSHIP_STATS.find((item) => item.id === yStatId)!;

  const points = useMemo(() => {
    return profile.allGames
      .map((game) => {
        const x = xStat.read(game);
        const y = yStat.read(game);
        if (x === null || y === null) return null;
        return { game, x, y };
      })
      .filter((item): item is { game: PlayerProfileGame; x: number; y: number } => item !== null);
  }, [profile.allGames, xStat, yStat]);

  const excludedGames = profile.allGames.length - points.length;

  const correlation = useMemo(() => pearson(points.map((point) => ({ x: point.x, y: point.y }))), [points]);

  if (profile.allGames.length < 3) {
    return (
      <p className="text-sm font-semibold text-court-500">Need at least 3 verified games to explore stat relationships.</p>
    );
  }

  const width = 640;
  const height = 280;
  const pad = { top: 18, right: 18, bottom: 42, left: 42 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const xDomain = paddedDomain(Math.min(...xValues), Math.max(...xValues));
  const yDomain = paddedDomain(Math.min(...yValues), Math.max(...yValues));
  const xSpan = Math.max(0.001, xDomain.max - xDomain.min);
  const ySpan = Math.max(0.001, yDomain.max - yDomain.min);
  const xAt = (value: number) => pad.left + ((value - xDomain.min) / xSpan) * innerW;
  const yAt = (value: number) => pad.top + innerH - ((value - yDomain.min) / ySpan) * innerH;
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.12em] text-hardwood-600">Stat relationships</h3>
          <p className="mt-1 text-[0.68rem] font-semibold text-court-500">
            Each dot is one verified game with both stats logged. Games missing either value are excluded.
          </p>
        </div>
        <p className="text-xs font-bold text-court-700">{describeCorrelation(correlation)}</p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-court-500">X axis</span>
          <select
            value={xStatId}
            onChange={(event) => {
              const next = event.target.value as RelationshipStatId;
              setXStatId(next);
              if (next === yStatId) setYStatId(firstDifferentStat(next));
              setHoverIndex(null);
            }}
            className="border border-line-500 bg-white px-2 py-1.5 text-sm font-semibold outline-none focus:border-hardwood-600"
          >
            {RELATIONSHIP_STATS.map((item) => (
              <option key={item.id} value={item.id} disabled={item.id === yStatId}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-court-500">Y axis</span>
          <select
            value={yStatId}
            onChange={(event) => {
              const next = event.target.value as RelationshipStatId;
              setYStatId(next);
              if (next === xStatId) setXStatId(firstDifferentStat(next));
              setHoverIndex(null);
            }}
            className="border border-line-500 bg-white px-2 py-1.5 text-sm font-semibold outline-none focus:border-hardwood-600"
          >
            {RELATIONSHIP_STATS.map((item) => (
              <option key={item.id} value={item.id} disabled={item.id === xStatId}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {points.length < 2 ? (
        <p className="mt-4 text-sm font-semibold text-court-500">Not enough paired values for these stats.</p>
      ) : (
        <figure className="mt-4">
          <svg
            width="100%"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${xStat.label} versus ${yStat.label} relationship chart`}
            className="block"
            onMouseLeave={() => setHoverIndex(null)}
          >
            <line x1={pad.left} y1={pad.top + innerH} x2={pad.left + innerW} y2={pad.top + innerH} stroke="#d4cfc8" strokeWidth={1.5} />
            <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + innerH} stroke="#d4cfc8" strokeWidth={1.5} />
            <text x={pad.left + innerW / 2} y={height - 8} textAnchor="middle" className="fill-court-600 text-[10px] font-bold">
              {xStat.label}
            </text>
            <text
              x={14}
              y={pad.top + innerH / 2}
              textAnchor="middle"
              transform={`rotate(-90 14 ${pad.top + innerH / 2})`}
              className="fill-court-600 text-[10px] font-bold"
            >
              {yStat.label}
            </text>
            {points.map((point, index) => (
              <circle
                key={point.game.gameId}
                cx={xAt(point.x)}
                cy={yAt(point.y)}
                r={4.5}
                fill={point.game.result === "W" ? "#c2410c" : "#94a3b8"}
                opacity={hoverIndex === null || hoverIndex === index ? 0.9 : 0.35}
              />
            ))}
            {hoverIndex !== null && hovered ? (
              <circle
                cx={xAt(hovered.x)}
                cy={yAt(hovered.y)}
                r={6}
                fill="none"
                stroke="#57534e"
                strokeWidth={1.5}
              />
            ) : null}
            {points.map((point, index) => (
              <circle
                key={`hit-${point.game.gameId}`}
                cx={xAt(point.x)}
                cy={yAt(point.y)}
                r={10}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(index)}
                style={{ cursor: "pointer" }}
              />
            ))}
          </svg>

          {hovered ? (
            <div className="mt-2 border border-line-500 bg-paper-500 px-3 py-2 text-xs font-semibold text-court-700">
              <span className="font-black text-court-900">vs {hovered.game.opponentName}</span>
              <span className="mx-2 text-court-300">|</span>
              <span>{formatGameDate(hovered.game.gameDate)}</span>
              <span className="mx-2 text-court-300">|</span>
              <span className={hovered.game.result === "W" ? "text-hardwood-600" : "text-court-500"}>
                {hovered.game.result === "W" ? "Win" : "Loss"}
              </span>
              <span className="mx-2 text-court-300">|</span>
              {xStat.label} {formatStatValue(hovered.x, xStatId)} · {yStat.label} {formatStatValue(hovered.y, yStatId)}
            </div>
          ) : (
            <p className="mt-2 text-xs text-court-500">Hover a dot for opponent, date, result, and stat values.</p>
          )}
          <figcaption className="sr-only">{`${xStat.label} versus ${yStat.label} relationship chart`}</figcaption>
        </figure>
      )}

      <div className="mt-2 flex flex-wrap gap-3 text-[0.68rem] font-semibold text-court-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-hardwood-600" />
          Win
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-400" />
          Loss
        </span>
        {excludedGames > 0 ? (
          <span>
            {excludedGames} game{excludedGames === 1 ? "" : "s"} excluded (missing minutes or stat pair)
          </span>
        ) : null}
      </div>
    </section>
  );
}
