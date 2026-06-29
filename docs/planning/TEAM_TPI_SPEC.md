# Team Performance Index (TPI) — Formula Specification

**Status:** TR-2 methodology specification (planning only)  
**Version:** 1.0  
**Effective:** 2026-06-17  
**Authority:** Rankings architect; subordinate to [TEAM_RANKINGS_ARCHITECTURE_REVIEW.md](./TEAM_RANKINGS_ARCHITECTURE_REVIEW.md), [RANKINGS_ENGINE_BASELINE.md](../RANKINGS_ENGINE_BASELINE.md)  
**Scope:** Define TPI-v1 for national `ProgramTeamRating` — **no implementation, schema, migrations, or recomputes**

---

## Document Control

| Artifact | Role |
|---|---|
| [TEAM_RANKINGS_ARCHITECTURE_REVIEW.md](./TEAM_RANKINGS_ARCHITECTURE_REVIEW.md) | National identity model, gate sequence TR-0–TR-7 |
| [TEAM_RANKINGS_TR0_TR1_READINESS.md](./audits/TEAM_RANKINGS_TR0_TR1_READINESS.md) | Identity prerequisites for credible pilot |
| [RANKINGS_ENGINE_BASELINE.md](../RANKINGS_ENGINE_BASELINE.md) | ADR-001, ADR-007, ADR-010, ADR-012 governance patterns |
| `src/lib/advanced-metrics.ts` | Player tier multipliers (alignment reference) |

### National identity (locked)

```
Board key = (programId, ageGroup, gender)
```

- `ageGroup` ∈ {U13, U16, U19} — from `Game.season.league.ageGroup`
- `gender` ∈ {Boys, Girls} — inferred from league/team naming (same rule as `team-rankings.ts`)
- Games pool across all verified competitions within the board
- Teams with `programId IS NULL` do not contribute to any national row (TI-03)

---

## 1. Design Goals

| Goal | TPI-v1 approach |
|---|---|
| **Reward winning** | Outcome anchor: win base 55 / loss base 45 on 0–100 scale before context multipliers |
| **Reward strength of opponent** | `opponentFactor` from opponent program TPI (2-iteration refinement at launch) |
| **Reward stronger competitions** | `leagueTierWeight` applied **once per game** (ADR-012 pattern) |
| **Reward recent performance** | Exponential recency decay; half-life 180 days |
| **Resist small-sample inflation** | Bayesian shrinkage toward board prior (50.0); minimum verified games + distinct opponents |
| **Support U13, U16, U19** | Separate boards; no cross-age pooling; same formula, board-scoped parameters |

### Non-goals (TPI-v1)

| Excluded | Rationale |
|---|---|
| Average of `PlayerRating` | Team strength ≠ roster talent sum (architecture ADR-T family) |
| Competition standings as rating | W/L tables remain derived read model, not TPI |
| Retroactive national history | Snapshots begin at TR-7 cutover only |
| Home/away adjustment | Deferred to TPI-v2+ unless product requests at TR-2 sign-off |

---

## 2. Formula Candidates

### 2.1 Comparison matrix

| Criterion | A. Elo-style | B. Massey / Colley | C. Weighted performance index | D. Hybrid |
|---|---|---|---|---|
| **Core mechanic** | Pairwise expected vs actual; K-factor updates | Linear system on W/L (+ margin for Massey) | Per-game score × weights, summed | Combines C game scores + iterative opponent refinement |
| **Opponent strength** | Built into expected score | Embedded in system matrix | Explicit `opponentFactor` | Iterative pass: WPI + opponent TPI feedback |
| **League tier** | Awkward — usually single pool | Requires tier-split systems or weights | Natural per-game multiplier | Same as C |
| **Recency** | Requires decay on K or period resets | Typically season-scoped | Natural per-game weight | Same as C |
| **Small samples** | High variance; provisional ratings common | Colley stabilizes; Massey less so | Shrinkage + thresholds | Same as C |
| **Explainability** | Moderate (“chess rating”) | Low (linear algebra) | High (box score of factors per game) | Moderate-high |
| **Peach Basket alignment** | New paradigm vs player engine | New paradigm | **Mirrors player game-contribution model** | **Recommended** |
| **Launch complexity** | Medium (pairwise ordering) | Medium-high | Low-medium | Medium |
| **Validation** | Hard to audit per-game | Hard to audit per-game | **Per-game audit trail** | Per-game + iteration log |

### 2.2 Candidate summaries

#### A. Elo-style

