# Competition Tier Governance Framework

**Status:** Planning specification (pre-activation)  
**Version:** 1.0  
**Effective:** 2026-06-18  
**Authority:** Rankings governance board (design); subordinate to [PHRANK_requirements.md](../PHRANK_requirements.md) pending numbering alignment  
**Scope:** Classification philosophy, rubric, assignment process, and activation gates — **no implementation in this document**

**Related audits:**

- [TIER_INTEGRITY_AUDIT.md](./audits/TIER_INTEGRITY_AUDIT.md) — semantic defect between DB assignments and codebase labels/weights
- [TIER_WEIGHT_IMPACT_SIMULATION.md](./audits/TIER_WEIGHT_IMPACT_SIMULATION.md) — projected rating volatility if weights activate prematurely
- [COMPETITION_TIER_CLASSIFICATION_REVIEW.md](./audits/COMPETITION_TIER_CLASSIFICATION_REVIEW.md) — rubric scoring of active competitions

---

## 1. Purpose

Competition tiers classify **how much competitive signal** a verified game contributes to player and team ratings. Tiers must be assigned **before** any of the following:

- GPS `leagueWeight` activation
- PlayerRating recomputation driven by tier changes
- RankingSnapshot regeneration
- Formula or policy changes that reference tier multipliers

This framework establishes **what tiers mean**, **how competitions are scored**, **who approves assignments**, and **what must be true before weights go live**.

---

## 2. Tier philosophy

### 2.1 Numbering convention (approved for governance)

| Tier | Name | Competition level |
| ---: | --- | --- |
| **1** | National Flagship | Highest — flagship national championships and premier scouting circuits |
| **2** | Elite National Circuit | Strong national invitational / collegiate junior competitions |
| **3** | Competitive Regional | Credible regional or age-band championships with mixed program depth |
| **4** | Developmental / Local | Entry, school intramural, or local club events with limited national relevance |

**Tier 1 = highest competition. Tier 4 = lowest competition.**

This is the **stakeholder convention** and the basis for all new governance work. It **differs** from legacy PHRANK requirements text (`Tier 1: Entry` … `Tier 4: Elite`) and from current codebase UI labels. Those legacy artifacts must be realigned before tier weights affect ratings.

### 2.2 What tiers are not

- Tiers are **not** a popularity or media-attention score.
- Tiers are **not** permanent — they are **re-evaluated each season** per competition edition.
- Tiers do **not** replace opponent strength (`opponentFactor`) or team context (`teamFactor`); they modulate **competition quality context** at the league level.
- Tiers do **not** override historical integrity — changing a tier does not rewrite raw stats; it changes how performance scores are weighted going forward (and requires explicit recompute approval for historical GPS).

### 2.3 Design principles

1. **Transparency** — Every active competition has a published tier, rubric score, and rationale.
2. **Consistency** — Same competition family at the same competitive level receives the same tier unless evidence changes.
3. **Separation of concerns** — Tier assignment (governance) is distinct from GPS computation (engineering) and rating publication (operations).
4. **Fail-closed activation** — If numbering, labels, and weights disagree, **do not activate** tier multipliers in production.

---

## 3. Tier definitions

### Tier 1 — National Flagship

**Definition:** The premier national championships where the highest concentration of recruited talent competes under verified official statistics. Results are primary inputs for national scouting and recruiting visibility.

**Examples (Philippines youth context):** UAAP high school basketball (boys/girls), NCAA Philippines junior championships when at full verified scope.

**Characteristics:**

- Sanctioned by a national governing body or top collegiate association
- Rosters dominated by programs with established development pathways
- High stat compliance and official box-score integrity
- National media and recruiting attention

**Proposed weight (when activated):** 1.40×

---

### Tier 2 — Elite National Circuit

**Definition:** Major national invitational tournaments and strong collegiate-age circuits that draw competitive club and school programs nationwide but sit below flagship collegiate championships in talent concentration.

**Examples:** Stallion Cup (17U/18U), Philippine Youth Basketball Championship (PYBC) at national finals scope, NBTC national-stage events (when verified).

**Characteristics:**

- Multi-region participation
- Credible program mix but wider variance in roster depth
- Verified stats with acceptable compliance
- Meaningful but secondary recruiting relevance vs Tier 1

**Proposed weight:** 1.25×

---

### Tier 3 — Competitive Regional

**Definition:** Regional championships, select invitational events, or age-band competitions with credible structure but limited top-end talent density or geographic scope.

**Examples:** Strong regional school leagues, city-wide championships with verified stats, developmental national events without full elite field.

**Characteristics:**

- Regional or age-band focus
- Mixed program quality
- Useful for player development tracking; limited standalone recruiting signal

**Proposed weight:** 1.10×

---

### Tier 4 — Developmental / Local

**Definition:** Entry-level, local club, school intramural, or newly onboarded competitions with minimal national competitive relevance. Included for completeness and player history, not for high-weight rating signal.

**Examples:** Local club friendlies, first-year leagues pending quality review, unverified organizer submissions.

**Characteristics:**

- Local geographic scope
- Low or unknown program concentration
- May be provisional until quality criteria are met

**Proposed weight:** 1.00× (baseline)

---

## 4. Scoring rubric

Each competition edition is scored on **five dimensions**, **0–20 points each** (total **0–100**). Scores map to recommended tier assignments.

### 4.1 Dimensions

