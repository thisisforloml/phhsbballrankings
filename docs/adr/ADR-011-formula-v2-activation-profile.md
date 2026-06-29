# ADR-011: Formula v2 Activation Profile

**Status:** Accepted  
**Date:** 2026-06-16  
**Workstreams:** B1, WS-7, P0 Amendment A-1

## Context

P0/PROJECT_STATUS approved "Claude No Shrinkage" v2: no Bayesian shrinkage, neutral context factors, volatility via eligibility labels. WS-7 initially tied tier multipliers and `shrinkageK` to G7 cutover — a governance contradiction.

## Decision

Split v2 activation into two gates:

**G7 — Formula v2 cutover (frozen profile):**
- `shrinkageK = 0`
- `leagueWeight = opponentFactor = teamFactor = 1.00`
- Tier multipliers inactive
- Low-game volatility via WS-1 eligibility + provisional labels

**G7-M — Mature policy (separate approval):**
- Tier multipliers and/or non-zero `shrinkageK`
- Activated via WS-3 `policyVersionId` bump, **not** a new `FormulaVersion`

Carryover prior is a **discounted prior** (WS-6), distinct from game-count Bayesian shrinkage.

## Consequences

- G7 board order matches validated v2 preview.
- Public methodology must describe G7 profile accurately.
- G7-M requires its own approval and rank-movement analysis.

## Invariants

INV-13
