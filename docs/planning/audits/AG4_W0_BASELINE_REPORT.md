# AG-4 W0 Baseline Report

**Captured:** 2026-06-17T09:17:29.992Z  
**Script:** `scripts/capture-ag4-g1-baseline.ts`  
**G1 policy:** `launch-v1`  
**Formula v1 ID:** `b8bbcc82-e240-4af6-9d71-84293fdc8b86`  
**Mode:** Read-only — no writes, recomputes, or schema changes

---

## 1. Executive Summary

Post-G1 baseline artifacts are captured under `docs/planning/audits/`. The WS-1 RANKED-only public board contract behaves as designed: **59 U19 Boys** are on the public board; **0 U19 Girls** qualify as RANKED under `launch-v1`.

**AG-4 Rev 2 assumptions largely validated** for the Boys board:

| Assumption | Result |
|---|---|
| RC-1: RANKED-only `getPublicBoardRows` | **Confirmed** — 0 PROVISIONAL/HIDDEN/FORMER on board |
| Unknown DOB → off board (P12) | **Confirmed** — 425 PROVISIONAL in pool, none on board |
| `effectiveClassYear` on all RANKED rows | **100%** (59/59 Boys) |
| Null-class RANKED population | **0** — `includeUnknownClass` toggle is defensive only |
| Class-year chips viable (Boys) | **Yes** — Class of 2027 (34), Class of 2028 (25) |
| Class-year chips viable (Girls) | **No** — empty RANKED board |

**Recommendation:** Proceed with **AG-4 W1–W4** for Boys U19 recruiting filter. Treat Girls U19 as a **parallel data/eligibility blocker** — not an AG-4 code blocker, but a **launch blocker** until at least one RANKED Girls row exists.

---

## 2. RANKED Board Size

| Gender | U19 rating pool | Public RANKED board | Excluded from board |
|---|---:|---:|---|
| **Boys** | 493 | **59** | 434 |
| **Girls** | 56 | **0** | 56 |
| **Combined** | 549 | **59** | 490 |

### Boys verdict breakdown (full U19 pool, n=493)

| Verdict | Count | % of pool |
|---|---:|---:|
| RANKED | 59 | 12.0% |
| PROVISIONAL | 369 | 74.8% |
| FORMER | 49 | 9.9% |
| HIDDEN | 16 | 3.2% |

### Girls verdict breakdown (full U19 pool, n=56)

| Verdict | Count | % of pool |
|---|---:|---:|
| PROVISIONAL | 56 | 100% |

**Interpretation:** G1 sharply reduced the public board from the full `PlayerRating` pool. Most exclusion is PROVISIONAL (below 5-game Girls / 10-game Boys threshold or unknown DOB per P7/P12). Girls have **no RANKED rows** — likely combination of low verified game counts and missing birth dates in a small pool.

---

## 3. Class-Year Histogram (RANKED board only)

### Boys

| Class year | RANKED count |
|---|---:|
| 2027 | 34 |
| 2028 | 25 |
| *null* | 0 |

### Girls

*No RANKED rows — histogram empty.*

### Proposed MVP chips (≥3 players threshold)

| Chip | Boys count | Girls count |
|---|---:|---:|
| Class of 2027 | 34 | 0 |
| Class of 2028 | 25 | 0 |

Both Boys buckets exceed soft gate **S2** (≥10 players). Girls cannot render meaningful chips at current data state.

---

## 4. Null-Class RANKED Count

| Metric | Value |
|---|---:|
| RANKED with `effectiveClassYear === null` | **0** |
| Artifact | `ag4-baseline-unknown-dob-ranked-set.json` → `[]` |

**Validates Rev 2 §4.2 / architect finding:** Under current WS-1, every RANKED player has computable class year (DOB present). The `includeUnknownClass` URL toggle is **defensive UI only** until eligibility rules or data change.

---

## 5. Top-10 Anchor Players (Boys U19 RANKED board)

Board rank uses `getPublicBoardRows` order (national public board position). `poolRank` is index in full `PlayerRating` query — **not** display rank.

