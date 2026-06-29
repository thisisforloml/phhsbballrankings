# AG-3 U16 Launch Decision Memo

**Date:** 2026-06-17  
**Mode:** Read-only decision review  
**Authority:** Rankings Architect (AG-3)  
**Data as of:** 2026-06-17T10:34:49Z (`generate-rankings-operations-dashboard.ts` post–Safe Identity Cleanup)

---

## Executive Summary

**Recommended launch status: C — Block launch**

U16 Boys has strong underlying evidence (253 rated players, 115 at the 10-game threshold) but only **7 public RANKED** rows (2.8% yield). U16 Girls has **no rating pool** (0 `PlayerRating` rows). Infrastructure, WS-1 eligibility, and identity cleanup are no longer blockers; **board depth and Girls data absence** are.

---

## Preconditions (User-Stated Context)

| Precondition | Status |
|---|---|
| Safe Identity Cleanup (52 programs, 64 teams, 928 players) | ✓ Executed 2026-06-17 |
| All available imports completed | ✓ Per queue |
| WS-1 Eligibility live | ✓ `evaluate-eligibility.ts` + `getPublicBoardRows` |
| AG-4 W1–W4 (class year on rankings) | ✓ U19 scope |
| No duplicate-program / orphan-team blockers | ✓ `duplicateProgramGroups: 0` |

---

## Live U16 Counts (Boys / Girls)

| Metric | U16 Boys | U16 Girls |
|---|---:|---:|
| Rating pool | 253 | **0** |
| **RANKED** (public board) | **7** | **0** |
| PROVISIONAL | 246 | 0 |
| HIDDEN / FORMER | 0 / 0 | 0 / 0 |
| Board yield | **2.8%** | **0%** |
| At launch threshold (≥10 Boys / ≥5 Girls games) | **115** | **0** |
| P7 `BELOW_THRESHOLD` | 138 | 0 |
| P12 `UNKNOWN_DOB` (≥ threshold when no DOB) | 108 | 0 |
| Launch threshold (`launch-v1`) | 10 games | 5 games |

### U16 Boys — Current RANKED (7)

| Rank | Player | Games | Rating | Program |
|---:|---|---:|---:|---|
| 1 | Goodluck Okebata | 14 | 96.6 | University of the East |
| 4 | Prince Cariño | 17 | 92.5 | Far Eastern University |
| 6 | Moussa Diakite | 16 | 89.9 | National University Nazareth School |
| 16 | Sky Jazul | 10 | 81.1 | Ateneo de Manila University |
| 77 | Kean Poquiz | 14 | 58.4 | UP Integrated School |
| 121 | Alison Jordan | 14 | 46.5 | Adamson University |
| 243 | Godfavor Okebata | 10 | 20.5 | UP Integrated School |