```
E = 1 / (1 + 10^((R_opp - R_self) / 400))
R_new = R_old + K × (S - E)    // S ∈ {1, 0}
```

- **Pros:** Well-known; opponent-aware by construction.
- **Cons:** Processing order matters; recency and tier need ad-hoc K tuning; less aligned with ADR-012 “weight once at game level”; harder to produce per-game audit rows matching player `GamePerformanceScore` pattern.

#### B. Massey / Colley style

```
Massey:  r_i - r_j ≈ margin_ij
Colley:  (n + 2) × w_i - Σ w_j = 1 + (wins - losses)/2
```

- **Pros:** Mathematically elegant; Colley handles sparse schedules.
- **Cons:** No native tier or recency without extending the linear system; opaque to public methodology page; separate system per age/gender board.

#### C. Weighted performance index (WPI)

```
gameScore_g = outcomeBase_g × leagueTierWeight_g × recencyWeight_g × opponentFactor_g
TPI = normalize( Σ gameScore_g ) + shrinkage
```

- **Pros:** Aligns with player formula decomposition; ADR-012 compliant; auditable per game.
- **Cons:** `opponentFactor` needs opponent ratings — chicken-and-egg without iteration or proxy.

#### D. Hybrid (recommended)

**WPI game contributions + 2-pass opponent refinement** (lightweight, not full Elo).

```
Pass 0: opponentFactor from tier-weighted win% proxy
Pass 1: opponentFactor from Pass-0 TPI_observed
Final:  TPI_adjusted with shrinkage
```

- **Pros:** Best of C with credible SOS at launch; bounded compute; iteration count is policy-versioned.
- **Cons:** Slightly more complex than single-pass WPI; must document convergence (2 passes sufficient at launch).

---

## 3. Recommended Launch Formula — TPI-v1

**Official name:** `TPI-v1` (`formulaVersionId` = `TPI-v1` at persist time)  
**Model:** **D. Hybrid** — Weighted Performance Index with 2-pass opponent refinement

### 3.1 Evidence filter

| Input | Rule |
|---|---|
| `Game.verificationStatus` | **`TEAM-EVIDENCE-v1-official-import`** — see [TR-3.5 policy](./audits/TEAM_TR35_COMPETITION_VERIFICATION_POLICY.md). `VERIFIED` **or** `SUBMITTED` from `STAFF_MANUAL_ENTRY` / `IMPORTED` submission path. |
| `Game.deletedAt` | `NULL` |
| `season`, `league`, `homeTeam`, `awayTeam` | `deletedAt IS NULL` |
| Team → Program link | Both teams must resolve `programId` for game to count; if one side null, game counts for linked side only in opponentFactor denominator audit — **game excluded from national pool if focal program unlinked** |
| Default / forfeit games | **Included** when `VERIFIED` (PYBC `G-2025-025` precedent: team result counts, 0 player stats OK) |
| Board assignment | Game contributes to board matching `league.ageGroup` + inferred `gender` |

### 3.2 Per-game score (exact)

For program **P** in game **g**:

```
gameScore(P, g) = (outcomeBase + marginAdj + oppAdj) × leagueTierWeight × recencyWeight × opponentFactor
```

#### Outcome base

| Result | `outcomeBase` |
|---|---:|
| Win | **55.0** |
| Loss | **45.0** |
| Tie (rare) | **50.0** |

Win/loss from program’s side: `homeScore` vs `awayScore` for program’s team side.

#### Margin adjustment

```
pointDiff = ownScore - oppScore
marginAdj = clamp(pointDiff / 20, -5.0, +5.0)
```

Caps blowout gaming at ±5 index points before multipliers.

#### Opponent adjustment (pre-multiplier additive)

```
oppAdj = (opponentStrength - 50.0) × 0.12
```

`opponentStrength` is 0–100 scale from §3.4.

#### League tier weight (ADR-012 — applied once)

Aligned with player `finalPerformanceScore` tier table in `advanced-metrics.ts`:

| `League.tier` | `leagueTierWeight` |
|---:|---:|
| 1 (Entry) | **1.00** |
| 2 (Developmental) | **1.10** |
| 3 (Competitive) | **1.25** |
| 4 (Elite) | **1.40** |

#### Recency weight

```
ageDays = evaluationDate - gameDate   (UTC calendar days, floor 0)
λ = ln(2) / halfLifeDays
recencyWeight = exp(-λ × ageDays)
```

| Parameter | Launch value |
|---|---:|
| `halfLifeDays` | **180** |
| `maxAgeDays` (optional zero floor) | **540** — games older contribute 0 |

