# Rating Reformulation — Tier-Normalized Phase 1 Preview

**Generated:** 2026-06-18T14:45:36.153Z  
**Mode:** Read-only preview. No GPS, PlayerRating, RankingSnapshot, or schema writes.

## Candidate decision

**Soft lower-tier discount**  
Best first candidate: fixes the Lucas/circuit-heavy signal while keeping top-10 churn within guardrails.

This preview keeps current public eligibility and board membership fixed, then recalculates ranking order using tier-normalized game scores.

## Scenario weights

| Scenario | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
| --- | ---: | ---: | ---: | ---: |
| Soft lower-tier discount | 1 | 0.97 | 0.93 | 0.9 |
| Medium lower-tier discount | 1 | 0.95 | 0.9 | 0.85 |
| Firm lower-tier discount | 1 | 0.93 | 0.86 | 0.8 |

## Movement summary

| Board | Scenario | Avg abs rank Δ | Avg abs rating Δ | Top-10 churn | Top-25 churn |
| --- | --- | ---: | ---: | ---: | ---: |
| U19 Boys | Soft lower-tier discount | 5.81 | 1.47 | 2 | 1 |
| U19 Boys | Medium lower-tier discount | 7.97 | 2.01 | 2 | 2 |
| U19 Boys | Firm lower-tier discount | 11.01 | 2.73 | 4 | 4 |
| U19 Girls | Soft lower-tier discount | 0 | 0 | 0 | 0 |
| U19 Girls | Medium lower-tier discount | 0 | 0 | 0 | 0 |
| U19 Girls | Firm lower-tier discount | 0 | 0 | 0 | 0 |
| U16 Boys | Soft lower-tier discount | 3.61 | 1.52 | 3 | 2 |
| U16 Boys | Medium lower-tier discount | 4.15 | 1.75 | 3 | 3 |
| U16 Boys | Firm lower-tier discount | 4.98 | 2.06 | 3 | 3 |
| U13 Boys | Soft lower-tier discount | 0 | 4.01 | 0 | 0 |
| U13 Boys | Medium lower-tier discount | 0 | 5.73 | 0 | 0 |
| U13 Boys | Firm lower-tier discount | 0 | 8.03 | 0 | 0 |

## U19 Boys named-player review

### Soft lower-tier discount

| Player | Current | Preview | Rating | Δ Rating | Primary | Tier exposure |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Lucas Kaw | #2 | #4 | 87.4 | -6.58 | Stallion Cup – 17U | tier3: 22g |
| Jude Eriobu | #1 | #1 | 98.33 | 0 | UAAP S88 HS Boys | tier1: 16g |
| Josef Calo-oy | #4 | #2 | 93.1 | 0 | NCAA S101 Junior's | tier1: 14g |

### Medium lower-tier discount

| Player | Current | Preview | Rating | Δ Rating | Primary | Tier exposure |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Lucas Kaw | #2 | #5 | 84.58 | -9.4 | Stallion Cup – 17U | tier3: 22g |
| Jude Eriobu | #1 | #1 | 98.33 | 0 | UAAP S88 HS Boys | tier1: 16g |
| Josef Calo-oy | #4 | #2 | 93.1 | 0 | NCAA S101 Junior's | tier1: 14g |

### Firm lower-tier discount

| Player | Current | Preview | Rating | Δ Rating | Primary | Tier exposure |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Lucas Kaw | #2 | #7 | 80.82 | -13.16 | Stallion Cup – 17U | tier3: 22g |
| Jude Eriobu | #1 | #1 | 98.33 | 0 | UAAP S88 HS Boys | tier1: 16g |
| Josef Calo-oy | #4 | #2 | 93.1 | 0 | NCAA S101 Junior's | tier1: 14g |

## Interpretation

- A viable Phase 1 should move circuit-heavy profiles out of obviously over-credited slots without wiping out the current board.
- If no candidate passes, the next step is full Formula vNext calibration with opponent strength, home-board evidence roles, recency, and shrinkage.
- Production promotion still requires explicit approval and a separate write/recompute path.
