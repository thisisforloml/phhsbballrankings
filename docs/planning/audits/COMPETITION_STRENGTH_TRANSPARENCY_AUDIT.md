# Competition Strength Transparency — Design Audit

**Generated:** 2026-06-18  
**Mode:** Read-only design audit (no implementation)  
**Companion spec:** [COMPETITION_STRENGTH_TRANSPARENCY_SPEC.md](../COMPETITION_STRENGTH_TRANSPARENCY_SPEC.md)  
**Authority:** Informs public UX only — **does not authorize tier-weighted rating changes**

---

## 1. Executive summary

Peach Basket can communicate **where** and **how strongly** a player has competed without changing `PlayerRating`, `GamePerformanceScore`, or ranking order. The data foundation exists (`League.tier`, game–league linkage, program/team context), but **tier semantics are not safe to expose as-is**: stored DB tiers follow stakeholder convention (1 = highest), while UI labels and legacy docs invert meaning (tier 1 displays as “Entry”). Tier multipliers are **not applied** in production GPS today (`leagueWeight = 1` on all rows).

**Recommendation:** Launch **transparency-first** UX (primary competition + tier exposure breakdown + governance-aligned labels) **before** any tier-weighted rating activation. Keep tier-weighted ratings **disabled** until governance alignment, classification backfill, and explicit recompute approval.

---

## 2. Current data availability

### 2.1 `League.tier` and quality metadata

| Field | Schema | Populated? | Used in ratings today? |
|-------|--------|------------|------------------------|
| `tier` | `Int` 1–4, default 1 | Yes — 8 active leagues | **No** (GPS `leagueWeight` hardcoded to 1 on import) |
| `qualityScore` | `Int` default 0 | **Mostly 0** | No |
| `verificationStatus` | `PROVISIONAL` / etc. | Yes | Eligibility trust paths only |
| `sanctionScore`, `teamCountScore`, … | Rubric inputs | Partial | Admin/governance only |
| `name`, `ageGroup`, `organizerName` | Text/enums | Yes | Display, board filtering |
| `logoUrl` | Optional | Sparse | Admin |

**Active tier distribution** (from [TIER_INTEGRITY_AUDIT.md](./TIER_INTEGRITY_AUDIT.md), [COMPETITION_TIER_CLASSIFICATION_REVIEW.md](./COMPETITION_TIER_CLASSIFICATION_REVIEW.md)):

| DB tier | Leagues | Games | GPS rows | % of GPS |
|--------:|--------:|------:|---------:|---------:|
| 1 | 4 (UAAP ×3, NCAA) | 217 | 5,410 | 57.6% |
| 2 | 0 | 0 | 0 | — |
| 3 | 4 (Stallion ×2, PYBC ×2) | 188 | 3,981 | 42.4% |
| 4 | 0 | 0 | 0 | — |

**Classification quality:** 3/8 leagues match rubric-recommended tier; 5 need reassignment (mostly circuit 3 → 2). Tiers 2 and 4 are unused in DB.

### 2.2 Game counts by tier

Derive at read time:

```text
Player → GameStat → Game → Season → League.tier
```

Aggregates available per player:

- Verified game count per tier (1–4)
- Verified game count per league/season
- Most recent competition
- Highest-tier competition by **governance** order (after label fix)

No materialized `PlayerCompetitionExposure` table exists today; queries are feasible on current volume (~1,885 active `GameStat`, ~9,391 GPS).

### 2.3 Competition names

| Source | Notes |
|--------|-------|
| `League.name` | Canonical; e.g. “UAAP Season 88 HS Boys Basketball” |
| `Season.name` | Season edition |
| `normalizeCompetitionDisplayName()` | PYBC 15U collapse for display |
| `currentTeam` on rankings rows | Latest game team name (school/program), not league |

Rankings and search **do not** currently show league/tier context on board rows.

### 2.4 Team / program information

