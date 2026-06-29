# Eligibility Duplication Map

**Authority:** Phase 0 §5.4; INV-04; Risk R-04; G1-R01  
**Owner:** Rankings architect  
**Gate:** G1 entry and exit

---

## INV-04 Violation Risk

**Invariant:** Eligibility module (WS-1) is the sole threshold authority.  
**Current state:** Threshold and bracket logic duplicated across multiple modules.  
**G1 exit criterion:** All paths consume WS-1 verdict; no standalone threshold constants in display/API.

---

## Duplication Register

| # | Site | Location | Behavior today | WS-1 target | Remove/replace |
|---|---|---|---|---|---|
| 1 | Board minimum games | `src/lib/public-board-ranks.ts` `publicBoardMinimumGames` | Boys 10, Girls 5 hardcoded | Policy-versioned via WS-3; verdict from WS-1 | **Replace** with verdict filter |
| 2 | Leaderboard minimum | `src/lib/players.ts` `leaderboardMinimumGamesForGender` | Same Boys 10 / Girls 5 | WS-1 `gamesQualified` | **Remove**; delegate to WS-1 |
| 3 | Class year derivation | `src/lib/ranking-eligibility.ts` `getClassYear`, `getEffectiveClassYear` | March-birthday rule + override | `classYearStatus` verdict input | **Integrate** into WS-1 |
| 4 | Class year exclusion | `ranking-eligibility.ts` `isRankingEligibleByClassYear` | June 1 exclusion | FORMER / HIDDEN verdict | **Integrate** into WS-1 |
| 5 | Age bracket | `getAgeBracketAsOfMarch31`, `getCurrentRankingAgeBracket` | U13/U16/U19/OUT_OF_RANGE | `competitionAgeGroup`, board evaluation | **Integrate** into WS-1 |
| 6 | Age override | `Player.ageGroupOverride` on reads | Display + bracket filter | ADR-004 PROVISIONAL path | **Integrate** into WS-1 |
| 7 | Unknown DOB | Various reads | Temporarily rank-eligible when bracket null | ADR-003 trust level + escalation | **Integrate** into WS-1 |
| 8 | Verdict hierarchy P1–P15 | **Not implemented** | Ad hoc filters | Unified precedence engine | **Implement** at G1 |

---

## Consolidation Scope (Agreed at G1 Entry)

| Phase | Action | Files affected |
|---|---|---|
| G1 design | Define WS-1 API surface (verdict query by player + board) | New WS-1 module (planning) |
| G1 implement | Replace sites #1–#2 first (highest INV-04 risk) | `public-board-ranks.ts`, `players.ts` |
| G1 implement | Integrate #3–#7 into verdict inputs | `ranking-eligibility.ts` → WS-1 |
| G1 verify | No remaining hardcoded `10` / `5` thresholds outside WS-3 policy | Code audit |

---

## Policy Versioning Note (ADR-002, ADR-007)

Launch thresholds (Boys 10 / Girls 5) become **policy-versioned** at G2. G1 must structure verdict engine to accept threshold from `policyVersionId`, not literals — even if launch values unchanged.

---

## Test Coverage (G1-R03)

| Duplication site | Test case |
|---|---|
| Boys at 9 games | PROVISIONAL or HIDDEN per P-band |
| Girls at 5 games | RANKED at threshold |
| Class year June 1 | FORMER |
| Unknown DOB | Trust level path per ADR-003 |
| ageGroupOverride cross-bracket | PROVISIONAL per ADR-004 |

---

## Sign-Off

| Role | Consolidation scope agreed | Date |
|---|---|---|
| Rankings architect | [ ] | |
| Engineering lead | [ ] | |
| Product owner | [ ] | |

---

*G1-R01 deliverable — v1.0*
