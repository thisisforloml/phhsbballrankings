import type { PlayerProfile, PlayerProfilePercentile } from "@/lib/player-profile-types";

export type ScoutingBullet = {
  text: string;
  source: string;
  statRef?: string;
};

export type ScoutingReport = {
  headline: string;
  summary: string;
  footnotes: string[];
  limitedSample: boolean;
  bullets: ScoutingBullet[];
};

function ordinal(value: number) {
  const mod100 = value % 100;
  const mod10 = value % 10;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  if (mod10 === 1) return `${value}st`;
  if (mod10 === 2) return `${value}nd`;
  if (mod10 === 3) return `${value}rd`;
  return `${value}th`;
}

function formatGenderBoard(gender: PlayerProfile["gender"]) {
  return gender === "GIRLS" ? "girls" : "boys";
}

function percentileRank(item: PlayerProfilePercentile) {
  return item.percentile ?? 0;
}

function explainPercentileTier(pct: number) {
  if (pct >= 90) return "among the highest on the current public board";
  if (pct >= 75) return "well above typical board production";
  if (pct >= 60) return "above the board median";
  if (pct >= 40) return "near the board middle";
  if (pct >= 25) return "below many peers on the board";
  return "toward the lower end of the current board";
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

const SCOUTING_REPORT_MAX_WORDS = 150;

function limitWords(text: string, maxWords: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return `${words.slice(0, maxWords).join(" ")}…`;
}

export function buildPositivesOnlyScoutingReport(profile: PlayerProfile): ScoutingReport {
  const games = profile.verifiedGameCount;
  const boardLabel = `${profile.ageGroup} ${formatGenderBoard(profile.gender)}`;
  const byKey = Object.fromEntries(profile.intelligence.percentiles.map((item) => [item.key, item])) as Record<
    PlayerProfilePercentile["key"],
    PlayerProfilePercentile | undefined
  >;

  if (games < 3) {
    const summary =
      `Only ${games} verified official game${games === 1 ? "" : "s"} are on file, so any read on role or strengths would be speculative. ` +
      "Once more official stat rows are published, this section will explain how the player's scoring, efficiency, and activity compare to the public board.";
    return {
      headline: "Limited sample",
      summary: limitWords(summary, SCOUTING_REPORT_MAX_WORDS),
      footnotes: ["Inferred from verified official box scores only."],
      limitedSample: true,
      bullets: [{ text: summary, source: "Sample size", statRef: `${games} games` }]
    };
  }

  const scoring = byKey.scoring;
  const rebounding = byKey.rebounding;
  const playmaking = byKey.playmaking;
  const defense = byKey.defense;
  const efficiency = byKey.efficiency;
  const sample = byKey.sample;

  const wins = profile.allGames.filter((game) => game.result === "W");
  const losses = profile.allGames.filter((game) => game.result === "L");
  const winPts = wins.length ? average(wins.map((g) => g.points)) : null;
  const lossPts = losses.length ? average(losses.map((g) => g.points)) : null;

  const paragraphs: string[] = [];

  paragraphs.push(
    `Based on ${games} verified official games on the ${boardLabel} board, the stat profile suggests ${profile.displayName} is best understood as a ${profile.intelligence.roleArchetype.label.toLowerCase()} in the current competition sample. ` +
      `The player is averaging ${profile.ppg.toFixed(1)} points, ${profile.rpg.toFixed(1)} rebounds, and ${profile.apg.toFixed(1)} assists per game, with ${profile.spg.toFixed(1)} steals and ${profile.bpg.toFixed(1)} blocks combined. ` +
      (sample && sample.percentile !== null
        ? `That sample size ranks in the ${ordinal(sample.percentile)} percentile for verified games on this board, which makes the averages more reliable than a short burst of games. `
        : `The game count is enough to form a working read, though a longer run of verified games would still sharpen the picture. `)
  );

  if (scoring && scoring.percentile !== null) {
    paragraphs.push(
      `Scoring output at ${scoring.value.toFixed(1)} points per game places ${profile.displayName} in the ${ordinal(scoring.percentile)} percentile for scoring on this board — ${explainPercentileTier(scoring.percentile)}. ` +
        (scoring.percentile >= 75
          ? "That usually points to a player who carries real offensive responsibility and is trusted to generate points in competitive minutes, whether as a primary option or a high-usage finisher. "
          : scoring.percentile >= 60
            ? "That suggests dependable scoring contribution without necessarily being the clear focal point every possession. "
            : "That indicates scoring is present but not yet a defining separator relative to peers on the public board. ")
    );
  }

  if (rebounding && rebounding.percentile !== null) {
    paragraphs.push(
      `Rebounding at ${rebounding.value.toFixed(1)} per game (${ordinal(rebounding.percentile)} percentile) ${rebounding.percentile >= 75 ? "implies strong work on the glass and likely value in second-chance possessions or limiting opponent extra looks. " : rebounding.percentile >= 60 ? "suggests solid board contribution that helps possession length even when it does not dominate the scouting story. " : "reads as a secondary part of the profile rather than a core calling card at this stage. "}`
    );
  }

  if (playmaking && playmaking.percentile !== null) {
    paragraphs.push(
      `Playmaking at ${playmaking.value.toFixed(1)} assists per game (${ordinal(playmaking.percentile)} percentile) ${playmaking.percentile >= 75 ? "suggests meaningful creation and passing responsibility in the offense. " : playmaking.percentile >= 60 ? "points to competent ball movement and secondary creation, but not necessarily a pure lead-guard role. " : playmaking.percentile < 40 ? "suggests the player is more often finishing plays than initiating them — a common pattern for scorers and interior contributors who operate off catches, screens, and post touches rather than primary ball-handling. " : "sits in a neutral band, meaning assist volume neither clearly defines nor limits the player’s role in the available data. "}`
    );
  }

  if (defense && defense.percentile !== null) {
    const stocks = defense.value.toFixed(1);
    paragraphs.push(
      `Defensive activity (${stocks} steals plus blocks per game, ${ordinal(defense.percentile)} percentile) ${defense.percentile >= 75 ? "indicates disruptive hands and rim activity that can translate into transition chances and broken sets. " : defense.percentile >= 60 ? "shows useful defensive event production even if it is not the headline trait. " : "does not yet stand out as a board-level separator in the verified sample. "}`
    );
  }

  if (efficiency && efficiency.percentile !== null) {
    paragraphs.push(
      `Box-score efficiency relative to peers ranks in the ${ordinal(efficiency.percentile)} percentile. ` +
        (profile.shooting.trueShootingPct !== null
          ? `True shooting on verified attempts is ${profile.shooting.trueShootingPct}%, which ${profile.shooting.trueShootingPct >= 55 ? "supports the idea that the scoring volume is not purely empty usage. " : "suggests there may still be room to convert attempts more cleanly as shot selection and role settle. "}`
          : efficiency.percentile >= 75
            ? "That combination usually means the player converts opportunities at a strong rate for this board. "
            : efficiency.percentile < 40 && (scoring?.percentile ?? 0) >= 75
              ? "That pattern — high scoring rank with a lower efficiency rank — can happen with high-volume scorers who absorb tough attempts; it does not automatically mean poor decision-making, but it is worth monitoring. "
              : "That places overall production efficiency in context against other board players. ")
    );
  }

  if (winPts !== null && lossPts !== null && wins.length >= 3 && losses.length >= 3) {
    paragraphs.push(
      `In wins, the player has averaged ${winPts.toFixed(1)} points compared with ${lossPts.toFixed(1)} in losses (${wins.length}-${losses.length} record in the verified log). ` +
        (winPts > lossPts + 2
          ? "That gap suggests production tends to scale up in winning games, which is consistent with a player who impacts outcomes when the team is ahead of schedule. "
          : "That split is relatively flat, so role and matchup context may matter as much as raw box-score swings in individual results. ")
    );
  }

  if (profile.bestGame) {
    const top = profile.bestGame.game;
    paragraphs.push(
      `The strongest verified single-game line on file is ${top.points} points, ${top.rebounds} rebounds, and ${top.assists} assists versus ${top.opponentName}, which shows the upper range of the player’s current production band in official competition. `
    );
  }

  paragraphs.push(
    "These notes are objective interpretations of published stats and board percentiles only. They assume verified box scores reflect typical role and minutes, and they do not account for matchup difficulty, off-ball value, or video-scout intangibles."
  );

  const summary = limitWords(paragraphs.join(""), SCOUTING_REPORT_MAX_WORDS);

  const footnotes = [
    "Assumptions based on verified official game stats and public board comparisons",
    profile.intelligence.comparisonCount > 0
      ? `Compared against ${profile.intelligence.comparisonCount} eligible ${boardLabel} players`
      : null
  ].filter((line): line is string => Boolean(line));

  const bullets = profile.intelligence.percentiles
    .filter((item) => item.percentile !== null && item.percentile >= 60)
    .sort((left, right) => percentileRank(right) - percentileRank(left))
    .slice(0, 4)
    .map((item) => ({
      text: `${item.label}: ${ordinal(item.percentile!)} percentile`,
      source: "Board percentile"
    }));

  return {
    headline: profile.intelligence.roleArchetype.label,
    summary,
    footnotes,
    limitedSample: false,
    bullets: bullets.length ? bullets : [{ text: summary.slice(0, 180) + "…", source: "Scouting report" }]
  };
}