| Source | Public use today |
|--------|------------------|
| `Player.currentProgram` | Profile, search subtitle |
| `GameStat.team` | Per-game opponent/team on profile |
| `Program` (via team) | School/club identity |
| `ProgramTeamRating` | 66 rows — team strength exists for TPI; **not** on player board rows |
| `schoolOverride` | Profile display override |

Recruiting-relevant **program** context is available; **opponent strength** is team-rating domain (future cross-link, not rating modification).

### 2.3 Semantic defect (blocker for naive tier badges)

| Layer | Tier 1 means | Tier 4 means |
|-------|--------------|--------------|
| **Stakeholder / governance** ([COMPETITION_TIER_GOVERNANCE_FRAMEWORK.md](../COMPETITION_TIER_GOVERNANCE_FRAMEWORK.md)) | National Flagship (highest) | Developmental (lowest) |
| **DB assignment (UAAP @ 1)** | Highest competitions | — |
| **Code UI** (`player-profile.ts`, `CompetitionHistory.tsx`) | **“Entry”** (lowest label) | **“Elite”** |
| **Formula v1 weight map (if activated)** | 1.00× | 1.40× (inverts stakeholder intent) |

**UAAP Season 88 HS Boys** is stored at `tier = 1` but displayed as **“Entry”** on player profiles. Exposing current `tierLabel()` on rankings would **misrepresent** flagship competition.

### 2.4 Rating isolation (confirmed)

- `GamePerformanceScore.leagueWeight` = **1.000** for all 9,391 rows ([TIER_INTEGRITY_AUDIT.md](./TIER_INTEGRITY_AUDIT.md)).
- `submission-post-import-processing.ts` hardcodes `leagueWeight: 1` on GPS upsert.
- Formula vNext tier weights exist in shadow code only; not production.
- **Player ratings are tier-neutral in production** — transparency can truthfully state: *“Ratings are not tier-weighted.”*

---

## 3. Candidate UX approaches

### A. Tier badges

**Description:** Small badge on rankings rows, search results, profile header — e.g. “T1 National Flagship”, “T2 Elite Circuit”.

| Dimension | Assessment |
|-----------|------------|
| User clarity | **Low until labels fixed** — current “Entry” for UAAP is actively misleading |
| Scout usefulness | Medium — quick scan if semantics correct |
| Misinterpretation risk | **High** — users may assume badge affects rank; inverted labels worsen trust |
| Implementation effort | Low (UI + shared `tierDisplayName()` helper) |
| Mobile usability | Good — single chip fits table rows |

**Verdict:** Defer on rankings until governance labels ship; optional on profile **after** label fix with disclaimer.

---

### B. Competition profile summary

**Description:** Profile module summarizing verified competition résumé: primary league, seasons, tier mix narrative, verification status.

| Dimension | Assessment |
|-----------|------------|
| User clarity | **High** — natural home for “where did stats come from?” |
| Scout usefulness | **High** — full context without cluttering board |
| Misinterpretation risk | Medium — mitigate with “context only, not used in rating formula” |
| Implementation effort | Medium — mostly exists via `buildLeagueHistory()`; needs sort by tier (governance order) not `Math.max(tier)` |
| Mobile usability | Good — stacked cards (existing `CompetitionHistory` pattern) |

**Verdict:** **Strong launch candidate** for player profiles.

---

### C. Tier exposure breakdown

**Description:** “Competition exposure” strip: e.g. `12 games · T1 8 · T2 0 · T3 4` or bar chart by verified games per tier.

| Dimension | Assessment |
|-----------|------------|
| User clarity | **High** when paired with tier legend |
| Scout usefulness | **High** — answers “circuit vs collegiate mix” without reading every game |
| Misinterpretation risk | Medium — bar lengths must not look like rating components; use neutral color, explicit copy |
| Implementation effort | Medium — one aggregation query per player/profile row |
| Mobile usability | Good — compact horizontal breakdown or 4-cell grid |

**Verdict:** **Strong launch candidate** on profiles; light version on rankings row expand/detail.

