# Data Remediation Strategy

**Status:** Planning specification  
**Version:** 1.0  
**Effective:** 2026-06-17  
**Authority:** Derived from Verdict Distribution Audit (`docs/planning/audits/VERDICT_DISTRIBUTION_AUDIT.md`) and AG-4 W0 baseline  
**Scope:** Data and operations only — **no WS-1 policy changes, no threshold changes, no code, no migrations, no rating recomputes without explicit approval**

---

## Document Control

### Constraints (locked)

| Constraint | Implication |
|---|---|
| WS-1 `launch-v1` unchanged | Boys 10 / Girls 5 / P12 unknown-DOB off-board remain |
| No threshold changes | Growth must come from **DOB** and **verified game volume** |
| No eligibility policy changes | `classYearOverride` does not bypass DOB for RANKED today |
| Historical integrity | `Game` / `GameStat` are not rewritten; only **Player bio** and **new verified evidence** |
| Sensitive writes | `PlayerRating` recomputes and snapshot publishes require **explicit approval** per data-safety rules |

### Source audit snapshot

| Off-board path | Count | Recoverable via data? |
|---|---:|---|
| P7 `BELOW_THRESHOLD` | 460 | **Partial** — add verified games |
| P12 `UNKNOWN_DOB` | 349 | **Partial** — add `birthDate` (then bracket/class-year rules apply) |
| P2 `GRADUATED` | 49 | **No** — correct exclusion |
| P3 `OUT_OF_BRACKET` | 16 | **Partial** — DOB correction only if wrong |

| Board today | RANKED |
|---|---:|
| U19 Boys | 59 |
| U19 Girls | 0 |
| U16 Boys | 7 |
| U13 Boys | 0 |

---

## Executive Summary

Public board growth under fixed WS-1 policy is a **data completeness and competition coverage** problem, not an eligibility engineering problem. The two actionable levers are:

1. **`birthDate` entry** for game-qualified players (349 global P12 cohort).
2. **Verified game accumulation** for near-threshold players (460 global P7 cohort; 118 U19 Boys within 1–4 games of 10).

**Graduated (49) and out-of-bracket (16) players are not growth targets** — they are integrity exclusions.

**Recommended focus order:** U19 Girls DOB blitz → U19 Boys P12 → U19 Boys near-threshold P7 → U16 Boys → U13 Boys (long horizon).

**Projected board growth (90-day, conservative):** U19 Boys **59 → 95–120**; U19 Girls **0 → 25–40**; U16 Boys **7 → 20–35**; U13 Boys **0 → 5–15** — assuming disciplined admin remediation and continued verified imports, **without** rating recomputes unless approved after new games land.

---

## 1. DOB Remediation Strategy

### 1.1 Problem statement

**349 players** have sufficient verified games but lack `birthDate` → WS-1 P12 `PROVISIONAL` / `UNKNOWN_DOB` → **off public board**.

**100% of current RANKED players have DOB.** DOB is a hard practical gate for board presence under post-G1 WS-1.

### 1.2 Remediation channels (existing tooling — no new code)

| Channel | Owner | Best for |
|---|---|---|
| **Admin Player Management** (`PlayerManagementClient`) | Data ops | Individual corrections, override audit |
| **Program detail roster bio edit** (`ProgramDetailClient`) | Program admins | Bulk roster during season review |
| **Import pipelines** (UAAP/PYBC batch JSON) | Import ops | Initial capture at ingest |
| **Submission review** | Portal admins | Catch missing bio at approval time |

### 1.3 DOB quality rules

| Rule | Action |
|---|---|
| Source priority | Official league roster > school record > coach submission |
| `classYearOverride` | Use only when calculated class year is wrong; **does not replace DOB** for WS-1 RANKED path |
| Invalid DOB → P3 | Validate age bracket before bulk entry; flag players who would become `OUT_OF_BRACKET` |
| Post-June graduation | Entering DOB for class-year-eligible seniors may surface P2 `FORMER` — expected, not failure |

### 1.4 Tiered DOB cohorts

