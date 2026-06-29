# Team Fragmentation Audit Plan

**Status:** Implementation-ready planning specification  
**Version:** 1.1  
**Effective:** 2026-06-16  
**Last reviewed:** 2026-06-17 (TR-0 gate — partial progress only)  
**Authority:** Subordinate to `docs/PROJECT_STATUS.md`, domain architecture (Program / Team / League / Season), data-safety rules  
**Scope:** Read-only audit planning — no code, migrations, merges, imports, repairs, or execution without explicit approval

---

## Document Control

### Trigger

The public **Team Rankings** page (`/teams`) shows repeated display names across competitions, including:

- BBC 17u
- Charm
- Gold Cross
- Chatime
- Torch 17u
- Amsteel

The audit must determine whether repetition indicates **data fragmentation** (duplicate identities) or **intentional competition-scoped presentation**.

### Five investigation questions

| # | Question |
|---|---|
| Q1 | Are **Team** records duplicated for the same real-world program? |
| Q2 | Are **Program** records duplicated for the same school/club identity? |
| Q3 | Is **team–season participation** modeled correctly (no missing `TeamSeason` entity)? |
| Q4 | Is the **rankings UI** intentionally competition-scoped? |
| Q5 | Are **imports** creating fragmented team identities? |

### Related artifacts

| Artifact | Role |
|---|---|
| `prisma/schema.prisma` | `Program`, `Team`, `Season`, `League`, `PlayerTeamSeason`, `TeamExternalAlias` |
| `src/lib/team-rankings.ts` | Public standings bucketing (`getDynamicTeamStandings`) |
| `src/app/teams/TeamsClient.tsx` | Client filters; league = All shows cross-competition rows |
| `src/lib/team-import-matching.ts` | Import resolution tiers T0–T6 |
| `src/lib/submission-official-import.ts` | Program + Team create/link on import |
| `docs/PROJECT_STATUS.md` | PYBC identity repair history (8 programs, 37 games, grouping fix) |
| `docs/planning/audits/IDENTITY_INTEGRITY_SWEEP.md` | 2026-06-17 read-only sweep — UAAP TD-01 merge queue |
| `docs/planning/audits/TEAM_RANKINGS_TR0_TR1_READINESS.md` | TR-0/TR-1 readiness assessment + recommendation B |

### Audit progress (2026-06-17)

| Phase | Status | Notes |
|---|---|---|
| **TF-0** | Not started | Reproduction matrix for 6 club names pending |
| **TF-1** | **Done in code review** | `team-rankings.ts` bucketing + `TeamsClient` `visibleRank` confirmed |
| **TF-2** | Not started | SQL inventory for suspect names |
| **TF-3–TF-6** | Not started | — |
| **Identity sweep** | Partial | Safe cleanup (52 programs, 64 teams); **8 UAAP TD-01 pairs remain** |
| **TF-E01–E07** | **0 / 7 met** | TR-0 **not passed** |

---

## Executive Summary

Peach Basket’s identity model separates **Program** (school/club) from **Team** (competition moniker record) from **League/Season** (competition context). There is **no `TeamSeason` table**; participation is evidenced by `Game` (`homeTeamId` / `awayTeamId` + `seasonId`) and roster by `PlayerTeamSeason`.

Public team standings **intentionally emit one row per competition scope**:

```
bucket key = leagueId : seasonId : gender : identityKey
```

- **PYBC:** `identityKey = programId ?? teamId` (program-level consolidation — post-repair)
- **Non-PYBC:** `identityKey = teamId` only (no cross-team consolidation)

Therefore, seeing **BBC 17u** or **Charm** multiple times with **different League column values** when League filter = **All** is often **expected behavior**, not a bug.

Repetition is a **fragmentation defect** only when:

1. The **same** `leagueId + seasonId + gender` scope contains **multiple rows** with the same normalized display name, or  
2. Multiple active **Team** records share the same **Program** (or should share one Program) within one competition scope, or  
3. **Game** / **GameStat** evidence is split across duplicate Team IDs that should be one canonical Team.

**Recommended audit sequence:** UI reproduction → scope classification → DB duplicate detection → import lineage → remediation tier selection.

---

## 1. Audit Methodology

### 1.1 Phases