---

### D. Primary competition display

**Description:** One line on rankings/search: “Primary: UAAP Season 88 HS Boys” or “UAAP · 62 gp” derived from most games or highest governance tier.

| Dimension | Assessment |
|-----------|------------|
| User clarity | **High** — minimal cognitive load |
| Scout usefulness | Medium — fast signal, not full mix |
| Misinterpretation risk | **Low** if labeled “Primary verified competition” |
| Implementation effort | **Low** — extend `NationalRankingRow` assembly + search meta |
| Mobile usability | **Excellent** — subtitle under team name |

**Verdict:** **Best first ship** for rankings + search.

---

### E. Scout / recruiting-only indicators

**Description:** AG-4 recruiting view: competition mix, class year, verification tier, optional “collegiate-heavy” / “circuit-heavy” tags; not on casual public homepage.

| Dimension | Assessment |
|-----------|------------|
| User clarity | High for coaches; hidden from general fans reduces noise |
| Scout usefulness | **Highest** — room for exposure %, provisional verification flags |
| Misinterpretation risk | Low among target users if copy is precise |
| Implementation effort | Medium — builds on AG-4 plan; gated route/filter |
| Mobile usability | Medium — more columns; use expandable row |

**Verdict:** Phase 2 after public primary + profile exposure; aligns with [AG4_RECRUITING_VIEW_IMPLEMENTATION_PLAN.md](../AG4_RECRUITING_VIEW_IMPLEMENTATION_PLAN.md).

---

## 4. Approach comparison matrix

| Approach | Clarity | Scout value | Misread risk | Effort | Mobile | Launch priority |
|----------|---------|-------------|--------------|--------|--------|-----------------|
| A. Tier badges | ⚠️ | ○ | ●●● | ● | ●●● | P1 (post-label-fix) |
| B. Competition summary | ●●● | ●●● | ●● | ●● | ●●● | **P1** |
| C. Tier exposure | ●●● | ●●● | ●● | ●● | ●●● | **P1** |
| D. Primary competition | ●●● | ●● | ● | ● | ●●● | **P0** |
| E. Recruiting indicators | ●●● | ●●● | ● | ●● | ●● | P2 |

Legend: ● = favorable, ○ = neutral, ⚠️ = blocked, ●●● = scale

---

## 5. Recommended launch design

**Theme:** *“Show the competition context; keep the rating neutral.”*

### P0 — Rankings + search (minimal, safe)

1. **Primary verified competition** (Approach D) — subtitle on board row: league short name + game count.
2. **Global disclaimer** (rankings footer / tooltip): *“Player ratings use verified box-score performance. Competition tier is shown for context and does not change ratings.”*
3. **No tier badges on board rows** until label governance ships.

### P1 — Player profile (full transparency)

1. **Fix tier display names** to governance framework (Tier 1 = National Flagship, etc.) — display-only, no DB migration required if mapping is centralized.
2. **Competition history** (Approach B) — retain card layout; add `verificationStatus`, sort leagues by governance tier then games.
3. **Tier exposure breakdown** (Approach C) — above or below league history.
4. Optional **tier badge** on each league card using corrected labels.

### P2 — Recruiting / AG-4

1. Approach E: exposure %, collegiate vs circuit tag, provisional verification flag.
2. Sort/filter hints (not rating sorts): “Heavy UAAP exposure”.

### Explicit non-goals (launch)

- Tier-weighted GPS or rating recomputation
- Opponent-strength adjustment on player ratings
- Public display of `qualityScore` until rubric is populated

---

## 6. Required schema changes

### 6.1 None required for P0–P1 MVP

All launch data is derivable from existing `League`, `Season`, `Game`, `GameStat`, `Program`, `Team`.

### 6.2 Recommended (governance & performance, not blocking MVP)

