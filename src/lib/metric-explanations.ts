export const METRIC_EXPLANATIONS: Record<string, string> = {
  PPG: "Points per game across verified official stat rows in the current age group.",
  RPG: "Rebounds per game from verified box scores.",
  APG: "Assists per game from verified box scores.",
  MPG: "Minutes per game when minutes are recorded on the stat sheet.",
  "FG%": "Field goals made divided by field goals attempted.",
  "2P%": "Two-point field goals made divided by two-point attempts.",
  "3P%": "Three-point field goals made divided by three-point attempts.",
  "FT%": "Free throws made divided by free throw attempts.",
  "eFG%": "Effective field goal percentage — rewards made threes more than twos.",
  "TS%": "True shooting percentage — scoring efficiency including free throws.",
  "AST/TO": "Assist-to-turnover ratio when both stats are tracked.",
  "STL+BLK": "Steals plus blocks per game — defensive activity from the box score.",
  percentile: "Where this player ranks within the same age group and gender on the current public board (higher is better).",
  radar: "Six profile categories compared to peers on the same board. Sample reflects verified game count.",
  trend: "Per-game scoring and production from official stat rows, oldest to newest.",
  rankingTrend: "Historical national rank snapshots when enough history exists.",
  scouting: "Strengths-only summary from verified stats. No subjective scouting language.",
  compare: "Side-by-side view for two players in the same age group and gender. Presentation only — does not change ratings."
};

export function metricHelp(key: string) {
  return METRIC_EXPLANATIONS[key] ?? "";
}
