# ADR-001: Source of Truth

**Status:** Accepted  
**Date:** 2026-06-16  
**Workstreams:** P0, WS-2

## Context

Public rankings, profiles, search, and trends previously read from inconsistent sources. Audit Finding #1 confirmed live boards read `PlayerRating` while docs implied snapshot authority.

## Decision

- **Live public rankings:** `PlayerRating` is authoritative.
- **Historical rankings and trends:** `RankingSnapshot` + `RankingSnapshotRow` are authoritative.
- Snapshots are **immutable monthly freezes** of the live board at publish time, using the same unified eligibility rules as public display.

## Consequences

- Public boards must read live `PlayerRating` filtered by active formula version.
- Trend charts must read `RankingSnapshotRow`, not live ratings.
- Snapshot generation copies live state; it does not independently recompute.

## Invariants

INV-01, INV-02
