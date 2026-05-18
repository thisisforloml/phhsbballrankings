# Ranking Age Context

Age matters because production should be interpreted relative to maturity and development stage.

A younger player producing against older competition may have more long-term upside than an older player with similar box-score production in the same pool. Age can also help coaches, scouts, and families understand whether a player's current output is early, on-time, or late relative to the competitive bracket.

For now, OnCourt displays age and/or birth year as context only:

- Age is not used as a Formula v1 rating modifier.
- BirthDate coverage is not complete enough for a reliable age-adjusted model.
- PlayerRating and RankingSnapshot outputs remain based on the approved Formula v1 methodology.
- Future age-adjusted versions should be calibrated statistically after birthDate coverage improves.

## Class Year Rule

Current planning rule for high school class year:

- If birth month is January-May, classYear = birthYear + 19.
- If birth month is June-December, classYear = birthYear + 20.

Examples:

- Born June 2006 = Class of 2026.
- Born March 2006 = Class of 2025.
- Born December 2005 = Class of 2025.

Eligibility planning:

- Athlete remains ranking-eligible through May 31 of their class year.
- Starting June 1 of their class year, athlete should be removed from active rankings.
- Unknown birthDate remains eligible for now but should be flagged as missing age/class data.
- This is documentation/planning only; active ranking exclusion has not been implemented.
