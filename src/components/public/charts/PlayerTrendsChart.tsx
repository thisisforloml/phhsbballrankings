"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { PlayerProfile, PlayerProfileBenchmarkStat, PlayerProfileGame } from "@/lib/player-profile-types";

const ROLLING_WINDOW_CAP = 100;
const MAX_ACTIVE_STATS = 4;

const TREND_COLORS = [
  "#c2410c",
  "#1d4ed8",
  "#15803d",
  "#7c3aed",
  "#db2777",
  "#0891b2",
] as const;

type ScaleFamily = "percent" | "count" | "ratio" | "rating" | "plusMinus";

type TrendStatId =
  | "points"
  | "minutes"
  | "rebounds"
  | "offensiveRebounds"
  | "defensiveRebounds"
  | "assists"
  | "assistTurnoverRatio"
  | "steals"
  | "blocks"
  | "turnovers"
  | "plusMinus"
  | "fieldGoalPct"
  | "threePointPct"
  | "freeThrowPct"
  | "trueShootingPct"
  | "effectiveFieldGoalPct"
  | "finalPerformanceScore";

type TrendStatOption = {
  id: TrendStatId;
  label: string;
  short: string;
  suffix: string;
  description?: string;
  read: (game: PlayerProfileGame) => number | null;
  requiresValue?: boolean;
  percentScale?: boolean;
  benchmarkKey?: PlayerProfileBenchmarkStat;
};

const TREND_STATS: TrendStatOption[] = [
  { id: "points", label: "Points", short: "PTS", suffix: "", read: (g) => g.points, benchmarkKey: "points" },
  { id: "minutes", label: "Minutes", short: "MIN", suffix: "", read: (g) => g.minutes, requiresValue: true },
  { id: "fieldGoalPct", label: "Field goal %", short: "FG%", suffix: "%", read: (g) => g.fieldGoalPct, requiresValue: true, percentScale: true },
  { id: "threePointPct", label: "Three-point %", short: "3P%", suffix: "%", read: (g) => g.threePointPct, requiresValue: true, percentScale: true },
  { id: "freeThrowPct", label: "Free throw %", short: "FT%", suffix: "%", read: (g) => g.freeThrowPct, requiresValue: true, percentScale: true },
  { id: "trueShootingPct", label: "True shooting", short: "TS%", suffix: "%", read: (g) => g.trueShootingPct, requiresValue: true, percentScale: true, benchmarkKey: "trueShootingPct" },
  { id: "effectiveFieldGoalPct", label: "Effective FG%", short: "eFG%", suffix: "%", read: (g) => g.effectiveFieldGoalPct, requiresValue: true, percentScale: true },
  { id: "rebounds", label: "Rebounds", short: "REB", suffix: "", read: (g) => g.rebounds, benchmarkKey: "rebounds" },
  { id: "offensiveRebounds", label: "Offensive rebounds", short: "OREB", suffix: "", read: (g) => g.offensiveRebounds, requiresValue: true },
  { id: "defensiveRebounds", label: "Defensive rebounds", short: "DREB", suffix: "", read: (g) => g.defensiveRebounds, requiresValue: true },
  { id: "assists", label: "Assists", short: "AST", suffix: "", read: (g) => g.assists, benchmarkKey: "assists" },
  { id: "turnovers", label: "Turnovers", short: "TOV", suffix: "", read: (g) => g.turnovers, requiresValue: true },
  { id: "assistTurnoverRatio", label: "Assist / turnover", short: "AST/TO", suffix: "", read: (g) => g.assistTurnoverRatio, requiresValue: true },
  { id: "steals", label: "Steals", short: "STL", suffix: "", read: (g) => g.steals, requiresValue: true },
  { id: "blocks", label: "Blocks", short: "BLK", suffix: "", read: (g) => g.blocks, requiresValue: true },
  { id: "plusMinus", label: "Plus / minus", short: "+/-", suffix: "", read: (g) => g.plusMinus, requiresValue: true },
  {
    id: "finalPerformanceScore",
    label: "Peach Basket score",
    short: "GPS",
    suffix: "",
    description: "Formula v1 game score — scaled vs others in the same competition pool (0–100).",
    read: (g) => g.finalPerformanceScore,
    requiresValue: true,
  },
];

