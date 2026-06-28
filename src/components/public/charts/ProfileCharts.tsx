"use client";

import { useId, useMemo, useState } from "react";

export type RadarPoint = { label: string; value: number; detail?: string };

type RadarChartProps = {
  points: RadarPoint[];
  max?: number;
  ariaLabel: string;
};

export function RadarChart({ points, max = 100, ariaLabel }: RadarChartProps) {
  const id = useId();
  const size = 280;
  const center = size / 2;
  const radius = size * 0.34;
  const angleStep = (Math.PI * 2) / Math.max(points.length, 1);

  const toXY = (index: number, value: number) => {
    const angle = -Math.PI / 2 + index * angleStep;
    const r = (Math.max(0, Math.min(max, value)) / max) * radius;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  };

  const polygon = points
    .map((point, index) => {
      const { x, y } = toXY(index, point.value);
      return `${x},${y}`;
    })
    .join(" ");

  const gridLevels = [0.25, 0.5, 0.75, 1];

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(11rem,0.85fr)] md:items-center">
      <figure className="min-w-0">
        <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel} className="mx-auto block h-auto w-full max-w-[280px]">
          <defs>
            <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d97706" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#d97706" stopOpacity="0.08" />
            </linearGradient>
          </defs>
          {gridLevels.map((level) => (
            <polygon
              key={level}
              points={points
                .map((_, index) => {
                  const { x, y } = toXY(index, max * level);
                  return `${x},${y}`;
                })
                .join(" ")}
              fill="none"
              stroke="currentColor"
              className="text-line-500"
              strokeWidth={1}
            />
          ))}
          {points.map((point, index) => {
            const outer = toXY(index, max);
            const inner = toXY(index, 0);
            return (
              <line key={point.label} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="currentColor" className="text-line-500" strokeWidth={1} />
            );
          })}
          <polygon points={polygon} fill={`url(#${id}-fill)`} stroke="#c2410c" strokeWidth={2} />
          {points.map((point, index) => {
            const { x, y } = toXY(index, point.value);
            return <circle key={`${id}-${point.label}`} cx={x} cy={y} r={3.5} fill="#c2410c" />;
          })}
          {points.map((point, index) => {
            const label = toXY(index, max * 1.14);
            return (
              <text
                key={`${id}-label-${point.label}`}
                x={label.x}
                y={label.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-court-700 text-[10px] font-bold"
              >
                {point.label}
              </text>
            );
          })}
        </svg>
        <figcaption className="sr-only">{ariaLabel}</figcaption>
      </figure>
      <ul className="grid gap-1.5">
        {points.map((point) => (
          <li key={point.label}>
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-court-600">
              <span>{point.label}</span>
              <span className="font-display text-sm font-black text-hardwood-600">{point.value}</span>
            </div>
            {point.detail ? <p className="text-[0.62rem] font-semibold text-court-500">{point.detail}</p> : null}
            <p className="mt-0.5 text-[0.62rem] font-semibold text-court-500">board percentile</p>
            <div className="mt-1 h-1.5 bg-line-500">
              <div className="h-1.5 bg-hardwood-600 transition-all" style={{ width: `${Math.max(4, point.value)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type LineSeries = { key: string; label: string; color: string; values: number[]; dashed?: boolean; fillArea?: boolean };

export type ReferenceLine = { label: string; value: number; color: string };

type LineTrendChartProps = {
  labels: string[];
  series: LineSeries[];
  ariaLabel: string;
  height?: number;
  /** ISO dates parallel to each data point — enables calendar x-axis with monthly ticks */
  dates?: string[];
  /** Custom y-axis tick formatter — overrides default `${value}${valueSuffix}` */
  yTickFormat?: (value: number) => string;
  /** Weekly or monthly x-axis labels when `dates` is provided */
  xAxisGranularity?: "week" | "month";
  /** Horizontal benchmark lines (e.g. league / age-group averages) */
  referenceLines?: ReferenceLine[];
  /** Append to y-axis tick values, e.g. "%" */
  valueSuffix?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function formatAxisMonth(ms: number, style: "long" | "short", includeYear: boolean) {
  const date = new Date(ms);
  const month = date.toLocaleDateString("en", { month: style, timeZone: "UTC" });
  if (!includeYear) return month;
  const year = date.toLocaleDateString("en", { year: "numeric", timeZone: "UTC" });
  return `${month} ${year}`;
}

function countMonthsInSpan(minMs: number, maxMs: number) {
  let count = 0;
  let cursor = startOfUtcMonth(minMs);
  const end = startOfUtcMonth(maxMs);
  while (cursor <= end) {
    count += 1;
    cursor = addUtcMonths(cursor, 1);
  }
  return Math.max(1, count);
}

function startOfUtcDay(ms: number) {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function labelStride(count: number) {
  if (count <= 6) return 1;
  if (count <= 10) return 2;
  return Math.ceil(count / 6);
}

function startOfUtcMonth(ms: number) {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

function endOfUtcMonth(ms: number) {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0);
}

function addUtcMonths(ms: number, months: number) {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1);
}

function buildWeeklyAxisTicks(minMs: number, maxMs: number) {
  const ticks: Array<{ ms: number; label: string }> = [];
  let cursor = startOfUtcWeek(minMs);
  const end = startOfUtcWeek(maxMs);
  while (cursor <= end) {
    ticks.push({
      ms: cursor,
      label: new Date(cursor).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" })
    });
    cursor += 7 * DAY_MS;
  }
  if (!ticks.length) {
    ticks.push({
      ms: startOfUtcWeek(minMs),
      label: new Date(startOfUtcWeek(minMs)).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" })
    });
  }
  return ticks;
}

function startOfUtcWeek(ms: number) {
  const date = new Date(ms);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + diff);
}
function buildMonthlyAxisTicks(minMs: number, maxMs: number) {
  const monthCount = countMonthsInSpan(minMs, maxMs);
  const labelStyle: "long" | "short" = monthCount <= 6 ? "long" : "short";
  const minYear = new Date(startOfUtcMonth(minMs)).getUTCFullYear();
  const maxYear = new Date(startOfUtcMonth(maxMs)).getUTCFullYear();
  const includeYear = minYear !== maxYear;
  const tickStride = monthCount > 10 ? 2 : 1;

  const ticks: Array<{ ms: number; label: string }> = [];
  let cursor = startOfUtcMonth(minMs);
  const end = startOfUtcMonth(maxMs);
  let index = 0;
  while (cursor <= end) {
    if (index % tickStride === 0 || cursor === end) {
      ticks.push({ ms: cursor, label: formatAxisMonth(cursor, labelStyle, includeYear) });
    }
    cursor = addUtcMonths(cursor, 1);
    index += 1;
  }
  if (!ticks.length) {
    ticks.push({ ms: startOfUtcMonth(minMs), label: formatAxisMonth(minMs, labelStyle, includeYear) });
  }
  return ticks;
}

function buildYAxis(maxValue: number, step = 5) {
  const yMax = Math.max(step, Math.ceil(maxValue / step) * step);
  const ticks: number[] = [];
  for (let tick = 0; tick <= yMax; tick += step) {
    ticks.push(tick);
  }
  return { yMax, ticks };
}

export function LineTrendChart({
  labels,
  series,
  ariaLabel,
  height = 200,
  dates,
  xAxisGranularity = "month",
  yTickFormat,
  referenceLines = [],
  valueSuffix = ""
}: LineTrendChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const width = 640;
  const pad = { top: 16, right: 16, bottom: 36, left: 40 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const visibleSeries = useMemo(() => series.filter((s) => !hidden[s.key]), [hidden, series]);
  const allValues = visibleSeries.flatMap((s) => s.values).concat(referenceLines.map((line) => line.value));
  const dataMax = Math.max(0, ...allValues);
  const { yMax, ticks: yTicks } = useMemo(() => buildYAxis(dataMax), [dataMax]);
  const stride = labelStride(labels.length);

  const dateAxis = useMemo(() => {
    if (!dates?.length) return null;
    const parsed = dates.map((iso) => startOfUtcDay(new Date(iso).getTime()));
    let minMs = Math.min(...parsed);
    let maxMs = Math.max(...parsed);
    if (xAxisGranularity === "month") {
      minMs = startOfUtcMonth(minMs);
      maxMs = endOfUtcMonth(maxMs);
    } else {
      minMs = startOfUtcWeek(minMs);
      maxMs = startOfUtcDay(startOfUtcWeek(maxMs) + 6 * DAY_MS);
    }
    const span = Math.max(DAY_MS, maxMs - minMs);
    return {
      minMs,
      maxMs,
      span,
      parsed,
      ticks: xAxisGranularity === "week" ? buildWeeklyAxisTicks(minMs, maxMs) : buildMonthlyAxisTicks(minMs, maxMs)
    };
  }, [dates, xAxisGranularity]);

  const xAt = (index: number) => {
    if (dateAxis) {
      if (dates!.length <= 1) return pad.left + innerW / 2;
      return pad.left + ((dateAxis.parsed[index] - dateAxis.minMs) / dateAxis.span) * innerW;
    }
    return pad.left + (labels.length <= 1 ? innerW / 2 : (index / (labels.length - 1)) * innerW);
  };

  const xAtMs = (ms: number) => pad.left + ((ms - dateAxis!.minMs) / dateAxis!.span) * innerW;
  const yAt = (value: number) => pad.top + innerH - (value / yMax) * innerH;

  function toggleSeries(key: string) {
    setHidden((current) => {
      const next = { ...current, [key]: !current[key] };
      const visibleCount = series.filter((s) => !next[s.key]).length;
      if (visibleCount === 0) return current;
      return next;
    });
  }

  return (
    <figure className="w-full">
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        className="block"
        onMouseLeave={() => setHoverIndex(null)}
      >
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} y1={yAt(tick)} x2={pad.left + innerW} y2={yAt(tick)} stroke="#e8e4df" strokeWidth={1} />
            <text x={pad.left - 8} y={yAt(tick) + 4} textAnchor="end" className="fill-court-500 text-[10px] font-semibold">
              {yTickFormat ? yTickFormat(tick) : `${tick}${valueSuffix}`}
            </text>
          </g>
        ))}
        <line x1={pad.left} y1={pad.top + innerH} x2={pad.left + innerW} y2={pad.top + innerH} stroke="#d4cfc8" strokeWidth={1.5} />

        {referenceLines.map((line) => (
          <g key={line.label}>
            <line
              x1={pad.left}
              y1={yAt(line.value)}
              x2={pad.left + innerW}
              y2={yAt(line.value)}
              stroke={line.color}
              strokeWidth={1.5}
              strokeDasharray="6 4"
            />
            <text x={pad.left + innerW} y={yAt(line.value) - 4} textAnchor="end" className="text-[9px] font-bold" fill={line.color}>
              {line.label} {line.value}
              {valueSuffix}
            </text>
          </g>
        ))}

        {visibleSeries.map((s) => {
          const d = s.values
            .map((value, index) => `${index === 0 ? "M" : "L"} ${xAt(index)} ${yAt(value)}`)
            .join(" ");
          const strokeProps = {
            fill: "none" as const,
            stroke: s.color,
            strokeWidth: s.dashed ? 2 : 2.5,
            strokeLinejoin: "round" as const,
            strokeLinecap: "round" as const,
            strokeDasharray: s.dashed ? "6 4" : undefined
          };
          if (s.fillArea && s.values.length > 1) {
            const area = `${d} L ${xAt(s.values.length - 1)} ${yAt(0)} L ${xAt(0)} ${yAt(0)} Z`;
            return (
              <g key={s.key}>
                <path d={area} fill="rgba(194,65,12,0.08)" />
                <path d={d} {...strokeProps} />
              </g>
            );
          }
          return <path key={s.key} d={d} {...strokeProps} />;
        })}

        {dateAxis
          ? dateAxis.ticks.map((tick, tickIndex) => {
              const x = xAtMs(tick.ms);
              const anchor =
                tickIndex === 0 ? "start" : tickIndex === dateAxis.ticks.length - 1 ? "end" : "middle";
              return (
                <text key={tick.ms} x={x} y={height - 10} textAnchor={anchor} className="fill-court-500 text-[10px] font-semibold">
                  {tick.label}
                </text>
              );
            })
          : labels.map((label, index) => (
              <g key={`${label}-${index}`}>
                {index % stride === 0 || index === labels.length - 1 ? (
                  <text x={xAt(index)} y={height - 10} textAnchor="middle" className="fill-court-500 text-[10px] font-semibold">
                    {label}
                  </text>
                ) : null}
              </g>
            ))}

        {labels.map((label, index) => (
          <rect
            key={`hover-${label}-${index}`}
            x={xAt(index) - (dates?.length ? 14 : innerW / labels.length / 2)}
            y={pad.top}
            width={dates?.length ? 28 : innerW / labels.length}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHoverIndex(index)}
          />
        ))}

        {hoverIndex !== null ? (
          <g>
            <line x1={xAt(hoverIndex)} y1={pad.top} x2={xAt(hoverIndex)} y2={pad.top + innerH} stroke="#a8a29e" strokeDasharray="4 3" />
            {visibleSeries.map((s) => (
              <circle key={s.key} cx={xAt(hoverIndex)} cy={yAt(s.values[hoverIndex] ?? 0)} r={4.5} fill={s.color} stroke="#fff" strokeWidth={1.5} />
            ))}
          </g>
        ) : null}
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {series.length > 1
          ? series.map((s) => {
              const active = !hidden[s.key];
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => toggleSeries(s.key)}
                  className={`inline-flex items-center gap-1.5 border px-2 py-1 text-xs font-bold transition ${
                    active ? "border-line-500 bg-white text-court-800" : "border-line-500 bg-paper-500 text-court-400 line-through"
                  }`}
                  aria-pressed={active}
                >
                  <span className="inline-block size-2 rounded-full" style={{ backgroundColor: active ? s.color : "#d4cfc8" }} />
                  {s.label}
                </button>
              );
            })
          : null}
        {referenceLines.map((line) => (
          <span key={line.label} className="inline-flex items-center gap-1.5 text-xs font-bold text-court-600">
            <span className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: line.color }} />
            {line.label}
          </span>
        ))}
      </div>

      {hoverIndex !== null ? (
        <div className="mt-2 border border-line-500 bg-paper-500 px-3 py-2 text-xs font-semibold text-court-700">
          <span className="font-black text-court-900">{labels[hoverIndex]}</span>
          <span className="mx-2 text-court-300">|</span>
          {visibleSeries.map((s) => `${s.label} ${s.values[hoverIndex]}${valueSuffix}`).join(" · ")}
        </div>
      ) : (
        <p className="mt-2 text-xs text-court-500">Hover a point for exact values{referenceLines.length ? "; dashed lines are benchmark averages." : "."}</p>
      )}
      <figcaption className="sr-only">{ariaLabel}</figcaption>
    </figure>
  );
}

// ── Percentile bar list ──────────────────────────────────────────────────────

export type PercentileBarItem = {
  key: string;
  label: string;
  percentile: number | null;
  detail: string;
};

function percentileBarColor(pct: number) {
  if (pct >= 80) return "#d97706"; // amber
  if (pct >= 60) return "#f59e0b"; // amber-light
  if (pct >= 40) return "#2563eb"; // blue
  return "#9ca3af";                // gray
}

export function PercentileBarList({ items, ariaLabel }: { items: PercentileBarItem[]; ariaLabel: string }) {
  return (
    <ul className="grid gap-3" aria-label={ariaLabel}>
      {items.map((item) => {
        const pct = item.percentile ?? 0;
        const color = item.percentile === null ? "#9ca3af" : percentileBarColor(pct);
        return (
          <li key={item.key}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-sm font-bold text-court-900">{item.label}</span>
                <span className="ml-2 text-xs font-semibold text-court-500">{item.detail}</span>
              </div>
              <strong
                className="shrink-0 font-display text-lg font-bold leading-none tabular-nums"
                style={{ color }}
              >
                {item.percentile === null ? "—" : item.percentile}
              </strong>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-line-500">
              <div
                className="h-2 rounded-full transition-[width] duration-300"
                style={{ width: `${Math.max(2, pct)}%`, backgroundColor: color }}
                role="progressbar"
                aria-valuenow={item.percentile ?? 0}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

type HorizontalBarChartProps = {
  rows: Array<{ label: string; value: number; detail?: string }>;
  max?: number;
  ariaLabel: string;
};

export function HorizontalBarChart({ rows, max, ariaLabel }: HorizontalBarChartProps) {
  const peak = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure>
      <ul className="grid gap-2" aria-label={ariaLabel}>
        {rows.map((row) => (
          <li key={row.label}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-bold text-court-900">{row.label}</span>
              <span className="font-bold text-hardwood-600">{row.value}</span>
            </div>
            {row.detail ? <p className="text-xs text-court-500">{row.detail}</p> : null}
            <div className="mt-1 h-2 bg-line-500">
              <div className="h-2 bg-hardwood-600" style={{ width: `${Math.max(4, (row.value / peak) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <figcaption className="sr-only">{ariaLabel}</figcaption>
    </figure>
  );
}
