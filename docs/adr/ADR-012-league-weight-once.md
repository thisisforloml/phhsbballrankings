# ADR-012: League Weight Applied Once

**Status:** Accepted | **Workstreams:** WS-5, WS-7

## Decision

WS-3 assigns league tier. WS-7 owns tier multiplier values in `FormulaVersion.weights`. Multiplier is applied **once at score compute** into `GamePerformanceScore.leagueWeight`. WS-5 accumulation consumes `finalPerformanceScore` only — no re-application.

## Invariants

INV-08
