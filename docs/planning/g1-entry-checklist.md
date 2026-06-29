# G1 Entry Checklist

**Authority:** `docs/RANKINGS_ENGINE_PHASE0_PLAN.md` §7.2  
**Gate:** G1 entry (prepared at G0; implemented in Phase A)  
**Owner:** Rankings architect  
**Prerequisite:** G0 closed (Approve or scoped Conditional)

---

## G1 Entry Criteria (G1-R01 – G1-R05)

| ID | Criterion | Evidence required | Status | Evidence path | Owner |
|---|---|---|---|---|---|
| **G1-R01** | Eligibility duplication map complete; consolidation scope agreed | Map of all threshold sites; agreed removal/replacement plan for G1 | [ ] Ready [ ] Not ready | `docs/planning/eligibility-duplication-map.md` | Rankings architect |
| **G1-R02** | WS-1 verdict payload schema draft aligned with ADR-002–004, ADR-013 | Payload field list matches baseline §WS-1 canonical fields | [ ] Ready [ ] Not ready | `docs/planning/g1-readiness-brief.md` §Payload | Rankings architect |
| **G1-R03** | Verdict hierarchy P1–P15 test matrix skeleton ready | Test matrix with precedence cases outlined | [ ] Ready [ ] Not ready | `docs/planning/test-strategy-outline.md` §G1 | Rankings architect |
| **G1-R04** | No compute/write path changes scheduled during G1 | G1 scope statement excludes GPS/PlayerRating writes, merges, migrations | [ ] Ready [ ] Not ready | G1 kickoff brief §Scope | Engineering lead |
| **G1-R05** | Public display paths documented for verdict rollout impact analysis | Route-to-service map with display impact notes | [ ] Ready [ ] Not ready | `docs/planning/r-read-inventory.md` §Display impact | Engineering lead |

---

## G1-R01 Consolidation Scope (pre-agreed targets)

Phase 0 identified duplicate threshold logic at:

| Site | Location | Current behavior | G1 target |
|---|---|---|---|
| Board minimum games | `src/lib/public-board-ranks.ts` `publicBoardMinimumGames` | Boys 10, Girls 5 hardcoded | Consume WS-1 verdict / policy-versioned threshold |
| Leaderboard minimum | `src/lib/players.ts` `leaderboardMinimumGamesForGender` | Same values duplicated | Remove; delegate to WS-1 |
| Class year / age bracket | `src/lib/ranking-eligibility.ts` | Partial rules | Integrate into verdict engine inputs |
| Unknown DOB | Eligibility reads | Temporary rank-eligible | Map to `competitionTrustLevel` per ADR-003 |
| Age override | `Player.ageGroupOverride` | Display + bracket filter | ADR-004 PROVISIONAL path in verdict |

**INV-04 exit criterion:** No standalone threshold constants remain in display or API paths after G1 close.

---

## G1-R02 Verdict Payload Alignment

Minimum fields per baseline §WS-1 (must match ADR-013 row subset):

| Field | ADR alignment | Included in draft |
|---|---|---|
| `verdict` | RANKED / PROVISIONAL / HIDDEN / FORMER | [ ] |
| `provisionalReason` / `exclusionReason` | Separate fields | [ ] |
| `ratingAgeGroup`, `evaluatedBoard`, `evaluationDate` | Board context | [ ] |
| `snapshotEligible`, `formulaVersionId`, `policyVersionId` | Snapshot provenance | [ ] |
| `competitionAgeGroup`, `competitionTrustLevel`, `classYearStatus` | ADR-002–004 | [ ] |
| `gamesQualified`, `verifiedGameCount` | Threshold inputs | [ ] |

---

## G1-R03 Test Matrix Skeleton

| Precedence band | Sample cases (skeleton) | Fixture needed |
|---|---|---|
| P1–P5 | Class year exclusion (June 1) | FORMER player |
| P6–P10 | Game threshold (Boys/Girls) | Below/at threshold |
| P11–P13 | Unknown DOB + trust | Missing birthDate |
| P14–P15 | Age override cross-bracket | PROVISIONAL path |

Full matrix expansion occurs during G1 implementation; skeleton must exist at G1 entry.

---

## G1-R04 Prohibited During G1

Confirm none scheduled:

| Action | Blocked |
|---|---|
| Schema migrations | Yes — until G6 |
| PlayerRating / GPS writes (beyond existing incremental v1) | Yes — unless explicit approval |
| Player merges | Yes — until G3 |
| Universe recompute | Yes — until G4 |
| Snapshot publish workflow changes | Yes — until G2 |
| Formula v2 writes | Yes — until G6 + G7 |

---

## G1-R05 Display Impact Paths

| Route / surface | Service path | Verdict rollout impact |
|---|---|---|
| `/rankings` | `getLatestNationalRankings` → `getPublicBoardRows` | Board row filtering → verdict-driven |
| `/rankings/[gender]/[age]` | Same | Age bracket evaluation → WS-1 |
| `/players/[slug]` | `getCurrentPublicBoardRankForPlayer` | Rank display band → verdict |
| Public search | `public-search.ts` | Eligibility in search results |
| Players list / API | `players.ts` `getEligibleRankings` | Threshold consolidation |
| Homepage highlights | `public-site-data.ts` | Board helpers |

---

## G1 Kickoff Readiness Summary

| ID | Ready | Not ready |
|---|---|---|
| G1-R01 | [ ] | [ ] |
| G1-R02 | [ ] | [ ] |
| G1-R03 | [ ] | [ ] |
| G1-R04 | [ ] | [ ] |
| G1-R05 | [ ] | [ ] |

**G1 entry authorized:** [ ] Yes [ ] No — pending: _______________

---

## Sign-Off (at G1 kickoff, after G0 close)

| Role | Name | Date | Signature / approval ID |
|---|---|---|---|
| Rankings architect | | | |
| Engineering lead | | | |
| Product owner (optional consult) | | | |

---

*Prepared during Phase 0; verified at G1 kickoff — v1.0*
