# Platform Roadmap — Prioritization & Success Gates

Companion to `PLATFORM_GAP_MATRIX.md`. Does not replace `PROJECT_STATUS.md` guardrails.

## Workstream order (risk × dependency × value)

| Order | Workstream | Why this order |
| ---: | --- | --- |
| 1 | Formula versioning foundation | Blocks safe Formula v2; read-path safety prerequisite |
| 2 | Scouting report MVP + profile analytics | Highest product gap vs overview; no schema dependency — see `docs/planning/PLAYER_PROFILE_REDESIGN_PLAN.md` |
| 3 | Player lifecycle integrity | Carryover + roster debt affects rating trust |
| 4 | League tier operationalization | Depends on stable identity + rating context |
| 5 | Launch-readiness hardening | Legal, claim, legacy cleanup |
| 6 | Public UI/UX optimization | Parallel; low risk |
| 7 | Admin panel overhaul | Parallel; absorbs ops optimization |
| 8 | Profile analytics deep-dive | Delivered with workstream 2 implementation |

## Optimization priority matrix

| Track | Effort | Risk | Impact | Timing |
| --- | --- | --- | --- | --- |
| Public mobile QA + media backlog | Medium | Low | High | Now |
| Admin manual-stats scorekeeper | Medium | Low | High | Now |
| Publish impact summary + copy fixes | Low | Low | High | Now |
| Profile charts + explanations | Medium | Low | High | Now/Next |
| Positives-only scouting report | Low–Medium | Low | High | Next |
| Compare players head-to-head | Medium | Low | High | After charts |
| Data-health ops console | Medium | Low | Medium | Next |
| Roster/legacy cleanup cadence | Medium | Medium | Medium | Next |
| Admin IA + page rebuilds | High | Medium | High | Phased |
| Formula v2 storage migration | High | High | High | Gated approval |

## Success gates

### Formula v2 readiness

- [ ] `PlayerRating` and `GamePerformanceScore` support formula version composite uniqueness
- [ ] All public/admin read paths filter active public formula version
- [ ] v2 rows written with `isPublic = false` on FormulaVersion
- [ ] Side-by-side v1/v2 preview counts match dry-run reports
- [ ] Explicit approval before public switch

### Scouting report MVP

- [ ] Deterministic schema: inputs, confidence, provenance per bullet
- [ ] Positives only; no fabricated traits
- [ ] "Limited sample" when &lt; 3 official stat rows
- [ ] Visible on player profile with stat-backed links

### Player lifecycle integrity

- [ ] Carryover policy documented and implemented (June rollover)
- [ ] Blocked roster backlog (23 rows) has owner/decision per case
- [ ] Admin copy distinguishes profile program vs roster vs historical evidence

### Launch hardening

- [ ] Privacy/Terms reviewed (no placeholder contact)
- [ ] Claim workflow: write path + moderation **or** explicit read-only messaging
- [ ] Mobile smoke checklist passes (see `PUBLIC_MOBILE_QA_CHECKLIST.md`)
- [ ] No mock-backed routes promoted in main nav

### Profile analytics upgrade

**Planning spec:** `docs/planning/PLAYER_PROFILE_REDESIGN_PLAN.md` (v1.0, 2026-06-18)

Phased delivery:

| Phase | Scope |
| --- | --- |
| 1 | Layout density — compact hero, dedupe modules, collapse secondary trends |
| 2 | Performance trajectory chart (line/bar toggle) + tabbed analytics hub |
| 3 | Merge season production + competition modules; enhanced ranking chart |
| 4 | Heatmap strip, USG vs TS scatter on compare, dual radar |

Charts in scope (not all 11 as panels): performance trend, game bars toggle, radar ⟷ percentile bars, benchmark + production roll tabs, ranking movement, season comparison bars.

- [ ] Phase 1 layout density shipped
- [ ] Performance trajectory chart with hover + 5-game roll + W/L markers
- [ ] Tabbed analytics hub (vs benchmarks / production roll / skill toggle)
- [ ] SVG charts with a11y fallbacks
- [ ] Metric explanations on modules (tooltips / concise copy)
- [ ] Compare route: same age group + gender, live search picker; dual radar deferred to Phase 4

### Admin panel overhaul

- [ ] IA map approved (`ADMIN_IA_MAP.md`)
- [ ] Consolidated nav workspaces live
- [ ] Pre-publish impact summary on submission detail
- [ ] Data health remediation queues with deep links
- [ ] Manual stats staged scorekeeper usable on laptop
- [ ] High-impact mutations remain approval-gated; audit log for publish/import
