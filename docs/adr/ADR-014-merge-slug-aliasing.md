# ADR-014: Merge Slug Aliasing

**Status:** Accepted | **Workstreams:** B2, WS-4 Rev 2 R2-a

## Decision

When a merge soft-deletes a source `playerId`, source slug(s) are preserved as **permanent redirect aliases** to the canonical `playerId`. Aliases are append-only and never reused. Profile resolution must consult the alias map before returning not-found.

## Invariants

INV-16