| Change | Purpose | Priority |
|--------|---------|----------|
| `League.tierReviewedAt` | Audit trail for tier assignments | Governance |
| `League.tierRationale` | Short text for admin + public tooltip | Governance |
| `League.tierSource` | `RUBRIC` \| `MANUAL` \| `IMPORT_DEFAULT` | Governance |
| Optional `player_competition_exposure` materialized view / cache | Precompute tier game counts for rankings at scale | Performance (future) |

### 6.3 Do not add to `PlayerRating`

Competition strength is **context**, not a rating dimension. Avoid `competitionStrengthScore` on rating rows — keeps Option B / v1 architecture clean.

---

## 7. Required backfill & data governance

| Work item | Owner | Blocks |
|-----------|-------|--------|
| **Approve governance numbering** (Tier 1 = highest) | Product / rankings board | Correct public tier labels |
| **Replace codebase `tierLabel()`** with governance map | Engineering | Tier badges, exposure labels |
| **Reassign 5 mismatched leagues** (circuit 3→2 per rubric) | Governance + admin | Accurate exposure breakdown |
| **Populate `qualityScore`** or hide until non-zero | Data ops | Quality-based copy |
| **Admin tier legend** on league edit screen | Engineering | Prevents future mis-assignment |
| **NBTC / JCIMBL league records** | Import queue | Complete competition catalog |
| **Document tier-neutral ratings** in `PROJECT_STATUS.md` | Docs | Public trust |
| **Do not backfill `leagueWeight` on GPS** | — | Until explicit recompute approval |

---

## 8. Risk register

| Risk | Mitigation |
|------|------------|
| UAAP shown as “Entry” | Fix labels before any tier badge |
| Users think exposure bars affect rank | Disclaimer + neutral styling + separate module |
| Tier reassignment without communication | Changelog + “competition context updated” note, no rating change |
| Primary competition picks wrong league | Rule: max verified games; tie-break higher governance tier |
| Unknown-DOB players lack home context | Show competition from stats only; no tier inference |

---

## 9. Success metrics (post-launch)

- Support tickets citing “unfair rank vs competition” — qualitative decrease
- Profile module engagement (competition history expand)
- Scout feedback sessions — can they explain player schedule from profile alone?
- Zero accidental activation of `leagueWeight` in import path without approval gate

---

## 10. Audit references

| Artifact | Path |
|----------|------|
| Tier integrity | [TIER_INTEGRITY_AUDIT.md](./TIER_INTEGRITY_AUDIT.md) |
| Classification review | [COMPETITION_TIER_CLASSIFICATION_REVIEW.md](./COMPETITION_TIER_CLASSIFICATION_REVIEW.md) |
| Weight impact simulation | [TIER_WEIGHT_IMPACT_SIMULATION.md](./TIER_WEIGHT_IMPACT_SIMULATION.md) |
| Governance framework | [COMPETITION_TIER_GOVERNANCE_FRAMEWORK.md](../COMPETITION_TIER_GOVERNANCE_FRAMEWORK.md) |
| Code: league history | `src/lib/player-profile.ts` (`buildLeagueHistory`) |
| Code: tier labels (inverted) | `src/components/sections/CompetitionHistory.tsx` |
| Code: rankings rows | `src/lib/rankings.ts`, `src/app/rankings/RankingsClient.tsx` |

---

## 11. Closing recommendations

| Question | Answer |
|----------|--------|
| **Recommended UX** | Primary competition on rankings/search; tier exposure + competition summary on profiles; governance-aligned tier names; global “ratings not tier-weighted” disclaimer |
| **Rollout order** | P0 D → P1 label fix + B + C → P2 E (AG-4) → P1 A (badges) after governance |
| **Impact on ranking credibility** | **Positive** — explains *why* two players with similar ratings differ in schedule; reduces “hidden formula” suspicion without changing numbers |
| **Tier-weighted ratings** | **Remain disabled** until: (1) label/weight map aligned to governance, (2) league tier backfill complete, (3) impact simulation sign-off, (4) explicit GPS + PlayerRating recompute approval |