| Phase | Name | Owner | Output |
|---|---|---|---|
| **TF-0** | Scope & reproduction | Product + engineering | Screenshot matrix: filter state vs visible duplicates |
| **TF-1** | UI semantics baseline | Engineering | Confirmed: competition-scoped vs accidental duplicate |
| **TF-2** | Read-only DB inventory | Data integrity | Team/Program/Game counts per suspect name |
| **TF-3** | Duplicate classification | Data integrity + rankings architect | Per-name verdict: Expected / Fragmentation / Ambiguous |
| **TF-4** | Import lineage trace | Data integrity | Submission → Program → Team → Game chain |
| **TF-5** | Impact assessment | Rankings architect | Player vs team ranking impact memo |
| **TF-6** | Remediation recommendation | Product owner approval gate | Tiered repair plan (no execution in this doc) |

### 1.2 Evidence collection rules

| Rule | Detail |
|---|---|
| **Read-only default** | SELECT queries, admin UI inspection, existing report scripts in dry-run mode only |
| **No writes** | No merge, soft-delete, `programId` reassignment, or import without explicit approval per data-safety rules |
| **Stable counts** | Record findings against `PROJECT_STATUS.md` baseline; note if dataset has grown beyond stable UAAP/PYBC counts |
| **Active records only** | Filter `deletedAt IS NULL` on Team, Program, League, Season, Game, GameStat unless auditing historical suffix teams |
| **Name normalization** | Use same keys as production: `getTeamDisplayName`, `normalizeProgramAlias`, `normalizeCompetitionDisplayName` |

### 1.3 Reproduction matrix (TF-0)

For each suspect name (BBC 17u, Charm, Gold Cross, Chatime, Torch 17u, Amsteel), capture:

| Filter state | Capture |
|---|---|
| Age group: U13 / U16 / U19 | Row count per name |
| Gender: Boys / Girls | Row count per name |
| League: **All** | Full row list with League + Season columns |
| League: **each specific league** | Whether duplicates collapse to one row |
| Min games = 1 | Baseline |
| Search query = exact name | All matching rows |

**Classification per row:**

| Class | Definition |
|---|---|
| **A — Expected multi-competition** | Same `displayName`, different `leagueId` or `seasonId`; one row per scope when league filter = All |
| **B — Same-scope fragmentation** | Same `displayName`, same `leagueId + seasonId + gender`; multiple `teamId` or bucket `id` |
| **C — Program split** | Same normalized program identity, multiple `programId`, multiple Teams in one scope |
| **D — Display alias only** | Same `teamId`, different `internalTeamName` vs `displayName` (cosmetic) |
| **E — Archived ghost** | `deletedAt` not null but still visible (bug — should not occur) |

### 1.4 Audit sign-off

| Role | Responsibility |
|---|---|
| Data integrity lead | TF-2–TF-4 execution, duplicate verdicts |
| Engineering lead | TF-1 UI semantics, query harness |
| Rankings architect | TF-5 impact, remediation architecture |
| Product owner | Accept Expected (A) vs require remediation (B/C) |

---

## 2. Duplicate Detection Rules

### 2.1 Normalization keys

| Key | Function / rule | Use |
|---|---|---|
| **Display key** | `normalizeProgramAlias(getTeamDisplayName(team.name))` | Public-facing duplicate grouping |
| **Program key** | `programKeyFromName` / `resolveProgramIdentity` | School/club identity |
| **Competition scope** | `leagueId : seasonId : ageGroup : gender` | Standings bucket boundary |
| **Standings bucket id** | As computed in `getDynamicTeamStandings` | Match public `row.id` |
| **External alias key** | `provider + normalizedExternalLabel` | Import matching audit |

### 2.2 Team duplicate rules

| Rule ID | Condition | Verdict | Severity |
|---|---|---|---|
| **TD-01** | Two+ active Teams, same `programId`, same competition scope, both with active Games | **Fragmentation** | High |
| **TD-02** | Two+ active Teams, same display key, same competition scope, different `programId` | **Fragmentation or wrong Program link** | High |
| **TD-03** | Two+ active Teams, same display key, **different** competition scope | **Expected (A)** unless product wants program-level rollup | Low |
| **TD-04** | Team with `programId IS NULL` in active competition with Games | **Link gap** | Medium |
| **TD-05** | Suffix/internal name pattern (`U16 Boys`, numeric suffix, archived PYBC pattern) with active Games | **Legacy fragmentation** | High |
| **TD-06** | `TeamExternalAlias` points to Team A; Games on Team B for same external label | **Import alias drift** | High |
| **TD-07** | Zero active Games but non-zero historical GameStats/Games on duplicate Team | **Cleanup candidate** | Low (archive) |