| Tier | Cohort | Count (audit) | Action |
|---|---|---:|---|
| **D0** | U19 Girls P12 (games ≥ 5, no DOB) | **45** | Immediate — unlocks entire Girls board |
| **D1** | U19 Boys P12 (games ≥ 10, no DOB) | **175** | High priority — largest Boys gain |
| **D2** | U16 Boys P12 | **108** | AG-3 readiness |
| **D3** | U13 Boys P12 | **21** | Lower priority — most still P7-blocked |
| **D4** | P7 + no DOB (games below threshold) | **445** | DOB after games — secondary sequencing |

### 1.5 DOB campaign mechanics

1. **Export P12 worklists** per tier (read-only script; requires approval to run).
2. Assign by **Program** — coaches complete rosters where cluster density is highest.
3. **Weekly DOB coverage KPI** — track `birthDate` non-null among P12 cohort, not whole player table.
4. **Override audit** — review 12 existing `classYearOverride` records for consistency with entered DOB.
5. **Stop rule** — do not mass-enter estimated DOBs; use "Class pending" off-board until verified.

### 1.6 Expected DOB → RANKED conversion rate

Not all P12 players become RANKED after DOB entry:

| Post-DOB outcome | Est. share of P12 | Result |
|---|---:|---|
| Pass bracket + class-year → RANKED | **70–85%** | Board growth |
| P3 `OUT_OF_BRACKET` | **5–10%** | DOB reveals wrong age group |
| P2 `FORMER` | **5–15%** | DOB reveals graduated class year |
| Still blocked (other) | **<5%** | Edge cases |

Use **75% conversion** for planning projections on P12 cohorts.

---

## 2. Competition Coverage Strategy

### 2.1 Problem statement

**460 players** are P7 `BELOW_THRESHOLD` — insufficient `verifiedGameCount` for gender threshold (Boys 10 / Girls 5).

Zero P6 (zero games) in current data — every rated player has **some** verified evidence; the gap is **volume**, not existence.

### 2.2 Verified game definition (unchanged)

Games count toward threshold only when:

- `Game.verificationStatus === VERIFIED`
- `GameStat` linked to player, not soft-deleted
- GPS/rating pipeline has processed performance (existing Formula v1 path)

### 2.3 Coverage levers (no policy change)

| Lever | Description | Primary cohort |
|---|---|---|
| **Import additional verified seasons** | UAAP, PYBC, NCAA batches through existing validators | P7 near-threshold |
| **Verify pending games** | Move VALIDATED/PENDING games to VERIFIED where appropriate | Latent game pool |
| **Submission portal** | Encourage program stat submissions for uncovered players | Girls, U16 |
| **Roster-game linkage** | Ensure imports resolve player identity so stats attach correctly | All |
| **Avoid duplicate game inflation** | Identity merges before import — duplicates don't help threshold | Data integrity |

### 2.4 Near-threshold priority (highest ROI)

**U19 Boys P7 — games short of 10 (n=194):**

| Games short | Players | Cumulative if cleared |
|---:|---:|---|
| 1 | 15 | 15 |
| 2 | 32 | 47 |
| 3 | 30 | 77 |
| 4 | 32 | **109** |

**118 players (61% of U19 Boys P7)** need ≤4 additional verified games — target for import and verification sprints.

**U19 Girls P7 (n=11):** Small cohort — 7 need 1 game, 2 need 2 games. **Low effort, low absolute gain** vs DOB.

### 2.5 Age-group competition strategy

| Age group | P7 count | Strategy |
|---|---:|---|
| U19 Boys | 194 | Near-threshold sprint + ongoing season imports |
| U16 Boys | 138 | PYBC/UAAP U16 verified coverage expansion |
| U13 Boys | 117 | Long-horizon — need full 10-game careers |
| U19 Girls | 11 | Secondary to DOB |

### 2.6 Sequencing rule

**Games before DOB is wasteful for board growth** when player is far below threshold. **DOB before games** is wasteful when player is P7-only with 1–2 games.

**Optimal:** For each player, remediate the **binding constraint first**:

