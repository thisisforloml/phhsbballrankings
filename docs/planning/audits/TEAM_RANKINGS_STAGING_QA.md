# Team Rankings Staging QA

**Generated:** 2026-06-17  
**Harness:** `scripts/validate-team-national-staging-qa.ts`  
**Report:** `scripts/reports/team-national-staging-qa.json`

---

## Summary

| Area | Result |
|---|---|
| Data load (56 public-eligible rows) | **PASS** |
| Rank numbering (canonical board rank) | **PASS** |
| Search filter rank stability | **PASS** |
| Column sorting | **PASS** |
| Program profile links (56/56) | **PASS** |
| Empty-state coverage (U13/U16 Girls) | **PASS** |
| Age-group default (U16 Boys) | **PASS** |
| Feature flag env in harness | **PASS** (when `TEAM_NATIONAL_RATINGS_ENABLED=true`) |

**Harness:** 10 PASS, 0 FAIL, 0 SKIP (with flag enabled)

---

## B1 — Rank Numbering Fix

National view now mirrors player rankings:

- `buildNationalBoardRankByProgramId()` computes canonical rank from full board scope
- `sortNationalBoardRows()` assigns `visibleRank` from canonical rank after filter/sort
- Unit tests: `src/lib/team-ratings/national-board-display.test.ts` (3/3 pass)

Verified scenarios:

- U16 Boys: filtered search keeps ranks #1, #3 (not renumbered to #1, #2)
- Rating sort preserves canonical rank numbers on rows

---

## Filters & Search

| Check | Result |
|---|---|
| Age group pills (U13/U16/U19) | Data scoped correctly per board |
| Gender toggle | Filters `nationalScopeRows` by `GIRLS`/`BOYS` |
| Search | Filters by program name, abbreviation, city, region |
| Search empty state | Dedicated copy when board has data but search matches nothing |
| Clear filters | Resets league/region/query (competition mode) |

---

## Sorting

| Column | Behavior |
|---|---|
| Rank | Sorts by canonical board rank |
| Program | Alphabetical, tie-break rank |
| TPI (rating) | Numeric, tie-break rank |
| Games / Opponents | Numeric, tie-break rank |

---

## Mobile Layout

**Automated:** Not run in CI harness (requires browser).

**Manual follow-up (5 min):**

1. Open `/teams` with `TEAM_NATIONAL_RATINGS_ENABLED=true`
2. Verify National/Competition toggle wraps on narrow viewport
3. Confirm table metrics show mobile labels (Games, Opponents, TPI)
4. Tap program link → `/teams/[id]` resolves

---

## Empty States (B3)

| Board | Expected | UI |
|---|---|---|
| U13 Girls | 0 rows | "not live yet" copy |
| U16 Girls | 0 rows | "not live yet" copy |
| U19 Girls | 2 rows | Sparse-board amber banner |
| Search miss | 0 visible | "No programs match your search" |

---

## Program Links

All 56 public-eligible rows resolve `teamId` from first active program team — **56/56 PASS**.

---

## Competition Toggle

When `TEAM_NATIONAL_RATINGS_ENABLED=true`:

- Default view: **National**
- Competition view unchanged from pre-TR-6C
- Age/gender filters apply to both modes

---

## Sign-off

| Gate | Status |
|---|---|
| Data-layer staging QA | **PASS** |
| Browser mobile QA | **Pending manual** (non-blocking) |