### 2.3 Program duplicate rules

| Rule ID | Condition | Verdict | Severity |
|---|---|---|---|
| **PD-01** | Two+ active Programs, same normalized `fullName` (or alias overlap) | **Program duplication** | High |
| **PD-02** | One Program, multiple active Teams, each with Games in **same** season | **Expected for UAAP** (one team per season moniker) / **Review for club** | Context-dependent |
| **PD-03** | PYBC-style: league is competition context; each participant should be **one Program + one canonical Team** | **PD-03 violation = fragmentation** | High (PYBC precedent) |
| **PD-04** | Program `fullName` equals league name (e.g. `PYBC 15U` as Program) | **Model violation** | High |

### 2.4 PlayerTeamSeason / participation rules

There is **no `TeamSeason` model**. Validate participation indirectly:

| Rule ID | Check | Pass criterion |
|---|---|---|
| **PTS-01** | `PlayerTeamSeason` uniqueness `[playerId, seasonId]` | No duplicate active rows per player per season |
| **PTS-02** | Roster `teamId` vs Game `GameStat.teamId` for same player/season | Consistent team reference |
| **PTS-03** | Player with Games in season but no `PlayerTeamSeason` | Document gap (may be import lag) |
| **PTS-04** | Same player, same season, multiple `teamId` in GameStats | **Roster/history integrity issue** |
| **PTS-05** | `TeamRating` `[teamId, seasonId]` | At most one per team per season (schema enforced) |

### 2.5 Standings-specific rules (mirror `team-rankings.ts`)

| Rule ID | Check | Expected |
|---|---|---|
| **ST-01** | PYBC games bucket to `competition:pybc-15u` synthetic scope | 8 teams, 37 games (per PROJECT_STATUS) |
| **ST-02** | Non-PYBC bucket uses `teamId` as identityKey | One row per Team per league/season/gender |
| **ST-03** | Same `programId`, non-PYBC, two Teams in same scope | **Two public rows** — may be correct or fragmentation (classify via TD-01) |
| **ST-04** | `TeamsClient` with League = All | Multiple rows per display name allowed (class A) |
| **ST-05** | `TeamsClient` re-ranks filtered subset (`visibleRank`) | Rank # is **view-local**, not global competition rank |

### 2.6 Suspect name seed queries (planning — read-only)

Run after TF-0 reproduction. For each name `N`:

1. List active Teams where `name` or `program.fullName` ILIKE `%N%`.
2. Group by `programId`, count active Games per Team.
3. Group by `leagueId + seasonId`, count Teams per display key.
4. List `TeamExternalAlias` rows normalizing to `N`.
5. List submissions that first created each Team (admin submission audit if available).

---

## 3. Program / Team / Participation Validation Checks

### 3.1 Entity responsibility (domain model)

| Entity | Role | Fragmentation symptom |
|---|---|---|
| **Program** | School/club identity | Duplicate Programs for one club |
| **Team** | Competition team record (moniker); optional `programId` | Duplicate Teams per program per scope |
| **League** | Competition product (e.g. PYBC 15U, UAAP) | Duplicate League name variants (PYBC precedent — normalized in UI) |
| **Season** | Time slice within league | Duplicate seasons splitting games |
| **PlayerTeamSeason** | Roster assignment | Wrong `teamId` for season |
| **Game / GameStat** | Historical evidence | Split across duplicate Team IDs |

### 3.2 “TeamSeason” clarification

**There is no `TeamSeason` table.** The audit replaces “TeamSeason modeling” with:

| Concept | Implementation | Validation |
|---|---|---|
| Team participated in season | ∃ Game where (`homeTeamId` or `awayTeamId`) = Team AND `seasonId` | Game count per team per season |
| Team roster in season | `PlayerTeamSeason` rows | Roster vs stats cross-check |
| Team rating in season | `TeamRating` optional | Not used for public `/teams` standings today |

**Correct modeling question:** Is participation correctly **derivable** from Game + PlayerTeamSeason without a dedicated TeamSeason entity? **Yes by design** — audit validates consistency, not missing table.

### 3.3 PYBC reference standard (known-good)

Per `PROJECT_STATUS.md` (post-repair):

| Metric | Expected |
|---|---:|
| PYBC participant Programs | 8 |
| PYBC grouped standings rows | 8 |
| PYBC active games | 37 |
| League context | `PYBC 15U` is **League**, not Program |
| Grouping key | `programId` when PYBC |