```
if verifiedGameCount < threshold → prioritize games
else if birthDate is null → prioritize DOB
else → already RANKED or FORMER/HIDDEN
```

---

## 3. Prioritization Framework

### 3.1 Scoring model

Each off-board player receives a **remediation priority score** (planning-only):

| Factor | Weight | Scoring |
|---|---:|---|
| Board impact (U19 > U16 > U13) | 40% | U19=3, U16=2, U13=1 |
| Binding constraint clarity | 25% | P12-only=3, P7 near-threshold (≤4 short)=3, P7 far=1 |
| Games to threshold | 20% | inverse — fewer games short = higher |
| Program cluster density | 10% | ≥5 players same program = bonus |
| AG-4 / launch relevance | 5% | U19 Girls + U19 Boys P12 |

### 3.2 Priority tiers

| Tier | Definition | Est. players | Target timeline |
|---|---|---:|---|
| **T0 — Critical** | U19 Girls P12 | 45 | Weeks 1–2 |
| **T1 — High** | U19 Boys P12 | 175 | Weeks 2–6 |
| **T2 — Quick wins** | U19 Boys P7, ≤4 games short | 118 | Weeks 4–8 (imports) |
| **T3 — AG-3 prep** | U16 Boys P12 + near P7 | ~150 | Weeks 6–12 |
| **T4 — Backlog** | U13 Boys, far P7 | 117+ | 90+ days |
| **T5 — Excluded** | P2 FORMER, P3 unfixable | 65 | No action |

### 3.3 Program-centric execution

Batch remediation by **Program** (school/club) rather than alphabetically:

- One coach session captures DOB for full roster.
- Import verification per program reduces context switching.
- Aligns with existing Program Management and roster edit flows.

### 3.4 Decision matrix

| If player is… | First action | Second action |
|---|---|---|
| P12, U19 Girls | Enter DOB | — |
| P12, U19 Boys | Enter DOB | — |
| P7, ≤4 games short, has DOB | Import/verify games | — |
| P7, no DOB, <threshold | Add games first | Then DOB |
| P2 FORMER | None | Archive from outreach lists |
| P3 OUT_OF_BRACKET | Verify DOB accuracy | Correct or accept exclusion |
| Has `classYearOverride`, off-board | Enter DOB | Re-audit override |

---

## 4. Girls Board Recovery Plan

### 4.1 Current state

| Metric | Value |
|---|---:|
| U19 Girls rating pool | 56 |
| RANKED | **0** |
| P12 (unknown DOB, games ≥ 5) | **45 (80.4%)** |
| P7 (below 5 games) | 11 (19.6%) |

**Root cause:** Missing `birthDate`, not game threshold. Girls 5-game bar is largely already met.

### 4.2 Recovery phases

| Phase | Goal | Actions | Target RANKED |
|---|---|---|---|
| **G-1** | DOB blitz | Export 45-player P12 list; program roster bio campaign | **30–38** |
| **G-2** | Near-threshold games | Clear 11 P7 (mostly 1 game short) via verified imports | **+8–10** |
| **G-3** | Pool expansion | Ensure Girls ratings exist for new PYBC/UAAP Girls imports | Sustaining |
| **G-4** | Validation | Re-run verdict audit; compare to baseline | 0 → target |

### 4.3 Girls-specific risks

| Risk | Mitigation |
|---|---|
| Small pool volatility | One program completion moves board significantly — document in comms |
| No U16/U13 Girls ratings | Future age-group launches need Girls rating rows created via normal import/rating pipeline (approved) |
| False expectation on override | Communicate DOB is required; override alone does not board |

### 4.4 Success definition (Girls)

| Milestone | Target | Timeframe |
|---|---|---|
| Minimum viable board | **≥15 RANKED** | 30 days |
| AG-4 Girls chips viable | **≥25 RANKED**, 2 class buckets ≥10 | 60 days |
| Steady state | **≥40 RANKED** | 90 days |

---

## 5. U16 Readiness Plan

### 5.1 Current state