type AxisState = { yMin: number; yMax: number; ticks: number[] };

type ActiveSeries = {
  option: TrendStatOption;
  color: string;
  rolling: (number | null)[];
};

type SearchPlayer = {
  type: "Player";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

function statOption(id: TrendStatId) {
  return TREND_STATS.find((item) => item.id === id)!;
}

function scaleFamily(option: TrendStatOption): ScaleFamily {
  if (option.percentScale) return "percent";
  if (option.id === "finalPerformanceScore") return "rating";
  if (option.id === "plusMinus") return "plusMinus";
  if (option.id === "assistTurnoverRatio") return "ratio";
  return "count";
}

function statsCompatible(left: TrendStatOption, right: TrendStatOption) {
  return scaleFamily(left) === scaleFamily(right);
}

function chronologicalGames(games: PlayerProfileGame[]) {
  return [...games].sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime());
}

function statHasEnoughGames(games: PlayerProfileGame[], option: TrendStatOption) {
  if (option.requiresValue) {
    return games.filter((g) => option.read(g) !== null).length >= 2;
  }
  return games.length >= 2;
}

function rollingWindowMax(gameCount: number) {
  return Math.min(ROLLING_WINDOW_CAP, gameCount);
}

function optimalRollingWindow(gameCount: number) {
  const cap = rollingWindowMax(gameCount);
  if (cap <= 1) return 1;
  if (cap <= 5) return Math.max(2, Math.floor(cap / 2));
  if (cap <= 12) return 5;
  if (cap <= 30) return Math.min(8, Math.round(Math.sqrt(cap)));
  if (cap <= 60) return 10;
  return Math.min(12, Math.max(10, Math.round(cap * 0.12)));
}

function rollingAverageNullable(values: (number | null)[], window: number) {
  return values.map((_, index) => {
    const slice = values
      .slice(Math.max(0, index - window + 1), index + 1)
      .filter((value): value is number => value !== null);
    if (!slice.length) return null;
    return Math.round((slice.reduce((sum, value) => sum + value, 0) / slice.length) * 10) / 10;
  });
}

function valuesForTimeline(games: PlayerProfileGame[], option: TrendStatOption) {
  return games.map((game) => {
    const value = option.read(game);
    if (option.requiresValue && value === null) return null;
    return value ?? 0;
  });
}

function buildSeries(games: PlayerProfileGame[], option: TrendStatOption, rollingWindow: number, color: string): ActiveSeries {
  const rolling = rollingAverageNullable(valuesForTimeline(games, option), rollingWindow);
  return { option, color, rolling };
}

function alignCompareRolling(primaryLength: number, compareGames: PlayerProfileGame[], option: TrendStatOption, rollingWindow: number) {
  const compareRolling = buildSeries(compareGames, option, rollingWindow, "").rolling;
  return Array.from({ length: primaryLength }, (_, index) => compareRolling[index] ?? null);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
}

function formatStatLine(game: PlayerProfileGame) {
  return `${game.points} PTS · ${game.rebounds} REB · ${game.assists} AST`;
}