At 180-day half-life: game 200 days ago ≈ **0.46×** today (validates V-TR-04).

#### Opponent factor (multiplicative)

```
opponentFactor = clamp(1 + ((opponentStrength - 50) / 400), 0.85, 1.15)
```

Same functional form as player `opponentFactor` in `advanced-metrics.ts`.

### 3.3 Aggregation

```
effectiveWeight(P) = Σ_g recencyWeight(g)
rawSum(P)          = Σ_g gameScore(P, g)
TPI_observed(P)    = rawSum(P) / effectiveWeight(P)
```

Clamp observed before shrinkage:

```
TPI_observed_clamped(P) = clamp(TPI_observed(P), 25.0, 75.0)
```

Prevents single-game extremes from dominating shrinkage input.

### 3.4 Opponent strength — 2-pass refinement

#### Pass 0 (proxy — no opponent TPI yet)

For each opponent program **O** on the board:

```
tierWeightedWins  = Σ wins  × leagueTierWeight
tierWeightedGames = Σ (wins + losses) × leagueTierWeight   // per-game tier weight
tierWeightedWinPct = tierWeightedWins / max(tierWeightedGames, 1)

opponentStrength₀(O) = 30 + 40 × tierWeightedWinPct
```

Range: **30–70** at pass 0.

#### Pass 1 (refined)

Compute `TPI_observed_clamped` for all programs using `opponentStrength₀` in each game.

```
opponentStrength₁(O) = TPI_observed_clamped(O)
```

#### Final game scores

Recompute all `gameScore` with `opponentStrength₁`. Final observed:

```
TPI_observed_final(P) = rawSum₁(P) / effectiveWeight(P)
```

**Launch iteration count:** **2** (pass 0 proxy + pass 1 final). No further iterations at TPI-v1.

### 3.5 Shrinkage

Bayesian shrinkage toward board prior (analogous to player `adjustedRating`, distinct from carryover per ADR-009):

```
TPI_adjusted(P) = (effectiveWeight(P) × TPI_observed_final(P) + k × boardPrior) / (effectiveWeight(P) + k)
```

| Parameter | Launch value | Notes |
|---|---:|---|
| `boardPrior` | **50.0** | Neutral; same all boards at launch |
| `k` (`shrinkageK_team`) | **6.0** | Effective prior games; policy-versioned |
| Public scale | **0–100** | `TPI_adjusted` is the published **TPI** |

**Interpretation:** Program with 6 effective recency-weighted games regresses halfway to 50.

#### Worked shrinkage

| Effective games | TPI_observed | TPI_adjusted |
|---:|---:|---:|
| 12 | 62.0 | 58.0 |
| 6 | 62.0 | 56.0 |
| 3 | 62.0 | 54.0 |
| 0 | — | excluded (below threshold) |

### 3.6 Minimum games policy (TPI-v1-launch)

Policy id (planning): **`TEAM-POLICY-v1-launch`**

| Rule | Launch | Mature target |
|---|---:|---:|
| Minimum **verified** games | **8** | 12 |
| Minimum **distinct opponent programs** | **3** | 5 |
| Minimum tier-2+ games | **0** | 2 (optional policy bump) |

Programs failing any rule are **computed internally** but **excluded from public national board** (analogous to player eligibility).

Distinct opponents counted by opponent `programId` on verified games within the board.

### 3.7 Board rank

```
rank = dense_rank(TPI_adjusted DESC, verifiedGameCount DESC, programName ASC)
```

Ties broken by higher verified game count, then alphabetical program name.

### 3.8 Age-group handling

| Rule | Detail |
|---|---|
| Separation | Independent TPI pools per `(ageGroup, gender)` |
| Game routing | `league.ageGroup` only — no cross-board attribution |
| June rollover | **Policy stub:** team boards follow same June 1 progression as player boards; games before/after rollover attributed to league age at game time; **June 2026 team rollover memo required before TR-5** — does not block TR-3 PYBC pilot (single age group) |
| U13 / U16 / U19 parameters | Same formula constants at launch; board-specific priors deferred to TPI-v2+ |

---

## 4. Sample Calculations

*Illustrative numbers using Peach Basket competition structures. Pass-1 opponent strengths are rounded for readability.*

### 4.1 Setup — PYBC U16 Boys (8 programs, 37 games)

Canonical checkpoint (PROJECT_STATUS):

| Program | W-L | PF | PA | Diff |
|---|---:|---:|---:|---:|
| San Pedro Spartans | 8-4 | 952 | 820 | +132 |
| … | … | … | … | … |
| LEV Construction Full Potential | 3-5 | 513 | 527 | -14 |