| Metric | Value |
|---|---:|
| U16 Boys pool | 253 |
| RANKED | **7** (2.8%) |
| P12 | 108 |
| P7 | 138 |

No U16 Girls ratings in database — Girls U16 launch requires rating row creation via imports (separate track).

### 5.2 Readiness phases

| Phase | Focus | Board target (Boys) |
|---|---|---:|
| **U16-1** | DOB for P12 (108) | 7 → **45–55** |
| **U16-2** | Near-threshold P7 within 1–4 games | **+25–35** |
| **U16-3** | PYBC U16 verified game completeness audit | Sustaining |
| **U16-4** | AG-3 soft gate: **≥50 RANKED** before public launch | 60–90 days |

### 5.3 AG-3 gate alignment

| AG-3 requirement | Remediation link |
|---|---|
| Meaningful U16 public board | P12 + near P7 campaigns |
| No WS-1 changes | Data-only path |
| Independent of AG-4 | Parallel execution OK |

### 5.4 U16 Girls gap

Plan assumes **no U16 Girls `PlayerRating` rows** today. Recovery requires:

1. Girls competition imports with verified games.
2. `compute-player-ratings-v1-u16` (or equivalent) — **requires explicit approval**.
3. DOB at ingest — apply Girls P12 lessons early.

---

## 6. U13 Readiness Plan

### 6.1 Current state

| Metric | Value |
|---|---:|
| U13 Boys pool | 138 |
| RANKED | **0** |
| P7 | 117 (84.8%) |
| P12 | 21 |

**Primary blocker is game volume (10-game Boys threshold)**, not DOB alone.

### 6.2 Readiness phases

| Phase | Focus | Realistic outcome |
|---|---|---|
| **U13-1** | Near-threshold identification (≤3 games short) | Quick wins only |
| **U13-2** | U13 competition import coverage | Build verified game depth |
| **U13-3** | DOB for players who reach threshold | Apply D-tier rules |
| **U13-4** | Public launch decision | **≥30 RANKED** minimum for non-empty board |

### 6.3 Honest assessment

U13 public launch is **90+ day horizon** under fixed `launch-v1` Boys 10 threshold without policy change. "Coming Soon" UI remains appropriate.

**Do not prioritize U13 DOB campaigns** until players approach game threshold — low board ROI.

### 6.4 U13 Girls

No rating rows — same as U16 Girls: import + rating pipeline first.

---

## 7. Expected Board-Growth Projections

### 7.1 Methodology

- **Baseline:** Verdict Distribution Audit (2026-06-17)
- **P12 → RANKED conversion:** 75% (mid estimate)
- **P7 near-threshold → RANKED:** 80% of cohort clears within 90 days (import success)
- **P2/P3 leakage:** Deducted from P12 conversions
- **No threshold or WS-1 changes**

### 7.2 Projection table (90-day)

| Segment | Baseline RANKED | Conservative | Expected | Optimistic |
|---|---:|---:|---:|---:|
| **U19 Boys** | 59 | 85 | **105** | 130 |
| **U19 Girls** | 0 | 20 | **32** | 45 |
| **U16 Boys** | 7 | 18 | **28** | 45 |
| **U13 Boys** | 0 | 3 | **8** | 15 |
| **Total RANKED** | 66 | 126 | **173** | 235 |

### 7.3 Contribution breakdown (expected case)

| Source | Added RANKED (approx.) |
|---|---:|
| U19 Boys P12 → RANKED (175 × 75% × net) | **+95** |
| U19 Boys P7 near-threshold | **+35** |
| U19 Girls P12 + P7 | **+32** |
| U16 Boys combined | **+21** |
| U13 Boys | **+8** |
| **Gross adds** | **~191** |
| Less: P2/P3 surfaced on DOB entry | **-15** |
| Less: rank churn / double-count guard | **-73** |
| **Net vs 66 baseline** | **~107 → ~173** |

*Conservative and optimistic bands reflect DOB campaign completion rate (50% vs 90%) and import velocity.*

### 7.4 Milestone timeline