| Board rank | Player | Rating | Games | Class | Pool rank |
|---:|---|---:|---:|---|---:|
| 1 | Jude Eriobu | 98.33 | 16 | 2028 | 1 |
| 2 | Josef Calo-oy | 93.10 | 14 | 2028 | 5 |
| 3 | Steven Creus | 88.41 | 14 | 2028 | 12 |
| 4 | Jetlee Melano | 86.36 | 14 | 2027 | 19 |
| 5 | Patrick Pasinos | 82.31 | 14 | 2028 | 28 |
| 6 | *(see artifact)* | | | | |
| 7 | Shaun Lucido | 80.32 | 18 | 2027 | 37 |
| 8 | Bronwyn Tepan | 78.56 | 14 | 2027 | 41 |
| 9 | Axel Mendoza | 76.45 | 19 | 2027 | 46 |
| 10 | Nathan Egea | 75.88 | 20 | 2027 | 48 |

**Regression anchor:** Full top-10 stored in `ag4-baseline-top10-boys.json`. QA must compare against these board ranks, not pool ranks.

**INV-01 note:** Large `poolRank` vs `boardRank` gaps (e.g. rank 48 pool → rank 10 board) confirm that display must use `boardRankByPlayerId`, never `row.rank`.

---

## 6. Data Coverage Context

| Metric | Value | AG-4 target |
|---|---:|---|
| U19 pool DOB coverage | **24.2%** (133/549) | ≥40% U19 pool (stretch) |
| RANKED subset DOB coverage | **100%** (59/59 Boys) | N/A — required for RANKED |
| `classYearOverride` in U19 pool | **12** players | Audit before launch |
| RANKED class-year coverage | **100%** | S1: ≥35% of RANKED — **pass** |

Low full-pool DOB (24%) does **not** impair Boys chip utility because unknown-DOB players are PROVISIONAL and off the board. The relevant metric is RANKED-subset coverage (100%).

---

## 7. AG-4 Rev 2 Assumption Validation

| ID | Assumption | W0 result | Status |
|---|---|---|---|
| RC-1 | Only RANKED + `publicRankAllowed` on public board | 0 non-RANKED on board | **Pass** |
| RC-2 | Baseline is post-G1 board state | Captured 2026-06-17 post-WS-1 | **Pass** |
| P-AG4-3 | National rank from full board map | poolRank ≠ boardRank documented | **Pass** (validates implementation need) |
| §4.2 | Override-only/no-DOB can be RANKED | 0 null-class RANKED; all RANKED have DOB | **Drift resolved in practice** — WS-1 stricter than plan text |
| §4.3 | `includeUnknownClass` scope | 0 eligible rows today | **N/A / defensive** |
| S1 | ≥35% RANKED with known class year | 100% of RANKED | **Pass** |
| S2 | Largest bucket ≥10 | 2027: 34, 2028: 25 | **Pass (Boys)** |
| Girls board | Recruiting view per gender | 0 RANKED Girls | **Fail for Girls launch** |

---

## 8. AG-4 Readiness Assessment

| Area | Status | Notes |
|---|---|---|
| G1 foundation | **Ready** | Verdict engine + RANKED-only filter verified |
| §11.1 baseline artifacts | **Complete** | 7 JSON files in `docs/planning/audits/` |
| Boys recruiting filter data | **Ready** | 2 viable class buckets, 59 RANKED rows |
| Girls recruiting filter data | **Not ready** | 0 RANKED rows; chips would be empty |
| `includeUnknownClass` UX value | **Low** | 0 null-class RANKED |
| Analytics baseline (L11) | **Not started** | Requires 7-day post-G1 prod window |
| L12 joint display spec | **Not signed** | Draft from prior architect review |
| Copy / feature flag (L8/L9) | **Not started** | Out of W0 scope |

**W0 verdict:** Development (**W1–W4**) may proceed. Production launch remains gated.

---

## 9. Launch Gate Status (L1–L12)