Assume evaluation date: **2026-06-17**. PYBC league `tier = 2` (Developmental) → `leagueTierWeight = 1.10` for all PYBC games. All games within last 12 months → `recencyWeight ≈ 0.85–1.00`.

### 4.2 Game example — San Pedro win vs LEV (+22 margin)

**Pass 0:** LEV `tierWeightedWinPct = 3/8 = 0.375` → `opponentStrength₀ = 30 + 40×0.375 = **45.0**`

| Component | Value |
|---|---:|
| outcomeBase | 55.0 (win) |
| marginAdj | clamp(22/20, -5, 5) = **+5.0** |
| oppAdj | (45 - 50) × 0.12 = **-0.6** |
| Subtotal | 55 + 5 - 0.6 = **59.4** |
| × leagueTierWeight | × 1.10 = **65.3** |
| × recencyWeight | × 0.95 ≈ **62.1** |
| × opponentFactor | × clamp(1 + (45-50)/400, 0.85, 1.15) = × 0.9875 ≈ **61.3** |

**gameScore ≈ 61.3** for San Pedro on this game.

### 4.3 Program-level sketch — San Pedro (8-4, strong margin)

After all 12 games, suppose Pass-1 yields:

| Metric | San Pedro | LEV Construction |
|---|---:|---:|
| effectiveWeight | ~11.2 | ~7.8 |
| TPI_observed_final | ~58.5 | ~46.2 |
| TPI_adjusted (k=6) | **~55.4** | **~47.7** |

San Pedro ranks above LEV on TPI despite both being in same PYBC competition — margin and opponent context lift San Pedro.

**National vs competition:** PYBC standings sort by W-L within competition; national TPI may order programs differently when multi-competition evidence is added post-launch.

### 4.4 UAAP Season 88 U19 Boys (hypothetical single league)

76 verified games, 8 schools, `tier = 4` (Elite) → `leagueTierWeight = 1.40`.

| School (program) | W-L | Competition win% | Illustrative TPI_adjusted |
|---|---:|---:|---:|
| School A | 10-2 | .833 | ~61.2 |
| School B | 8-4 | .667 | ~55.8 |
| School C | 4-8 | .333 | ~44.1 |

**Note:** TR-3 pilot on UAAP requires **TR-1 merge** of same-program duplicate Teams — otherwise game pools split across Team IDs under one `programId` (V-TR-02 risk).

### 4.5 Below threshold — club with 5 verified games

| Metric | Value |
|---|---:|
| verifiedGameCount | 5 |
| distinct opponents | 4 |
| TPI_observed_final | 64.0 |

**Public board:** **Excluded** (< 8 games). Internal preview may show “Insufficient games (5/8)”.

### 4.6 Default / forfeit game (PYBC G-2025-025 pattern)

Team-result-only verified game, 0 `GameStat` rows:

- Counts toward `verifiedGameCount`
- `outcomeBase` / `marginAdj` from final score
- Included in opponent pass calculations

---

## 5. Versioning Strategy

### 5.1 TPI-v1 (launch)

| Field | Value |
|---|---|
| `formulaVersionId` | `TPI-v1` |
| `policyVersionId` | `TEAM-POLICY-v1-launch` |
| Iterations | 2-pass opponent refinement |
| `shrinkageK_team` | 6.0 |
| `halfLifeDays` | 180 |
| Tier weights | 1.00 / 1.10 / 1.25 / 1.40 |

**Governance:** Mirror ADR-010 — new formula version is additive; prior versions remain auditable; no overwrite of historical team snapshots.

### 5.2 Future TPI-v2+ (planning — not approved)

| Candidate enhancement | Trigger |
|---|---|
| **TPI-v2-a** | Full iterative SOS (4+ passes) until Δ < ε |
| **TPI-v2-b** | Home/away factor ±2% |
| **TPI-v2-c** | Board-specific `boardPrior` from prior season snapshot |
| **TPI-v2-d** | Margin function nonlinear (basketball tempo normalization) |
| **TPI-v2-e** | Separate `TeamPolicyVersion` tier-2+ minimum games |

**Activation:** New `formulaVersionId` and/or `policyVersionId` only — **prospective-only** (ADR-007). TR-7 snapshots freeze both IDs per ADR-013 pattern.

### 5.3 Coexistence rules

| Rule | Detail |
|---|---|
| Live board | Reads latest approved `formulaVersionId` + `policyVersionId` |
| Snapshots | Immutable; header stores both IDs |
| Player engine | **Orthogonal** — TPI versions independent of PHRANK v1/v2 |
| Recompute | Explicit approval required (data-safety) |