Use PYBC as **regression anchor** when auditing new competitions (e.g. club circuits with BBC/Torch names).

### 3.4 Club / travel team pattern (likely for suspect names)

Names like **BBC 17u**, **Torch 17u** suggest **Club / Team** program type (`importProgramIdentity` PYBC path and club imports):

| Check | Expected if healthy |
|---|---|
| One Program per club brand | `programFullName` ≈ display name |
| One canonical Team per Program per active import generation | Single active Team with Games |
| Re-import same club | Reuses Team via `TeamExternalAlias` or program-scoped match |
| Cross-tournament | **New League/Season** → **new standings row** (class A), same Program |

### 3.5 Admin cross-check

`/admin/teams` already flags `needsCleanup` when multiple Team IDs share the same `publicSchoolName` + competition context (`sameContextDuplicateTeamIds`). Audit should:

1. Export all teams with `needsCleanup = true`.
2. Intersect with suspect name list.
3. Verify admin flag correlates with TD-01/TD-02.

---

## 4. Ranking Impact Assessment

### 4.1 Player rankings (U13/U16/U19)

| Area | Impact |
|---|---|
| `PlayerRating` | **None from team fragmentation directly** — keyed by `playerId + ageGroup` |
| `GameStat` / GPS | **Indirect** — if duplicate Teams split stats, player game counts could be correct per player but team attribution wrong |
| Public player board | **Low** if GameStats are on correct `playerId`; team name on profile comes from roster/Games |
| Merge / identity (G3) | Duplicate **players** orthogonal; duplicate **teams** affect team pages and team standings only |

### 4.2 Team rankings (`/teams`)

| Scenario | Impact |
|---|---|
| Class A (multi-competition rows) | **By design** — W/L records differ per competition |
| Class B (same-scope duplicates) | **Corrupt** — wins/losses split across rows; both appear weaker |
| PYBC-style fix applied to new league | Would **consolidate** rows — changes public W/L presentation (product decision) |
| `visibleRank` re-numbering on filter | User sees rank 1..N within filter — **not** comparable across league scopes |

### 4.3 Team profile (`/teams/[teamId]`)

| Area | Impact |
|---|---|
| Route uses `teamId` | Fragmentation sends users to **different profiles** for same club |
| Games list | Incomplete if Games attach to suffix Team |
| Program display | Wrong if `programId` null or incorrect |

### 4.4 Homepage / leagues directory

| Surface | Impact |
|---|---|
| `getHomeData` team preview | Picks top teams by games played — duplicates may **crowd out** diversity |
| League directory | Shows competitions, not programs — low impact |

### 4.5 Formula / snapshots

| Area | Impact |
|---|---|
| `RankingSnapshot` (player) | **No impact** |
| `TeamRating` | Per `teamId + seasonId` — duplicate teams → duplicate ratings if computed |
| Future team-level national rankings | Fragmentation would **block** credible aggregation |

---

## 5. Migration Impact Assessment

### 5.1 Schema migrations

| Assessment | Detail |
|---|---|
| **Required for audit?** | **No** |
| **Required for remediation?** | **Unlikely** — existing `programId`, `TeamExternalAlias`, soft-delete sufficient |
| **Hypothetical `TeamSeason` table** | **Not recommended** — participation derivable from Game; adds migration risk |

### 5.2 Data migration patterns (if remediation approved)

| Pattern | Tables touched | Complexity |
|---|---|---|
| **Program merge** | `Program` (one canonical), `Team.programId` updates | Medium |
| **Team merge (reassign)** | `Game.homeTeamId/awayTeamId`, `GameStat.teamId`, `PlayerTeamSeason.teamId` | High — same pattern as PYBC repair |
| **Alias-only fix** | `TeamExternalAlias` | Low |
| **Soft-archive suffix Team** | `Team.deletedAt` | Low if zero active Games |
| **League/season normalization** | `League.name`, synthetic scope keys | Medium — PYBC precedent |

### 5.3 Application migration

| Area | Change if remediation |
|---|---|
| `team-rankings.ts` | Optional: extend program-level grouping beyond PYBC to named leagues |
| `team-import-matching.ts` | Tighten T1–T3 program-scoped reuse |
| Admin UI | Cleanup workflows already exist |

### 5.4 Gate alignment

