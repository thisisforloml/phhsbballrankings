# ADR-006: Snapshot Lifecycle

**Status:** Accepted | **Workstreams:** P0, WS-2

## Decision

Monthly snapshot cadence (`weekOf` = first day of month). States: `DRAFT` → `PUBLISHED` → `SUPERSEDED`. Published snapshots are immutable. No publish during active merge or open G3-R rollback window.

## Invariants

INV-02, INV-03
