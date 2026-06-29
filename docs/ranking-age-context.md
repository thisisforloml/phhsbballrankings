# Ranking Age Context

Age matters because production should be interpreted relative to maturity and development stage.

A younger player producing against older competition may have more long-term upside than an older player with similar box-score production in the same pool. Age can also help coaches, scouts, and families understand whether a player's current output is early, on-time, or late relative to the competitive bracket.

For now, Peach Basket displays age and/or birth year as context only:

- Age is not used as a Formula v1 rating modifier.
- BirthDate coverage is not complete enough for a reliable age-adjusted model.
- PlayerRating and RankingSnapshot outputs remain based on the approved Formula v1 methodology.
- Future age-adjusted versions should be calibrated statistically after birthDate coverage improves.

## Class Year Rule

Current planning rule for high school class year:

- If birth month is January-March, classYear = birthYear + 19.
- If birth month is April-December, classYear = birthYear + 20.

Examples:

- Born June 2006 = Class of 2026.
- Born March 2007 = Class of 2026.
- Born April 2007 = Class of 2027.

Eligibility planning:

- Athlete remains ranking-eligible through May 31 of their class year.
- Starting June 1 of their class year, athlete should be removed from active rankings.
- Unknown birthDate remains eligible for now but should be flagged as missing age/class data.
- Public RankingSnapshot generation enforces class-year exclusion; PlayerRating can still exist for players with verified stats.

## Age-Group Progression

Official age groups:

- U13: age 13 and below.
- U16: ages 14-16.
- U19: ages 17-19.

Public eligibility uses **calendar age as of the evaluation date** (birthday-based). A player who turns 17 mid-season moves to U19 on that birthday; a player who turns 14 mid-season moves to U16 on that birthday.

Graduation still follows the class-year rule: U19 players are removed from active rankings starting June 1 of their class year.

March 31 season-year helpers (`getAgeBracketAsOfMarch31`) remain for audit comparisons only; they are not used for live public board eligibility.

Players do not reset to zero when advancing age groups. The planned policy is to give advancing players a carryover baseline rating based on previous age-group performance. That carryover should be discounted because the next age group is more competitive, then fade as the player records verified games in the new age group.

Formula v1 does not implement carryover yet. Current ratings still come from verified game data in the player's current age group.