| Gate | Interaction |
|---|---|
| G3 player merges | **Independent** — do not mix player merge with team repair |
| G4 player recompute | **No team rating recompute required** for team identity repair |
| WS-4 | Team repair is **separate governance** — require per-batch approval like PYBC repairs |

---

## 6. Historical Data Impact Assessment

### 6.1 Principles (locked)

| Principle | Rule |
|---|---|
| **INV-GAME** | Do not rewrite `Game` scores or dates |
| **Reassignment-only** | Team repair **reassigns** `teamId` / `programId` pointers — same as PYBC repair precedent |
| **Immutable snapshots** | Published `RankingSnapshot` rows unchanged |
| **Audit trail** | Every repair batch: before/after JSON, game counts, team counts |

### 6.2 Historical impact by remediation tier

| Tier | Historical impact |
|---|---|
| **T0 — No action (class A)** | None |
| **T1 — Alias + import guardrail** | Prospective only |
| **T2 — `programId` link fix** | None on GameStat values; changes program attribution |
| **T3 — Team reassignment merge** | Game/GameStat rows point to canonical Team; **counts preserved** |
| **T4 — Program merge** | Program history pointers updated; audit required |
| **T5 — Soft-archive duplicate Team** | Historical Games remain on canonical Team; archived Team hidden |

### 6.3 Player historical integrity

| Concern | Assessment |
|---|---|
| Player game log | Team **name** on old games may reflect pre-merge moniker — acceptable |
| `PlayerTeamSeason` | Reassignment may be needed if roster pointed to suffix Team |
| League history on profile | May show fewer duplicate competition rows after normalization — **positive** |

---

## 7. Remediation Options

### 7.1 Decision tree

```
Repeated name on /teams (League = All)
├── Different League column per row
│   └── Class A: Expected competition-scoped UI
│       ├── Product accepts → T0 (document in UI copy)
│       └── Product wants single club row → T6 (UX rollup — new feature)
├── Same League + Season, multiple rows
│   ├── Same programId → T3 Team reassignment merge
│   ├── Different programId, same display key → T4 Program merge + T3
│   └── Import alias drift → T1 alias fix + import matcher tighten
└── Suffix / internal Team with 0 active games
    └── T5 soft-archive (zero-reference dry-run first)
```

### 7.2 Remediation tiers

| Tier | Name | Actions | Approval |
|---|---|---|---|
| **T0** | Accept + document | UI helper: "Teams may appear once per competition"; default League filter | Product |
| **T1** | Import guardrails | Add/fix `TeamExternalAlias`; preflight manual_review for ambiguous club names | Engineering |
| **T2** | Program link repair | Set `Team.programId` only (admin checkbox flow exists) | Data integrity |
| **T3** | Team canonicalization | Reassign Games/GameStats/PTS to canonical Team per scope (PYBC repair pattern) | Data integrity + product |
| **T4** | Program merge | Merge duplicate Programs; update Team links | Data integrity + product |
| **T5** | Archive suffix Teams | `deletedAt` on zero-active Teams | Data integrity |
| **T6** | UX program-level rollup (non-PYBC) | Extend `identityKey` logic in `team-rankings.ts` beyond PYBC | Product + engineering — **feature change** |

### 7.3 UI-only options (no DB writes)

| Option | Description |
|---|---|
| **Default league filter** | Default to most recent league instead of All — reduces perceived duplication |
| **Group by Program toggle** | Collapse rows sharing `programId` with combined record (read-time) |
| **Show competition subtitle** | Emphasize League column when League = All (already partially present) |
| **Disable view-local re-rank** | Show server `rank` per scope instead of `visibleRank` when filtered |

### 7.4 Per-suspect-name playbook (template)

| Name | TF-0 class | Likely root cause | Recommended tier |
|---|---|---|---|
| BBC 17u | **Pending TF-0** | Club import; likely class A + possible TD-02 | T1–T3 after TF-2 |
| Charm | **Pending TF-0** | Same | T1–T3 after TF-2 |
| Gold Cross | **Pending TF-0** | Same | T1–T3 after TF-2 |
| Chatime | **Pending TF-0** | Same | T1–T3 after TF-2 |
| Torch 17u | **Pending TF-0** | Age suffix in name; alias variant risk | T1–T3 after TF-2 |
| Amsteel | **Pending TF-0** | Same | T1–T3 after TF-2 |
| **UAAP schools (×8)** | **TD-01 confirmed** | Same `programId`, duplicate Teams, 300+ GameStats each | **T3 merge** — blocks TR-1 ([sweep](./audits/IDENTITY_INTEGRITY_SWEEP.md)) |

