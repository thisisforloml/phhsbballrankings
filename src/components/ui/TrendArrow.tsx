import { ArrowDown, ArrowUp, Minus } from "lucide-react";

export function TrendArrow({ trend, delta }: { trend: "up" | "down" | "flat"; delta: number }) {
  const Icon = trend === "up" ? ArrowUp : trend === "down" ? ArrowDown : Minus;
  const color = trend === "up" ? "text-navy-800" : trend === "down" ? "text-loss-text" : "text-ink-500";
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-mono-sm ${color}`}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {trend === "flat" ? "0" : delta}
    </span>
  );
}