---

## 6. Validation Framework

Procedures for TR-3 pilot (read-only) and TR-5/TR-6 cutover.

### 6.1 Pre-persist / pilot (V-TR-01 – V-TR-07)

| ID | Check | Procedure | Pass |
|---|---|---|---|
| **V-TR-01** | One national row per `(programId, ageGroup, gender)` | Query pilot output for duplicate keys | 0 duplicates |
| **V-TR-02** | Game count matches manual audit | Pick 3 programs; hand-count VERIFIED games on board | ±0 |
| **V-TR-03** | PYBC full pool | 8 programs; sum games = **37** | Exact |
| **V-TR-04** | Recency math | Game at 200 days vs today | Ratio ≈ **0.46** (±0.02) at 180-day half-life |
| **V-TR-05** | Tier weight once | Per-game audit log: single `leagueTierWeight` factor | No double-apply |
| **V-TR-06** | Threshold exclusion | Program with 7 games excluded from public output | Excluded |
| **V-TR-07** | Null `programId` | No national row without program | 0 rows |

### 6.2 Cutover / UI (V-TR-08 – V-TR-10)

| ID | Check | Procedure | Pass |
|---|---|---|---|
| **V-TR-08** | Unique programs on national `/teams` | Filter U16 Boys; count distinct `programId` | = row count |
| **V-TR-09** | Competition standings parity | `getDynamicTeamStandings` for one league vs pre-cutover baseline | W/L ±0 |
| **V-TR-10** | Homepage preview ⊆ national board | Top 5 program IDs exist on national board | Subset |

### 6.3 TPI-specific audit exports (TR-3 deliverable)

| Export | Contents |
|---|---|
| `tpi-game-contributions-{programId}.csv` | Per-game: outcomeBase, marginAdj, oppAdj, tier, recency, opponentFactor, gameScore |
| `tpi-pass0-opponent-strength.csv` | All programs: tierWeightedWinPct, opponentStrength₀ |
| `tpi-final-board.csv` | programId, ageGroup, gender, TPI_observed, TPI_adjusted, rank, verifiedGameCount, distinctOpponents |
| `tpi-excluded-below-threshold.csv` | Programs computed but not public |

### 6.4 Regression guards

| Guard | Expected |
|---|---|
| Player `/rankings` | Unchanged (V-TR-11 in architecture doc) |
| PYBC competition standings | 8 rows, same W-L as PROJECT_STATUS checkpoint |
| `npx tsc --noEmit` | Pass when implementation lands |

---

## 7. Launch Recommendation

### Decision: **A — Ready for TR-3 pilot (methodology)**

The TPI-v1 specification is **complete enough** to begin a **bounded read-only TR-3 pilot** (compute scripts, audit exports, no persist).

| Ready | Rationale |
|---|---|
| ✓ | Formula candidates evaluated; launch model selected with exact weights |
| ✓ | Recency, shrinkage, thresholds, and tier alignment specified |
| ✓ | Sample calculations grounded in PYBC + UAAP structures |
| ✓ | Versioning and validation framework defined |
| ✓ | ADR-012, ADR-007, ADR-010 patterns mirrored |

### Execution gates (unchanged from TR-0/TR-1)

| Gate | Requirement for pilot **cohort** |
|---|---|
| **TR-3 PYBC cohort** | **May proceed** — 8 programs, clean identity, 37-game regression |
| **TR-3 UAAP cohort** | **Blocked until TR-1** — same-program duplicate Teams |
| **TR-3 full national board** | **Blocked until TR-0 + TR-1** |
| **TR-5 persist** | Requires TR-3 validation report + product sign-off on this spec |

### Open items (do not block TR-3 PYBC pilot)

| Item | Owner | Target |
|---|---|---|
| June team-board rollover memo | Product + rankings architect | Before TR-5 |
| Board-specific priors | Deferred | TPI-v2 |
| `TEAM-POLICY-v1-launch` registry row | Engineering / WS-3 extension | TR-4 |

---

## Approval

| Role | TR-2 sign-off |
|---|---|
| Product owner | [ ] |
| Rankings architect | [x] Spec authored 2026-06-17 |
| Engineering lead | [ ] |
| Data integrity lead | [ ] |

**This document authorizes TR-3 read-only pilot planning only.** TR-4+ requires separate explicit approval per data-safety rules.

---

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-06-17 | Initial TPI-v1 specification (TR-2) |

---

*End of Team Performance Index Specification v1.0*
