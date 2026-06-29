# ADR-007: Policy Versioning

**Status:** Accepted | **Workstreams:** WS-3

## Decision

Eligibility, threshold, and carryover parameters are versioned via WS-3 policy registry. Policy changes are **prospective-only**. G7 (formula cutover) and policy activation are separate gates. G7-M activates tier/shrinkage via `policyVersionId` bump.

## Invariants

INV-11
