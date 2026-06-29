# Competition Tier Classification Review

**Generated:** 2026-06-18T13:21:19.412Z  
**Mode:** Read-only  
**Governance framework:** [COMPETITION_TIER_GOVERNANCE_FRAMEWORK.md](../COMPETITION_TIER_GOVERNANCE_FRAMEWORK.md)  
**Machine report:** `scripts/reports/competition-tier-classification-review.json`

## Executive summary

**Recommendation:** **D** — Tier system should be redesigned before activation: stakeholder numbering (Tier 1 = highest) conflicts with PHRANK requirements and codebase labels/weights; only two of four tier slots are used; circuit leagues are stored at Tier 3 but rubric places them at Tier 2.  
**Confidence:** HIGH

| Metric | Value |
| --- | ---: |
| Active competitions in DB | 8 |
| Rubric exact matches (DB tier = recommended) | 3 |
| Reclassification needed | 5 |
| Tier delta ≥ 2 | 0 |
| Insufficient evidence (not scorable in DB) | 2 |

**Numbering convention:** This review uses **Tier 1 = highest competition**, **Tier 4 = lowest** per approved governance framework. This inverts legacy PHRANK requirements text and current codebase UI labels.

## Rubric scoring results

| Competition | DB Tier | Recommended | Rubric /100 | Confidence | Match | Dimension scores |
| --- | ---: | ---: | ---: | --- | :---: | --- |
| NCAA Season 101 Junior's Basketball | 1 | 2 | 78 | MEDIUM | ✗ | Talent 17, Program 15, Recruiting 17, Competitive 15, Geographic 14 |
| UAAP Season 88 16U Boys Basketball | 1 | 1 | 83 | MEDIUM | ✓ | Talent 18, Program 16, Recruiting 18, Competitive 16, Geographic 15 |
| UAAP Season 88 HS Boys Basketball | 1 | 1 | 90 | HIGH | ✓ | Talent 19, Program 18, Recruiting 20, Competitive 17, Geographic 16 |
| UAAP Season 88 HS Girls Basketball | 1 | 1 | 86 | LOW | ✓ | Talent 19, Program 18, Recruiting 20, Competitive 13, Geographic 16 |
| 6th Stallion Cup - 18U | 3 | 2 | 73 | MEDIUM | ✗ | Talent 15, Program 13, Recruiting 16, Competitive 12, Geographic 17 |
| Philippine Youth Basketball Championship – 13U | 3 | 2 | 69 | MEDIUM | ✗ | Talent 14, Program 12, Recruiting 14, Competitive 14, Geographic 15 |
| Philippine Youth Basketball Championship – 15U | 3 | 2 | 69 | MEDIUM | ✗ | Talent 14, Program 12, Recruiting 14, Competitive 14, Geographic 15 |
| Stallion Cup – 17U | 3 | 2 | 76 | MEDIUM | ✗ | Talent 15, Program 13, Recruiting 16, Competitive 15, Geographic 17 |

## Competitions with insufficient evidence

| Competition | Reason |
| --- | --- |
| NBTC National Finals | No active League record or verified game stats in production DB. |
| JCIMBL | Referenced in import planning; no active League record in production DB. |
| UAAP Season 88 HS Girls Basketball | Low verified volume or provisional league status — tier recommendation provisional. |

## Migration risk (if recommendations adopted later)

- U19 Boys avg absolute rank movement if weights activated: **27.51** positions (user-aligned weights) / **28.52** (code weights)
- Top-10 churn under user-aligned weights: **6** players
- Circuit-heavy profiles (e.g. Lucas Kaw) lose rank under user-aligned weights; UAAP-heavy profiles (e.g. Xyriel Macahipay) gain rank — see tier-weight-impact simulation

**Prerequisite chain (no action taken in this review):**