| Gate | Criterion | Status | Evidence |
|---|---|---|---|
| **L1** | G1 exit — RANKED-only board | **Pass (code + W0)** | 59 Boys RANKED; 0 non-RANKED on board |
| **L2** | Subset monotonic V-AG4-1 | **Pending** | Needs W2/W4 tests |
| **L3** | Class count parity dry-run | **Pass (Boys)** | 2027→34, 2028→25 match histogram |
| **L4** | FORMER absent from board | **Pass** | 49 FORMER Boys in pool, 0 on board |
| **L5** | URL deep links | **Pending** | W3 |
| **L6** | U16/U13 strip `class` | **Pending** | W3 |
| **L7** | Typecheck clean | **Ongoing** | No W0 code in `src/` |
| **L8** | Copy approved (RC-4) | **Open** | Product |
| **L9** | Rollback flag tested | **Open** | W11 |
| **L10** | No new rating/snapshot types | **Pass** | Read-only W0 |
| **L11** | 7-day post-G1 analytics baseline | **Open** | Hard gate |
| **L12** | G1+AG-4 joint display spec | **Open** | Draft exists; not signed |

### Soft gates

| Gate | Target | Status |
|---|---|---|
| **S1** | ≥35% RANKED with known class | **Pass** — 100% |
| **S2** | Largest bucket ≥10 | **Pass (Boys)** — 34 & 25 |
| **S3** | Mobile chip QA | **Pending** — W4 |
| **W0** | Distribution report | **Complete** — this document |

---

## 10. Risks Discovered

| ID | Risk | Severity | Detail |
|---|---|---|---|
| **R-W0-01** | Girls U19 board empty | **High** | 56/56 PROVISIONAL — AG-4 Girls chips unusable at launch |
| **R-W0-02** | Board shrink vs pre-G1 expectations | **Medium** | 59/493 Boys (12%) on public board; support may report "missing players" |
| **R-W0-03** | `row.rank` vs board rank confusion | **Medium** | Top-10 shows pool rank up to 48 for board rank 10 — fix in W6/search |
| **R-W0-04** | `includeUnknownClass` dead path | **Low** | 0 null-class RANKED; keep as defensive toggle |
| **R-W0-05** | Plan vs WS-1 override-only RANKED | **Low** | Plan text allows override-only RANKED; code requires DOB path for RANKED |
| **R-W0-06** | 12 `classYearOverride` unaudited | **Medium** | Mis-bucket risk for 12 U19 pool players |
| **R-W0-07** | Low U19 pool DOB (24%) | **Medium** | Limits future RANKED growth until DOB entry improves |
| **R-W0-08** | June rollover chip shrink | **Low** | FORMER class years drop from board automatically post-G1 |

---

## 11. Recommendation: Proceed with W1–W4?

### Yes — with scope clarity

| Work | Proceed? | Rationale |
|---|---|---|
| **W1** Row enrichment (`effectiveClassYear`) | **Yes** | Required; 100% populated on Boys RANKED |
| **W2** `recruiting-class-filter.ts` | **Yes** | Boys data supports V-AG4-1/2 testing |
| **W3** URL state | **Yes** | No data dependency |
| **W4** RankingsClient chips + banner | **Yes** | Boys: 2 chips + All; Girls: empty state OK at dev stage |

### Launch caveats (not W1–W4 blockers)

1. **Do not enable production flag** until L11 analytics baseline + L12 sign-off.
2. **Girls recruiting view** needs data remediation (DOB + verified games) or documented waiver before prod.
3. Run **override audit** on 12 `classYearOverride` records before launch (L3/S1 admin gate).
4. Use **§11.1 artifacts** as QA regression anchors (RC-2) — never compare to pre-G1 board.

---

## 12. Artifact Index

| File | Contents |
|---|---|
| `ag4-baseline-manifest.json` | Summary metrics + chip proposal |
| `ag4-baseline-u19-boys-ranked-count.json` | Boys board size, verdict breakdown, top 10 |
| `ag4-baseline-u19-girls-ranked-count.json` | Girls board size, verdict breakdown |
| `ag4-baseline-top10-boys.json` | Boys top-10 anchor (board rank) |
| `ag4-baseline-top10-girls.json` | Empty array |
| `ag4-baseline-class-buckets.json` | Class-year histogram |
| `ag4-baseline-unknown-dob-ranked-set.json` | Empty array |

**Re-run:** `npx tsx scripts/capture-ag4-g1-baseline.ts`

---

*End of AG-4 W0 Baseline Report*