| Week | Milestone | U19 Boys | U19 Girls |
|---:|---|---:|---:|
| 2 | D0 Girls DOB 80% complete | 59 | **15–20** |
| 4 | D1 Boys P12 50% complete | **85** | 25 |
| 8 | Near-threshold P7 sprint | **100** | 30 |
| 12 | Full T0–T2 tiers | **105** | **32** |

---

## 8. Success Metrics

### 8.1 Primary KPIs

| KPI | Baseline | 30-day | 60-day | 90-day |
|---|---:|---:|---:|---:|
| U19 Boys RANKED `boardSize` | 59 | 75 | 95 | 105 |
| U19 Girls RANKED `boardSize` | 0 | 15 | 25 | 32 |
| U16 Boys RANKED | 7 | 15 | 22 | 28 |
| Global P12 count | 349 | 250 | 150 | 80 |
| Global P7 count | 460 | 420 | 380 | 340 |
| P12 cohort DOB completion % | ~0% targeted | 40% | 70% | 85% |

### 8.2 Quality KPIs

| KPI | Target |
|---|---|
| DOB entry error rate (→ P3) | <5% of new DOBs |
| `classYearOverride` rate among RANKED | <3% |
| RANKED with `effectiveClassYear` | ≥95% (AG-4) |
| Profile-board rank match (INV-01) | 100% sample pass |
| Support tickets "missing from board" | Trend down post-campaign |

### 8.3 Operational KPIs

| KPI | Target |
|---|---|
| Programs with ≥80% roster DOB | ≥5 programs in 60 days |
| P12 worklist closure rate | ≥20 players/week |
| Verified games added (net new) | Track per import batch |
| Near-threshold players cleared (U19 Boys) | ≥10/week in sprint |

### 8.4 Anti-metrics (do not optimize)

| Anti-metric | Why |
|---|---|
| Total `Player` DOB % without P12 filter | Dilutes signal |
| Raw `PlayerRating` pool size | Includes off-board |
| Estimated/fabricated DOBs | Creates P3 integrity risk |
| Lowering threshold | Out of scope |

---

## 9. Validation Framework

### 9.1 Read-only audits (re-run after each phase)

| Audit | Script (existing/planned) | Frequency |
|---|---|---|
| Verdict distribution | `verdict-distribution` read-only | Bi-weekly |
| AG-4 baseline | `capture-ag4-g1-baseline.ts` | After material change |
| P12 worklist export | Planned read-only export | Weekly |
| DOB vs override consistency | Sample 20/week | Weekly |

### 9.2 Phase gates

| Gate | Criteria | Before |
|---|---|---|
| **V-DR-1** | P12 count reduced ≥20% from baseline | Phase 2 |
| **V-DR-2** | U19 Girls RANKED ≥15 | Girls G-2 |
| **V-DR-3** | U19 Boys RANKED ≥85 | AG-4 prod flag discussion |
| **V-DR-4** | No increase in P3 from bad DOB | Ongoing |
| **V-DR-5** | INV-01 profile-board rank parity | Each release |

### 9.3 Manual QA samples

| # | Check |
|---|---|
| Q-DR-1 | Random 10 new DOB entries → verdict moves P12 → RANKED or expected P2/P3 |
| Q-DR-2 | Random 10 near-threshold → game import → P7 → RANKED |
| Q-DR-3 | Girls board non-empty after G-1 |
| Q-DR-4 | FORMER count stable or explainable (June rollover) |
| Q-DR-5 | AG-4 class buckets regenerate correctly after growth |

### 9.4 Rating recompute policy

| Event | Action |
|---|---|
| DOB entry only | **No recompute required** — verdict changes at read time |
| New verified games imported | GPS + `PlayerRating` recompute — **requires approval** |
| Snapshot publish | **Requires approval** — not part of remediation MVP |

Remediation phases 1–2 (DOB only) are **low risk** — board size changes on next page load without touching `PlayerRating`.

---

## 10. Rollout Sequence

### 10.1 Master timeline