| Dimension | 0–20 scale | What it measures |
| --- | ---: | --- |
| **Talent concentration** | 0 = dispersed unknown talent · 20 = elite national talent density | How often top-ranked / recruited players appear in the field |
| **Program quality** | 0 = ad hoc · 20 = flagship institutional programs | Coaching, infrastructure, roster continuity, stat compliance |
| **Recruiting / scouting relevance** | 0 = no scouting use · 20 = primary scouting circuit | Whether recruiters and national selectors treat results as meaningful |
| **Competitive depth** | 0 = thin field · 20 = deep multi-round field | Team count, schedule length, elimination integrity, verified game volume |
| **Geographic reach** | 0 = single locality · 20 = national draw | Regional spread of participating programs |

### 4.2 Score-to-tier mapping

| Total score | Recommended tier |
| ---: | ---: |
| 82–100 | 1 |
| 68–81 | 2 |
| 52–67 | 3 |
| 0–51 | 4 |

### 4.3 Adjustment rules

Apply after base family profile scoring:

| Condition | Adjustment |
| --- | --- |
| Girls division with small verified field | −2 competitive depth |
| Verified games < 30 in review season | −2 competitive depth |
| League `verificationStatus` ≠ VERIFIED | −1 program quality |
| Partial cup / missing elimination rounds | −1 competitive depth |
| `qualityScore` unset (0) | Flag as expert-estimated; confidence capped at MEDIUM |

### 4.4 Confidence levels

| Level | When used |
| --- | --- |
| **HIGH** | VERIFIED league, adequate game volume, family profile well known, DB tier matches rubric |
| **MEDIUM** | PROVISIONAL league or tier mismatch of ±1 |
| **LOW** | Thin evidence, unknown family, or large tier mismatch |
| **INSUFFICIENT** | No DB record or no verified games — tier cannot be locked |

---

## 5. Governance process

### 5.1 Roles

| Role | Responsibility |
| --- | --- |
| **Rankings governance board** | Approves tier philosophy, rubric changes, and disputed assignments |
| **Competition administrator** | Proposes tier per season; maintains rubric worksheets |
| **Rankings architect** | Validates weight mapping, recompute scope, and formula alignment |
| **Data operations** | Executes approved tier updates and recomputes (with explicit approval) |

### 5.2 Seasonal workflow

```
1. Inventory active competitions for the season
2. Score each edition with rubric (five dimensions)
3. Draft recommended tier + confidence + rationale
4. Board review (focus on mismatches and new competitions)
5. Approve and publish tier table (read-only public metadata)
6. Engineering gate: labels + weights aligned to Tier 1 = highest
7. Approved recompute only after gate passes
```

### 5.3 Approval record

Each assignment must capture:

- Competition name, season, age group, gender
- Rubric dimension scores and total
- Recommended tier and confidence
- Approver, date, and dissent notes (if any)
- Whether tier changed from prior season

Store approval artifacts in planning docs and audit JSON until an admin workflow exists.

### 5.4 Dispute handling

When stakeholders disagree with a tier:

1. Document the dissent and evidence submitted.
2. Re-score only disputed dimensions (do not ad hoc change tier without rubric).
3. Board vote for final locked tier.
4. Do not retroactively recompute ratings until dispute is closed and recompute is approved.

---

## 6. Weight mapping (future activation)

When governance and engineering gates pass, tier weights should follow **Tier 1 = highest multiplier**:

| Tier | Weight |
| ---: | ---: |
| 1 | 1.40 |
| 2 | 1.25 |
| 3 | 1.10 |
| 4 | 1.00 |

**Current production state (2026-06-18):** All 9,391 GPS rows store `leagueWeight = 1.000`. Tier multipliers are **not** applied. Activating weights before numbering alignment would invert competitive intent (see Tier Integrity Audit).

---

## 7. Activation gates (checklist)

Do **not** activate tier weighting until all are true:

- [ ] Tier philosophy documented with **Tier 1 = highest** (this document approved)
- [ ] PHRANK requirements and codebase labels updated to match
- [ ] Admin UI shows tier legend (1 = Flagship … 4 = Developmental)
- [ ] Formula v1 weight map uses Tier 1 = 1.40× (not inverted)
- [ ] All active competitions scored and board-approved
- [ ] `League.tier` values match approved assignments
- [ ] GPS import path writes correct `leagueWeight` per game
- [ ] Recompute plan approved (GPS → PlayerRating → snapshots)
- [ ] Dry-run impact report reviewed (tier-weight-impact simulation)

---

## 8. Relationship to League Quality Score

PHRANK requirements define a **League Quality Score (LQS)** on 0–100 that should derive tier assignment. Today most active leagues have `qualityScore = 0` (unset). Until LQS is computed automatically:

1. Use this **manual rubric** as the authoritative classification method.
2. Treat LQS = 0 as a **blocking gap** for HIGH confidence assignments.
3. When LQS is implemented, it should **feed the same five dimensions** rather than introduce a second competing scale.

---

## 9. Competitions outside the database

Competitions referenced in import planning but **without** active League records cannot receive locked tiers. They remain **INSUFFICIENT evidence** until:

- A League record exists
- Verified games are imported
- Rubric scoring is completed for that season edition

Known examples: **NBTC National Finals**, **JCIMBL** — classify after first verified import.

---

## 10. Revision history

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-06-18 | Initial framework; stakeholder numbering (1 = highest); five-dimension rubric |

---

*Planning document only — no ratings, GPS, snapshots, database tiers, formulas, or policies are modified by this framework.*