1. Approve governance framework and tier philosophy (stakeholder numbering).
2. Align codebase labels, admin UI legend, and weight map to Tier 1 = highest.
3. Reassign `League.tier` per rubric (4 circuit leagues: 3 → 2).
4. Recompute GPS `leagueWeight` per game (9,391 rows today).
5. Recompute PlayerRating, RankingSnapshot, ProgramTeamRating.

**Risk:** Activating weights before steps 1–3 would apply multipliers against inverted semantics and amplify circuit games under code weights (Tier 3 = 1.25×) while collegiate games stay at 1.0× — opposite of stakeholder intent.

## Per-competition rationale

### NCAA Season 101 Junior's Basketball

- **DB tier:** 1 · **Recommended:** 2 · **Rubric:** 78/100 · **Confidence:** MEDIUM
- **Rationale:** Major collegiate junior championship (NCAA Philippines); elite programs but NCR-concentrated and junior-division scope.
  - Adjustments: League verification PROVISIONAL: −1 program quality. League Quality Score unset (0) — rubric score is expert-estimated, not LQS-derived.

### UAAP Season 88 16U Boys Basketball

- **DB tier:** 1 · **Recommended:** 1 · **Rubric:** 83/100 · **Confidence:** MEDIUM
- **Rationale:** Official UAAP junior division; strong program infrastructure with slightly narrower recruiting window than HS.
  - Adjustments: League verification PROVISIONAL: −1 program quality. League Quality Score unset (0) — rubric score is expert-estimated, not LQS-derived.

### UAAP Season 88 HS Boys Basketball

- **DB tier:** 1 · **Recommended:** 1 · **Rubric:** 90/100 · **Confidence:** HIGH
- **Rationale:** Flagship collegiate high-school championship; highest talent density and scouting attention in Philippine youth basketball.

### UAAP Season 88 HS Girls Basketball

- **DB tier:** 1 · **Recommended:** 1 · **Rubric:** 86/100 · **Confidence:** LOW
- **Rationale:** Flagship collegiate high-school championship; highest talent density and scouting attention in Philippine youth basketball.
  - Adjustments: Girls division: −2 competitive depth (smaller verified field in current dataset). Low verified game count (14): −2 competitive depth.

### 6th Stallion Cup - 18U

- **DB tier:** 3 · **Recommended:** 2 · **Rubric:** 73/100 · **Confidence:** MEDIUM
- **Rationale:** National invitational club circuit with broad geographic draw; strong but less concentrated talent than UAAP/NCAA.
  - Adjustments: Low verified game count (25): −2 competitive depth. League verification PROVISIONAL: −1 program quality. League Quality Score unset (0) — rubric score is expert-estimated, not LQS-derived. Partial 18U cup coverage: −1 competitive depth.

### Philippine Youth Basketball Championship – 13U

- **DB tier:** 3 · **Recommended:** 2 · **Rubric:** 69/100 · **Confidence:** MEDIUM
- **Rationale:** National youth championship with credible club participation; below flagship collegiate tier in program concentration.
  - Adjustments: League verification PROVISIONAL: −1 program quality. League Quality Score unset (0) — rubric score is expert-estimated, not LQS-derived.

### Philippine Youth Basketball Championship – 15U

- **DB tier:** 3 · **Recommended:** 2 · **Rubric:** 69/100 · **Confidence:** MEDIUM
- **Rationale:** National youth championship with credible club participation; below flagship collegiate tier in program concentration.
  - Adjustments: League verification PROVISIONAL: −1 program quality. League Quality Score unset (0) — rubric score is expert-estimated, not LQS-derived.

### Stallion Cup – 17U

- **DB tier:** 3 · **Recommended:** 2 · **Rubric:** 76/100 · **Confidence:** MEDIUM
- **Rationale:** National invitational club circuit with broad geographic draw; strong but less concentrated talent than UAAP/NCAA.
  - Adjustments: League verification PROVISIONAL: −1 program quality. League Quality Score unset (0) — rubric score is expert-estimated, not LQS-derived.

---

*Read-only review — no ratings, GPS, snapshots, tiers, formulas, or policies modified.*
