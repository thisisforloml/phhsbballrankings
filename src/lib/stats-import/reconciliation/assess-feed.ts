import type { FeedAssessment, FeedCompleteness } from "@/lib/stats-import/reconciliation/types";

const BOX_STAT_KEYS = [
  "sPoints",
  "sMinutes",
  "sFieldGoalsAttempted",
  "sFieldGoalsMade",
  "sThreePointersAttempted",
  "sTwoPointersAttempted",
  "sFreeThrowsAttempted",
  "sReboundsTotal",
  "sAssists",
  "sTurnovers"
] as const;

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function playerHasBoxStatFields(player: Record<string, unknown>) {
  return BOX_STAT_KEYS.some((key) => player[key] !== undefined);
}

function sumPlayerStat(players: Record<string, unknown>[], key: string) {
  return players.reduce((sum, player) => sum + numberValue(player[key]), 0);
}

function isAtPeriodStart(clock: string, periodLength: number) {
  if (!clock) return false;
  if (clock === `${periodLength}:00`) return true;
  return clock === "10:00" || clock === "12:00";
}

export function assessFeedCompleteness(fibaData: Record<string, unknown>): FeedAssessment {
  const signals: string[] = [];
  const home = (fibaData.tm as Record<string, Record<string, unknown>> | undefined)?.["1"];
  const away = (fibaData.tm as Record<string, Record<string, unknown>> | undefined)?.["2"];
  const homePlayers = Object.values((home?.pl as Record<string, Record<string, unknown>>) ?? {});
  const awayPlayers = Object.values((away?.pl as Record<string, Record<string, unknown>>) ?? {});
  const allPlayers = [...homePlayers, ...awayPlayers];
  const homeScore = numberValue(home?.score);
  const awayScore = numberValue(away?.score);
  const sumHomePts = sumPlayerStat(homePlayers, "sPoints");
  const sumAwayPts = sumPlayerStat(awayPlayers, "sPoints");
  const playersWithBoxFields = allPlayers.filter(playerHasBoxStatFields).length;
  const totalPlayers = allPlayers.length;

  const period = numberValue(fibaData.period);
  const clock = stringValue(fibaData.clock);
  const periodLength = numberValue(fibaData.periodLength) || 10;
  const inOT = numberValue(fibaData.inOT);
  const pregameClock =
    period === 1 && isAtPeriodStart(clock, periodLength) && inOT === 0 && homeScore === 0 && awayScore === 0;

  if (pregameClock) signals.push("pregame_clock");
  if (playersWithBoxFields === 0 && totalPlayers > 0) signals.push("no_box_stat_fields");
  if (totalPlayers === 0) signals.push("no_players");

  const hasMeaningfulStats =
    playersWithBoxFields > 0 &&
    (sumHomePts > 0 ||
      sumAwayPts > 0 ||
      allPlayers.some((player) => {
        const minutes = player.sMinutes;
        if (typeof minutes === "string" && minutes !== "0:00" && minutes !== "00:00") return true;
        return numberValue(minutes) > 0;
      }));

  const ptsMatchScores = sumHomePts === homeScore && sumAwayPts === awayScore;
  const scoresNonZero = homeScore > 0 || awayScore > 0;

  let completeness: FeedCompleteness;
  if (playersWithBoxFields === 0 || (pregameClock && !hasMeaningfulStats)) {
    completeness = "empty";
  } else if (hasMeaningfulStats && ptsMatchScores && scoresNonZero) {
    completeness = "complete";
  } else if (playersWithBoxFields > 0) {
    completeness = "partial";
  } else {
    completeness = "empty";
  }

  if (completeness === "partial" && ptsMatchScores && scoresNonZero) {
    completeness = "complete";
  }

  return {
    completeness,
    signals,
    homeScore,
    awayScore,
    sumHomePts,
    sumAwayPts,
    playersWithBoxFields,
    totalPlayers
  };
}