```
Week 1–2   T0 Girls DOB blitz (D0)
Week 2–4   T1 U19 Boys P12 (D1) — parallel program outreach
Week 4–6   T2 U19 Boys near-threshold imports (P7 ≤4 short)
Week 6–8   T3 U16 Boys DOB + games
Week 8–12  T2 completion + U16 near-threshold
Week 12+   U13 long-horizon + sustain
```

### 10.2 Rollout waves

| Wave | Name | Tier | Owner | Exit criteria |
|---|---|---|---|---|
| **W1** | Girls Unlock | T0 | Data ops + programs | U19 Girls RANKED ≥15 |
| **W2** | Boys DOB Surge | T1 | Data ops | P12 U19 Boys −50% |
| **W3** | Boys Games Sprint | T2 | Import ops | +35 U19 Boys RANKED from P7 |
| **W4** | U16 Foundation | T3 | Import + data ops | U16 Boys RANKED ≥25 |
| **W5** | Validate & baseline | All | Rankings architect | Re-capture §11.1 artifacts |
| **W6** | AG-3 / AG-4 unblock | — | Product | Boards meet soft gates |

### 10.3 Communication plan

| Audience | Message |
|---|---|
| Coaches | "Roster birth dates required for national ranking visibility" |
| Public users | No change until board grows organically |
| Admins | P12 worklists by program; binding-constraint rule |
| Product | Girls board empty is data, not filter bug |

### 10.4 Rollback

Remediation rollback is **player-field revert** only:

- Remove incorrect DOB → player returns to P12.
- No snapshot or historical game rollback required.
- Document corrections in admin audit trail (existing).

---

## Impact Assessment

### Ranking impact

| Area | Effect |
|---|---|
| `PlayerRating` values | **Unchanged** by DOB-only remediation |
| Rank order | **May shift** when new players enter RANKED pool — natural |
| Formula v1 | **No change** |
| `evaluateEligibility` verdicts | **Change at read time** when DOB/games improve |
| Cross-age boards | Independent per `ageGroup` |
| June rollover | P2 exclusions increase — plan seasonal comms |

### Snapshot impact

| Area | Effect |
|---|---|
| Published `RankingSnapshot` rows | **Immutable** — historical snapshots unchanged |
| Live board | **Grows** as verdicts improve — no snapshot required |
| Snapshot publish scripts | Run only when approved; not required for DOB remediation |
| Row counts at next publish | Will reflect larger RANKED pool if recomputes run |

### Migration impact

| Area | Effect |
|---|---|
| Schema | **None** |
| New fields | **None** |
| Config | **None** |
| Feature flags | **None** |

### Historical-data impact

| Area | Effect |
|---|---|
| `Game` / `GameStat` | **Append-only** new verified evidence; no rewrites |
| `Player.birthDate` | **Metadata update** — does not alter past stat lines |
| `classYearOverride` | Admin edits only; audit 12 existing |
| Identity merges | Follow existing merge protocols — do not bulk-merge for board growth |
| Graduated players (P2) | **No restoration** — historical integrity preserved |

---

## Approval Requirements

| Action | Approval needed |
|---|---|
| DOB entry via admin | Standard admin workflow |
| P12 worklist export (read-only) | Inform data integrity lead |
| New game imports | Existing import approval |
| `PlayerRating` recompute after imports | **Explicit approval** |
| Ranking snapshot publish | **Explicit approval** |
| WS-1 / threshold change | **Out of scope — not requested** |

---

## Summary Recommendation

| Question | Answer |
|---|---|
| Can board grow without WS-1 changes? | **Yes** — 349 P12 + 460 P7 addressable |
| Highest ROI action? | **U19 Girls DOB (45 players)** |
| Largest absolute gain? | **U19 Boys P12 (175 players)** |
| Fastest game win? | **118 U19 Boys within 1–4 games of threshold** |
| What not to pursue? | P2 graduated (49), fabricated DOBs, threshold cuts |
| AG-4 blocked? | **No** for Boys; **Yes** for Girls until W1 completes |

---

*End of Data Remediation Strategy v1.0*
