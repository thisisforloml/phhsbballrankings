# PHRANK Requirements Extract

Source: `C:\Users\DECK\Downloads\PHRANK_Summary.docx`

## Summary

PHRANK is the Philippine National Basketball Ranking System. It is a verified national player registry and ranking infrastructure for youth and amateur basketball, not just a website. The system is built around one persistent player profile per athlete, official verified games only, public rankings for discovery, and premium/licensed data access for deeper analytics.

## Core Requirements

- One persistent player profile across leagues, seasons, and competitions.
- Public rankings by national scope, age bracket, region, and city.
- Public ranking brackets: U13, U16, U19.
- Age bracket is derived from birth year relative to the season year and remains fixed for that season.
- Minimum 15 verified games before leaderboard eligibility.
- Players below 15 verified games remain searchable but unranked.
- Public player profiles show rating, star rating, verified games, last five games, averages, and leagues with tier level.
- Premium access contains full game history, advanced metrics, trend charts, ranking movement, exportable reports, widgets, and analytics.

## Verification And League Quality

- Only verified official games affect ratings.
- League verification is controlled by PHRANK administrators.
- League Quality Score is 0-100 and derives tier assignment.
- League criteria: sanctioning body, team count, games per team, stat submission compliance, and player quality index.
- Tier 1: Entry, Tier 2: Developmental, Tier 3: Competitive, Tier 4: Elite.
- Tiers are recalculated every season.

## Rating Model

- Every verified game produces one performance score.
- Production Score uses points, assists, rebounds, and turnovers with regression-derived weights.
- League Weight scales scores by tier.
- Opponent Factor adjusts for opponent strength and is clamped between 0.85 and 1.15.
- Team Context Factor adjusts for teammate strength and is clamped between 0.90 and 1.10.
- Final Performance Score is capped at 100.
- Player Rating is a weighted recency average.
- Bayesian shrinkage protects against small-sample outliers and uses a constant of 15.
- Star ratings map 90-100 to 5 stars, 80-89 to 4, 70-79 to 3, 60-69 to 2, below 60 to 1.

## Database Requirements

- PostgreSQL.
- UUID primary keys.
- Soft deletion using `deleted_at`.
- No verified stat is silently deleted.
- Raw stats and computed performance scores are stored separately.
- Formula versions are stored and linked to each performance score.
- Monthly ranking snapshots are permanent.
- Audit log records changes to verified data with reason, previous value, and new value.
- One team per player per season is enforced unless an admin override is logged.

## Current Implementation Notes

- The Next.js app now uses PHRANK branding, U13/U16/U19 public ranking labels, public methodology copy, and league tier display.
- The Prisma schema now models the document's core architecture: users, player registry, league access, seasons, rosters, games, raw stats, performance scores, team ratings, player ratings, formula versions, ranking snapshots, and audit logs.
- The UI still reads from demo data for fast local rendering. Connecting public pages directly to Prisma queries is the next backend integration step.