*Full rating sort includes 253 rows; public ranks are sparse (gaps at #2–3, #5, etc.) because only RANKED verdicts appear on the public board.*

---

## 1. U16 Boys Public Launch Readiness

**Verdict: Not ready — block**

| Dimension | Status | Evidence |
|---|---|---|
| Competition evidence | **Ready** | PYBC U16 Boys imported; 253 `PlayerRating` rows |
| Eligibility engine (WS-1) | **Ready** | Live; P7/P12 correctly partition pool |
| Identity / team rows | **Ready** | Safe cleanup complete; 0 duplicate program groups |
| Threshold-qualified depth (10+ games) | **Ready** | 115 players (exceeds AG plan gate of 25 at 10+ games) |
| **Public RANKED board depth** | **Not ready** | **7 RANKED** vs remediation W4 target **≥25** and soft gate **≥50** |
| DOB coverage | **Not ready** | 108 P12 blockers (42.7% of pool); dominant unlock path |
| Staging / product gates | **Incomplete** | `isPlannedPublicAgeGroup("U16")` still active; AG-2 / PO sign-off not recorded |

**Readiness score:** Governance and pipeline **ready**; public credibility **not ready**.

---

## 2. U16 Girls Public Launch Readiness

**Verdict: Not ready — hard block (no board possible)**

| Dimension | Status |
|---|---|
| U16 Girls `PlayerRating` pool | **0** |
| Verified U16 Girls competition imports | **None in rating pipeline** |
| RANKED / PROVISIONAL / P7 / P12 | **All 0** |
| AG plan gate (≥30 rated, ≥15 at 5+ games) | **Failed** |

Girls U16 requires a **separate import + rating compute track** before any launch discussion.

---

## 3. Risks of Launching Today

### U16 Boys (if Coming Soon removed)

- **Credibility:** A 7-player “national” board with rank gaps (#1, #4, #6…) reads as broken or beta, not authoritative.
- **False negatives:** 108 game-qualified players (10+ verified games, high ratings) are invisible due to P12 — coaches see an incomplete universe.
- **Program skew:** Board dominated by UAAP-adjacent programs; PYBC club depth (majority of pool) largely off-board.
- **Support load:** “Why isn’t my player ranked?” tickets from 246 PROVISIONAL players and near-threshold cohort.
- **Residual identity:** 5 fuzzy duplicate-player clusters remain (low/medium confidence; no overlapping stats today).

### U16 Girls (if launched)

- **Empty board:** Zero rows — worse than Coming Soon; violates empty-state vs not-launched distinction in AG plan.
- **Brand harm:** Publishing an empty Girls board signals product immaturity.

### Cross-cutting

- Privacy/Terms still flagged for lawyer review in `PROJECT_STATUS.md` before full public launch.
- June rollover (G5) documentation for U16 age-outs not yet formalized post-launch.

---

## 4. Risks of Delaying Launch

- **Opportunity cost:** 7 qualified Boys players and programs lack public visibility/recruiting value.
- **Momentum:** PYBC U16 evidence and cleanup work are complete; delay defers ROI on import investment.
- **Competitive narrative:** U19 boards live while U16 remains “Coming Soon” despite material Boys data.
- **Remediation fatigue:** P12 backlog (108) grows if DOB campaigns are not prioritized regardless of launch.

*Mitigation:* Delay is **low risk** while Coming Soon clearly communicates intent; data growth path is defined (P12 DOB → +108 potential RANKED, subject to bracket validation).

---

## 5. Expected User Experience (If Launched Today)

### U16 Boys

- Rankings hub: U16 Boys shows **7 players** in a table that implies national coverage.
- Min-games slider (default 10): No effect on visible count (all 7 already ≥10 games).
- Player profiles: ~115 threshold-qualified players exist in DB; only 7 show public U16 rank; others show provisional/off-board state.
- Search: Many U16-rated players discoverable; rank badge only on 7.
- Teams / leagues: PYBC team standings may show depth that **contradicts** thin national player board.

### U16 Girls

- **Empty Coming Soon removal** → blank board or generic empty state — confusing and harmful.

---

## 6. Recommended Launch Status

### **C — Block launch**

| Board | Recommendation |
|---|---|
| U16 Boys | Block until **≥25 public RANKED** (minimum viable); target **≥50** (soft gate) |
| U16 Girls | Block until rating pool exists and **≥15 public RANKED** at 5+ games |

Do **not** use option B (warning label) at 7 RANKED — the gap is too large for a disclaimer to preserve credibility.

---

## Blocking Criteria (Exact)

### U16 Boys — unblock when ALL:

1. `publicBoardRanked` (U16 Boys) **≥ 25**
2. `boardYieldPct` **≥ 10%** (or ≥25 RANKED, whichever is stricter)
3. P12 backlog among threshold-qualified players reduced materially (target: **<40** remaining U16 Boys P12)
4. AG-2 staging preview approved
5. `public-rankings-coverage.ts` copy updated; product owner sign-off recorded

### U16 Girls — unblock when ALL:

1. `ratingPool` (U16 Girls `PlayerRating`) **≥ 30**
2. `publicBoardRanked` **≥ 15** at 5+ verified games
3. At least one verified U16 Girls competition import complete
4. Same governance gates as Boys (staging, coverage copy, PO sign-off)

---

## Minimum Board Size & Time to Readiness

| Board | Minimum estimate | Target estimate | Time estimate |
|---|---:|---:|---|
| U16 Boys | **25 RANKED** | **50 RANKED** (soft gate) | **4–8 weeks** (DOB blitz on 108 P12) to reach 25; **60–90 days** to reach 50 |
| U16 Girls | **15 RANKED** | **30** rated pool | **90+ days** (import track + ratings + DOB; no rows today) |

**Fastest Boys path:** Admin DOB entry for U16 P12 cohort (108 players with ≥10 games) → projected **45–55 RANKED** per remediation U16-1 phase, minus P3 bracket exclusions.

**No rating recompute or threshold change required** for unlock — data remediation only (**requires approval** if batch rating recompute needed after new imports).

---

## AG-3 Checklist (AGE_GROUP_BOARD_EXPANSION_PLAN §530)

| Item | Boys | Girls |
|---|---|---|
| AG-0 Girls U16 coverage documented | — | ✗ |
| G1 WS-1 live | ✓ | ✓ |
| ≥25 (B) / ≥15 (G) at threshold games | ✓ (115) | ✗ (0) |
| `validate-ranking-snapshots-v1-u16.ts` | Not re-run this review | — |
| U16 merge Tier 1–2 | ✓ Safe cleanup executed | N/A |
| AG-2 staging preview | ✗ | ✗ |
| Coverage copy update | ✗ | ✗ |
| Product owner sign-off | ✗ | ✗ |

---

## Files Inspected

- `docs/PROJECT_STATUS.md`
- `docs/planning/AGE_GROUP_BOARD_EXPANSION_PLAN.md`
- `docs/planning/DATA_REMEDIATION_STRATEGY.md`
- `docs/planning/audits/rankings-operations-dashboard.json` (regenerated 2026-06-17)
- `docs/planning/audits/safe-identity-cleanup-execution.json`
- `docs/planning/audits/VERDICT_DISTRIBUTION_AUDIT.md`
- `src/lib/eligibility/evaluate-eligibility.ts`, `launch-policy.ts`
- `src/lib/rankings.ts`, `public-board-ranks.ts`, `public-rankings-coverage.ts`
- `scripts/generate-rankings-operations-dashboard.ts`

## Validation Performed

- Read-only `generate-rankings-operations-dashboard.ts` (2026-06-17T10:34:49Z)
- Live U16 query via `getLatestNationalRankings` + `getPublicBoardRows` (same counts)

---

*End of AG-3 U16 Launch Decision Memo*