*Club names: fill class A–E after TF-2. UAAP: fragmentation confirmed — remediation requires explicit approval.*

### 7.5 Explicit non-options

| Action | Why avoided |
|---|---|
| Hard-delete Teams | FK constraints; soft-delete only |
| Rewrite Game scores | Violates historical integrity |
| Player merges for team dedup | Wrong entity |
| Automatic repair on audit | Requires explicit approval per data-safety rules |

---

## 8. Validation Framework

### 8.1 Audit exit criteria

| ID | Criterion | Evidence |
|---|---|---|
| **TF-E01** | Reproduction matrix complete for all 6 names | Screenshot + row export |
| **TF-E02** | Each name classified A–E | Classification table |
| **TF-E03** | TD/PD/PTS rules run for High severity hits | Query output |
| **TF-E04** | PYBC regression unchanged (8 teams, 37 games) | Standings count |
| **TF-E05** | Import lineage for each fragmented Team (if any) | Submission ids |
| **TF-E06** | Impact memo signed | TF-5 deliverable |
| **TF-E07** | Remediation tier approved per name | Product sign-off |

### 8.2 Post-remediation validation (if repair executed later)

| Check | Expected |
|---|---|
| Same-scope duplicate count | 0 for repaired names |
| Game count per competition | Unchanged vs pre-repair audit |
| `/teams` row count per league scope | Matches unique canonical teams |
| `/admin/teams` `needsCleanup` | false for repaired groups |
| Player profiles | Game logs intact; team names sensible |
| `npx tsc --noEmit` | Pass (if code changed) |

---

## 9. Work Breakdown (Audit Only)

| ID | Task | Est. | Owner |
|---|---|---|---|
| TF-0 | Reproduction matrix | 0.5 d | QA / product |
| TF-1 | Document UI bucketing + `visibleRank` behavior | 0.5 d | Engineering |
| TF-2 | Read-only SQL inventory (6 names + admin flags) | 1 d | Data integrity |
| TF-3 | Classify A–E + TD/PD rules | 1 d | Data integrity |
| TF-4 | Import lineage trace | 1 d | Data integrity |
| TF-5 | Impact memos (§4–§6) | 0.5 d | Rankings architect |
| TF-6 | Remediation recommendation + sign-off | 0.5 d | Product |

**Total:** ~5 days read-only audit.

---

## 10. Risk Register

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| **TF-R01** | Misclassify expected multi-competition as bug | Medium | TF-0 league-scoped filter test |
| **TF-R02** | Repair splits Game evidence | High | Reassignment-only pattern; dry-run counts |
| **TF-R03** | Extend PYBC grouping to all leagues without product approval | Medium | T6 separate from identity repair |
| **TF-R04** | Audit on stale DB vs production | Low | Record audit timestamp + counts |
| **TF-R05** | `visibleRank` confuses stakeholders during demo | Low | TF-1 document view-local ranks |
| **TF-R06** | New imports recreate duplicates | High | T1 alias + matcher before T3 |
| **TF-R07** | Stable PROJECT_STATUS counts outdated | Medium | Refresh counts at audit start |

---

## 11. Preliminary Hypotheses (to validate, not conclusions)

| Hypothesis | Validates Q# | Likelihood |
|---|---|---|
| Repeated names with League = **All** are **competition-scoped rows** (class A) | Q4 | **High** |
| Club circuit imports created **one Program + Team per tournament** without cross-competition alias | Q1, Q2, Q5 | Medium |
| Non-PYBC leagues do **not** consolidate by `programId` in `team-rankings.ts` | Q4 | **Confirmed in code** |
| No `TeamSeason` gap — participation via Game is intentional | Q3 | **Confirmed in schema** |
| Same-scope duplicates may exist for names **not** covered by PYBC repair | Q1 | Medium — requires TF-2 |

---

## Approval

| Role | Audit plan approved | Remediation execution |
|---|---|---|
| Data integrity lead | [ ] | Separate approval per tier |
| Engineering lead | [ ] | — |
| Product owner | [ ] | Required for T3+ |
| Rankings architect | [ ] | Consulted |

**This document authorizes read-only audit only.** T1–T6 remediation requires separate explicit approval.

---

*End of Team Fragmentation Audit Plan v1.1*