function formatValue(value: number, option: TrendStatOption) {
  if (option.percentScale) return `${value.toFixed(1)}%`;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function buildYAxis(values: number[], options: TrendStatOption[]) {
  const allPercent = options.length > 0 && options.every((option) => option.percentScale);
  const allRating = options.length > 0 && options.every((option) => option.id === "finalPerformanceScore");

  if (allPercent || allRating) {
    const min = Math.min(...values, 0);
    const max = Math.max(...values, allRating ? 100 : 0);
    const yMin = Math.max(0, Math.floor((min - 8) / 5) * 5);
    const yMax = Math.min(100, Math.ceil((max + 8) / 5) * 5);
    const ticks: number[] = [];
    const step = yMax - yMin > 40 ? 10 : 5;
    for (let tick = yMin; tick <= yMax; tick += step) ticks.push(tick);
    return { yMin, yMax: Math.max(yMin + step, yMax), ticks };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const padding = Math.max(span * 0.18, 1);
  let yMin = min - padding;
  let yMax = max + padding;

  if (options.some((option) => option.id === "plusMinus")) {
    const bound = Math.max(Math.abs(yMin), Math.abs(yMax), 3);
    yMin = -Math.ceil(bound);
    yMax = Math.ceil(bound);
  } else {
    yMin = Math.max(0, yMin);
  }

  const rawStep = (yMax - yMin) / 5;
  const step = rawStep <= 1 ? 0.5 : rawStep <= 2.5 ? 1 : rawStep <= 6 ? 2 : rawStep <= 12 ? 5 : 10;
  yMin = Math.floor(yMin / step) * step;
  yMax = Math.ceil(yMax / step) * step;

  const ticks: number[] = [];
  for (let tick = yMin; tick <= yMax + step / 2; tick += step) {
    ticks.push(Math.round(tick * 10) / 10);
  }
  return { yMin, yMax, ticks };
}

function smoothPathFromSeries(
  values: (number | null)[],
  xAt: (index: number) => number,
  yAt: (value: number) => number
) {
  const points: { x: number; y: number }[] = [];
  values.forEach((value, index) => {
    if (value === null) return;
    points.push({ x: xAt(index), y: yAt(value) });
  });

  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return path;
}

function AnimatedTrendPath({
  d,
  color,
  animateKey,
  dashed = false,
  strokeWidth = 2.6,
}: {
  d: string;
  color: string;
  animateKey: number;
  dashed?: boolean;
  strokeWidth?: number;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const hasDrawnRef = useRef(false);

  useLayoutEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    if (d) path.setAttribute("d", d);
  }, [d]);

  useLayoutEffect(() => {
    const path = pathRef.current;
    if (!path || !d) return;

    const length = path.getTotalLength();
    const shouldAnimate = animateKey > 0 || !hasDrawnRef.current;
    hasDrawnRef.current = true;

    if (dashed) {
      if (!shouldAnimate) {
        path.style.transition = "none";
        path.style.strokeDasharray = "8 6";
        path.style.strokeDashoffset = "0";
        path.style.opacity = "0.9";
        return;
      }

      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length}`;
      path.style.opacity = "0.35";

      const frame = requestAnimationFrame(() => {
        path.style.transition = "stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.45s ease-out";
        path.style.strokeDashoffset = "0";
        path.style.opacity = "0.9";

        window.setTimeout(() => {
          if (pathRef.current !== path) return;
          path.style.transition = "none";
          path.style.strokeDasharray = "8 6";
          path.style.strokeDashoffset = "0";
        }, 920);
      });

      return () => cancelAnimationFrame(frame);
    }

    path.style.strokeDasharray = `${length}`;

    if (!shouldAnimate) {
      path.style.transition = "none";
      path.style.strokeDashoffset = "0";
      path.style.opacity = "1";
      return;
    }

    path.style.strokeDashoffset = `${length}`;
    path.style.opacity = "0.35";

    const frame = requestAnimationFrame(() => {
      path.style.transition = "stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.45s ease-out";
      path.style.strokeDashoffset = "0";
      path.style.opacity = "1";
    });

    return () => cancelAnimationFrame(frame);
  }, [animateKey, dashed]);

  if (!d) return null;

  return (
    <path
      ref={pathRef}
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      strokeLinecap="round"
      strokeDasharray={dashed ? "8 6" : undefined}
    />
  );
}

async function fetchProfile(playerKey: string): Promise<PlayerProfile | null> {
  const res = await fetch(`/api/players/${encodeURIComponent(playerKey)}/profile`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { profile: PlayerProfile };
  return data.profile;
}

async function searchPlayers(query: string): Promise<SearchPlayer[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=8`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { results: SearchPlayer[] };
  return data.results.filter((row) => row.type === "Player").slice(0, 8);
}

type Props = {
  profile: PlayerProfile;
  height?: number;
};

export function PlayerTrendsChart({ profile, height = 300 }: Props) {
  const games = useMemo(() => chronologicalGames(profile.allGames), [profile.allGames]);
  const availableStats = useMemo(
    () => TREND_STATS.filter((option) => statHasEnoughGames(games, option)),
    [games]
  );

  const [activeStatIds, setActiveStatIds] = useState<TrendStatId[]>([]);
  const [lineAnimKeys, setLineAnimKeys] = useState<Partial<Record<TrendStatId, number>>>({});
  const [compareAnimKey, setCompareAnimKey] = useState(0);
  const [rollingOverride, setRollingOverride] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const [compareOpen, setCompareOpen] = useState(false);
  const [compareQuery, setCompareQuery] = useState("");
  const [compareResults, setCompareResults] = useState<SearchPlayer[]>([]);
  const [compareSearching, setCompareSearching] = useState(false);
  const [compareLoadingProfile, setCompareLoadingProfile] = useState(false);
  const [compareProfile, setCompareProfile] = useState<PlayerProfile | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);

  const compareGames = useMemo(
    () => (compareProfile ? chronologicalGames(compareProfile.allGames) : []),
    [compareProfile]
  );

  const activeFamily = useMemo(() => {
    const first = activeStatIds[0];
    return first ? scaleFamily(statOption(first)) : null;
  }, [activeStatIds]);

  const maxRolling = rollingWindowMax(games.length);
  const recommendedRolling = useMemo(() => optimalRollingWindow(games.length), [games.length]);
  const rollingWindow = useMemo(() => {
    const raw = rollingOverride ?? recommendedRolling;
    return Math.min(maxRolling, Math.max(1, raw));
  }, [maxRolling, recommendedRolling, rollingOverride]);

  useEffect(() => {
    if (rollingOverride !== null && rollingOverride > maxRolling) {
      setRollingOverride(maxRolling);
    }
  }, [maxRolling, rollingOverride]);

  useEffect(() => {
    const query = compareQuery.trim();
    if (query.length < 2) {
      setCompareResults([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      setCompareSearching(true);
      try {
        setCompareResults(await searchPlayers(query));
      } finally {
        setCompareSearching(false);
      }
    }, 120);
    return () => window.clearTimeout(handle);
  }, [compareQuery]);

  const activeSeries = useMemo<ActiveSeries[]>(() => {
    return activeStatIds
      .map((id, index) => {
        const option = availableStats.find((item) => item.id === id);
        if (!option) return null;
        return buildSeries(games, option, rollingWindow, TREND_COLORS[index % TREND_COLORS.length]);
      })
      .filter((item): item is ActiveSeries => item !== null);
  }, [activeStatIds, availableStats, games, rollingWindow]);

  const compareSeries = useMemo(() => {
    if (!compareProfile || !compareGames.length) return [];
    return activeSeries.map((series) => ({
      option: series.option,
      color: series.color,
      rolling: alignCompareRolling(games.length, compareGames, series.option, rollingWindow),
    }));
  }, [activeSeries, compareGames, compareProfile, games.length, rollingWindow]);

  const singleSeries = activeSeries.length === 1 ? activeSeries[0] : null;

  const ageGroupAverage = useMemo(() => {
    if (!singleSeries?.option.benchmarkKey) return null;
    return profile.intelligence.benchmarks.stats[singleSeries.option.benchmarkKey]?.ageGroupAverage ?? null;
  }, [profile.intelligence.benchmarks.stats, singleSeries]);

  const targetAxis = useMemo(() => {
    const values = [
      ...activeSeries.flatMap((series) => series.rolling.filter((value): value is number => value !== null)),
      ...compareSeries.flatMap((series) => series.rolling.filter((value): value is number => value !== null)),
    ];
    if (ageGroupAverage !== null) values.push(ageGroupAverage);
    if (!values.length) return { yMin: 0, yMax: 10, ticks: [0, 2, 4, 6, 8, 10] };
    return buildYAxis(values, activeSeries.map((series) => series.option));
  }, [activeSeries, ageGroupAverage, compareSeries]);

  const axis = targetAxis;

  const toggleStat = useCallback((id: TrendStatId) => {
    const option = statOption(id);

    setActiveStatIds((current) => {
      const validCurrent = current.filter((statId) => availableStats.some((item) => item.id === statId));
      if (validCurrent.includes(id)) {
        return validCurrent.filter((item) => item !== id);
      }

      const anchor = validCurrent[0] ? statOption(validCurrent[0]) : null;
      if (anchor && !statsCompatible(anchor, option)) {
        setLineAnimKeys({ [id]: 1 });
        return [id];
      }

      if (validCurrent.length >= MAX_ACTIVE_STATS) return validCurrent;
      setLineAnimKeys((keys) => ({ ...keys, [id]: (keys[id] ?? 0) + 1 }));
      return [...validCurrent, id];
    });
  }, [availableStats]);

  const loadComparePlayer = useCallback(async (playerKey: string) => {
    setCompareError(null);
    setCompareLoadingProfile(true);
    try {
      const loaded = await fetchProfile(playerKey);
      if (!loaded) {
        setCompareError("Could not load that player.");
        setCompareProfile(null);
        return;
      }
      if (loaded.id === profile.id) {
        setCompareError("Pick a different player than the one on this profile.");
        setCompareProfile(null);
        return;
      }
      if (loaded.ageGroup !== profile.ageGroup || loaded.gender !== profile.gender) {
        setCompareError("Compare players in the same age group and gender.");
        setCompareProfile(null);
        return;
      }
      setCompareProfile(loaded);
      setCompareQuery("");
      setCompareResults([]);
      setCompareAnimKey((key) => key + 1);
      setLineAnimKeys((keys) => {
        const next = { ...keys };
        activeStatIds.forEach((id) => {
          next[id] = (keys[id] ?? 0) + 1;
        });
        return next;
      });
    } finally {
      setCompareLoadingProfile(false);
    }
  }, [activeStatIds, profile.ageGroup, profile.gender, profile.id]);

  if (!availableStats.length || games.length < 2) {
    return (
      <div className="flex min-h-[10rem] items-center justify-center border border-line-500 bg-paper-500/40 px-4 text-center text-sm font-semibold text-court-500">
        Need at least 2 verified games to chart player trends.
      </div>
    );
  }

  const chartReady = activeSeries.length > 0;

  const W = 640;
  const pad = { top: 20, right: 16, bottom: 46, left: 42 };
  const iW = W - pad.left - pad.right;
  const iH = height - pad.top - pad.bottom;
  const n = games.length;

  const xAt = (index: number) => pad.left + (n <= 1 ? iW / 2 : (index / (n - 1)) * iW);
  const yAt = (value: number) => pad.top + iH - ((value - axis.yMin) / Math.max(1, axis.yMax - axis.yMin)) * iH;
  const stride = n <= 8 ? 1 : n <= 16 ? 2 : Math.ceil(n / 8);
  const hovered = hoverIndex !== null ? games[hoverIndex] : null;
  const compareHovered = hoverIndex !== null && compareGames[hoverIndex] ? compareGames[hoverIndex] : null;
  const tooltipOnLeft = hoverIndex !== null && hoverIndex > n * 0.62;
  const atRecommended = rollingWindow === recommendedRolling;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-xs font-black uppercase tracking-[0.12em] text-hardwood-600">Player trends</h3>
        <button
          type="button"
          onClick={() => setCompareOpen((open) => !open)}
          className={`border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.08em] transition ${
            compareOpen || compareProfile
              ? "border-hardwood-600 bg-hardwood-600 text-white"
              : "border-line-500 bg-white text-court-700 hover:border-hardwood-600"
          }`}
        >
          {compareProfile ? `Comparing · ${compareProfile.displayName}` : "Compare player"}
        </button>
      </div>

      {compareOpen ? (
        <div className="mt-3">
          <input
            value={compareQuery}
            onChange={(event) => setCompareQuery(event.target.value)}
            placeholder="Search by name"
            aria-label="Search player to compare"
            className="w-full border border-line-500 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-hardwood-600"
          />
          {compareSearching || compareLoadingProfile ? (
            <p className="mt-2 text-xs text-court-500">{compareLoadingProfile ? "Loading player…" : "Searching…"}</p>
          ) : null}
          {compareError ? <p className="mt-2 text-xs font-semibold text-amber-800">{compareError}</p> : null}
          <ul className="mt-2 divide-y divide-line-500">
            {compareResults.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  disabled={compareLoadingProfile}
                  onClick={() => void loadComparePlayer(row.id)}
                  className="w-full px-1 py-2 text-left text-sm hover:bg-paper-500/80 disabled:opacity-60"
                >
                  <strong className="block font-bold text-court-900">{row.title}</strong>
                  <span className="text-xs text-court-500">{row.subtitle}</span>
                </button>
              </li>
            ))}
          </ul>
          {compareProfile ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-court-600">
                Dashed lines = <strong>{compareProfile.displayName}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setCompareProfile(null);
                  setCompareError(null);
                  setCompareAnimKey(0);
                  setLineAnimKeys((keys) => {
                    const next = { ...keys };
                    activeStatIds.forEach((id) => {
                      next[id] = (keys[id] ?? 0) + 1;
                    });
                    return next;
                  });
                }}
                className="text-[0.62rem] font-bold uppercase tracking-[0.08em] text-court-500 hover:text-hardwood-600"
              >
                Clear
              </button>
              <Link
                href={`/players/compare?a=${profile.slug}&b=${compareProfile.slug}`}
                className="text-[0.62rem] font-bold uppercase tracking-[0.08em] text-hardwood-600 hover:underline"
              >
                Full compare →
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="rolling-window" className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-court-500">
            Rolling window
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tabular-nums text-court-900">
              {rollingWindow} game{rollingWindow === 1 ? "" : "s"}
            </span>
            {atRecommended ? <span className="text-[0.62rem] font-semibold text-hardwood-600">Recommended</span> : null}
            {rollingOverride !== null ? (
              <button
                type="button"
                onClick={() => setRollingOverride(null)}
                className="text-[0.62rem] font-bold uppercase tracking-[0.08em] text-court-500 hover:text-hardwood-600"
              >
                Reset
              </button>
            ) : null}
          </div>
        </div>
        <input
          id="rolling-window"
          type="range"
          min={1}
          max={maxRolling}
          step={1}
          value={rollingWindow}
          onChange={(event) => setRollingOverride(Number(event.target.value))}
          className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-line-500 accent-hardwood-600 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-hardwood-600"
        />
      </div>

      <div className="mt-3">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-court-500">Stats</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {availableStats.map((item) => {
            const active = activeStatIds.includes(item.id);
            const colorIndex = activeStatIds.indexOf(item.id);
            const color = colorIndex >= 0 ? TREND_COLORS[colorIndex % TREND_COLORS.length] : undefined;
            const incompatible =
              activeFamily !== null &&
              !active &&
              scaleFamily(item) !== activeFamily;
            return (
              <button
                key={item.id}
                type="button"
                title={
                  incompatible
                    ? `${item.label} — different scale; click to switch`
                    : item.description
                }
                onClick={() => toggleStat(item.id)}
                className={`border px-2 py-1 text-xs font-bold transition ${
                  active
                    ? "text-white"
                    : incompatible
                      ? "border-line-500 bg-paper-500 text-court-400 hover:border-hardwood-600 hover:text-court-700"
                      : "border-line-500 bg-white text-court-700 hover:border-hardwood-600"
                }`}
                style={active ? { borderColor: color, backgroundColor: color } : undefined}
                aria-pressed={active}
              >
                {item.short}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative mt-3" onMouseLeave={() => setHoverIndex(null)}>
        {!chartReady ? (
          <div className="flex min-h-[12rem] items-center justify-center border border-line-500 bg-white px-4 text-center text-sm font-semibold text-court-500">
            Select a stat above to view rolling-average trends.
          </div>
        ) : (
        <svg width="100%" viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Player rolling-average trends" className="block">
          {axis.ticks.map((tick) => (
            <g key={tick}>
              <line x1={pad.left} y1={yAt(tick)} x2={pad.left + iW} y2={yAt(tick)} stroke="#e8e4df" strokeWidth={1} />
              <text
                x={pad.left - 6}
                y={yAt(tick) + 4}
                textAnchor="end"
                className="fill-court-500 text-[10px] font-semibold transition-[y] duration-300 ease-out"
              >
                {singleSeries?.option.percentScale ? `${tick}%` : tick}
              </text>
            </g>
          ))}

          <line x1={pad.left} y1={pad.top + iH} x2={pad.left + iW} y2={pad.top + iH} stroke="#d4cfc8" strokeWidth={1.5} />

          {ageGroupAverage !== null && singleSeries ? (
            <g>
              <line
                x1={pad.left}
                y1={yAt(ageGroupAverage)}
                x2={pad.left + iW}
                y2={yAt(ageGroupAverage)}
                stroke="#1d4ed8"
                strokeWidth={1.5}
                strokeDasharray="6 4"
              />
              <text
                x={pad.left + iW}
                y={yAt(ageGroupAverage) - 4}
                textAnchor="end"
                className="fill-[#1d4ed8] text-[9px] font-bold transition-[y] duration-300 ease-out"
              >
                {profile.ageGroup} avg {formatValue(ageGroupAverage, singleSeries.option)}
              </text>
            </g>
          ) : null}

          {activeSeries.map((series) => {
            const path = smoothPathFromSeries(series.rolling, xAt, yAt);
            return (
              <AnimatedTrendPath
                key={`${profile.slug}-${series.option.id}`}
                d={path}
                color={series.color}
                animateKey={lineAnimKeys[series.option.id] ?? 0}
              />
            );
          })}

          {compareSeries.map((series) => {
            const path = smoothPathFromSeries(series.rolling, xAt, yAt);
            return (
              <AnimatedTrendPath
                key={`compare-${compareProfile?.slug}-${series.option.id}`}
                d={path}
                color={series.color}
                animateKey={compareAnimKey}
                dashed
                strokeWidth={2.2}
              />
            );
          })}

          {games.map((game, index) => (
            <circle
              key={`wl-${game.gameId}`}
              cx={xAt(index)}
              cy={pad.top + iH + 8}
              r={3}
              fill={game.result === "W" ? "#16a34a" : "#dc2626"}
            />
          ))}

          {games.map((game, index) => {
            if (index % stride !== 0 && index !== n - 1) return null;
            const anchor = index === 0 ? "start" : index === n - 1 ? "end" : "middle";
            return (
              <text
                key={`xl-${game.gameId}`}
                x={xAt(index)}
                y={height - 6}
                textAnchor={anchor}
                className="fill-court-500 text-[9px] font-semibold"
              >
                {compareProfile ? `G${index + 1}` : formatShortDate(game.gameDate)}
              </text>
            );
          })}

          {hoverIndex !== null ? (
            <g>
              <line
                x1={xAt(hoverIndex)}
                y1={pad.top}
                x2={xAt(hoverIndex)}
                y2={pad.top + iH}
                stroke="#a8a29e"
                strokeWidth={1}
                strokeDasharray="4 3"
              />
              {activeSeries.map((series) => {
                const value = series.rolling[hoverIndex];
                if (value === null) return null;
                return (
                  <circle
                    key={`hover-${series.option.id}`}
                    cx={xAt(hoverIndex)}
                    cy={yAt(value)}
                    r={4.5}
                    fill={series.color}
                    stroke="#fff"
                    strokeWidth={1.5}
                  />
                );
              })}
              {compareSeries.map((series) => {
                const value = series.rolling[hoverIndex];
                if (value === null) return null;
                return (
                  <circle
                    key={`hover-compare-${series.option.id}`}
                    cx={xAt(hoverIndex)}
                    cy={yAt(value)}
                    r={4.5}
                    fill={series.color}
                    stroke="#fff"
                    strokeWidth={1.5}
                    opacity={0.92}
                  />
                );
              })}
            </g>
          ) : null}

          {games.map((_, index) => (
            <rect
              key={`hit-${index}`}
              x={xAt(index) - iW / n / 2}
              y={pad.top}
              width={iW / n}
              height={iH + 8}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(index)}
              style={{ cursor: "pointer" }}
            />
          ))}
        </svg>
        )}

        {chartReady && hovered && hoverIndex !== null ? (
          <div
            className="pointer-events-none absolute top-0 z-10 w-64 border border-line-500 bg-white p-2.5 shadow-lg"
            style={{
              left: tooltipOnLeft
                ? `calc(${((xAt(hoverIndex) - pad.left) / iW) * 100}% - 16rem)`
                : `calc(${((xAt(hoverIndex) - pad.left) / iW) * 100}% + 0.75rem)`,
              transform: "translateY(-28%)",
            }}
          >
            <p className="text-sm font-bold text-court-900">
              {compareProfile
                ? `${profile.displayName} · Game ${hoverIndex + 1} vs ${hovered.opponentName}`
                : `${profile.displayName} vs ${hovered.opponentName}`}
            </p>
            <p className="text-xs font-semibold text-court-500">
              {compareProfile ? `Game ${hoverIndex + 1} on chart` : formatDate(hovered.gameDate)}
            </p>
            {compareHovered && compareProfile ? (
              <p className="mt-1 text-xs font-semibold text-court-500">
                {compareProfile.displayName} · Game {hoverIndex + 1} vs {compareHovered.opponentName}
              </p>
            ) : null}
            <ul className="mt-2 space-y-1 border-t border-line-500 pt-2">
              {activeSeries.map((series) => {
                const value = series.rolling[hoverIndex];
                if (value === null) return null;
                return (
                  <li key={series.option.id} className="flex items-center justify-between gap-2 text-[0.68rem] font-semibold text-court-600">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: series.color }} />
                      {series.option.short}
                    </span>
                    <strong className="text-court-900">{formatValue(value, series.option)}</strong>
                  </li>
                );
              })}
              {compareProfile
                ? compareSeries.map((series) => {
                    const value = series.rolling[hoverIndex];
                    if (value === null) return null;
                    return (
                      <li key={`compare-${series.option.id}`} className="flex items-center justify-between gap-2 text-[0.68rem] font-semibold text-court-600">
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block h-0 w-3 border-t-2 border-dashed" style={{ borderColor: series.color }} />
                          {series.option.short}
                        </span>
                        <strong className="text-court-900">{formatValue(value, series.option)}</strong>
                      </li>
                    );
                  })
                : null}
            </ul>
            <p className="mt-1.5 text-[0.62rem] font-semibold text-court-400">{rollingWindow}-game rolling avg</p>
            <Link
              href={`/games/${hovered.gameId}`}
              className="pointer-events-auto mt-2 block text-[0.68rem] font-bold uppercase tracking-[0.1em] text-hardwood-600 hover:underline"
            >
              View box score →
            </Link>
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {chartReady ? activeSeries.map((series) => (
          <LegendItem key={series.option.id} color={series.color} label={series.option.short} bold />
        )) : null}
        {chartReady && compareProfile
          ? activeSeries.map((series) => (
              <LegendItem key={`compare-${series.option.id}`} color={series.color} label={series.option.short} dashed />
            ))
          : null}
        {compareProfile ? (
          <span className="text-[0.68rem] font-semibold text-court-500">Dashed = {compareProfile.displayName}</span>
        ) : null}
        {ageGroupAverage !== null && singleSeries ? (
          <LegendItem color="#1d4ed8" dashed label={`${profile.ageGroup} avg`} />
        ) : null}
        <LegendItem color="#16a34a" dot label="Win" />
        <LegendItem color="#dc2626" dot label="Loss" />
      </div>

      <p className="mt-3 text-[0.68rem] font-semibold leading-5 text-court-500">
        <strong className="text-court-700">GPS</strong> is Peach Basket&apos;s competition-scaled game performance score (0–100) used in ratings.
      </p>
    </div>
  );
}

function LegendItem({
  color,
  label,
  dot = false,
  bold = false,
  dashed = false,
  opacity = 1,
}: {
  color: string;
  label: string;
  dot?: boolean;
  bold?: boolean;
  dashed?: boolean;
  opacity?: number;
}) {
  return (
    <span className="flex items-center gap-1.5">
      {dot ? (
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color, opacity }} />
      ) : dashed ? (
        <span className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: color, opacity }} />
      ) : (
        <span className="inline-block h-[3px] w-4" style={{ backgroundColor: color, opacity }} />
      )}
      <span className={`text-[0.68rem] font-semibold text-court-600 ${bold ? "font-bold" : ""}`}>{label}</span>
    </span>
  );
}
