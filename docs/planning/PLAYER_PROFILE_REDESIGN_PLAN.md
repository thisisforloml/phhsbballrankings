# Player Profile Redesign Plan

**Status:** Approved planning specification  
**Version:** 1.0  
**Effective:** 2026-06-18  
**Authority:** Consolidates layout-density feedback, analytics chart proposals, and current implementation audit  
**Scope:** Public player profile at `/players/[slug]` — UI/UX and read-path analytics only. No rating recomputes, snapshot generation, schema changes, or Formula v2 writes without explicit approval per `data-safety.mdc`.

---

## Document control

| Version | Date | Summary |
| --- | --- | --- |
| **1.0** | **2026-06-18** | Initial plan: 4-beat IA, chart tiering (6 concepts / not 11 panels), redundancy map, phased delivery |

### Related artifacts

| Artifact | Role |
| --- | --- |
| `src/app/players/[slug]/page.tsx` | Current section stack (15 modules) |
| `src/components/public/PlayerProfileHeader.tsx` | Hero card |
| `src/components/public/PlayerProfileCharts.tsx` | Performance analytics, scouting, league split |
| `src/components/public/PlayerAnalytics.tsx` | Season stats, best game, strengths, shooting, game log |
| `src/components/sections/RecentGames.tsx` | Recent form table |
| `src/lib/player-profile.ts` | Server loader (benchmarks, percentiles, games) |
| `src/lib/player-profile-types.ts` | Client-safe types |
| `src/lib/player-profile-analytics.ts` | Client-safe chart helpers |
| `docs/PLATFORM_ROADMAP.md` | Workstream 2 / profile analytics gates |
| `.cursor/rules/client-server-boundary.mdc` | Client must not import server loaders |

### Guiding principles

1. **Preserve historical integrity** — charts read `Game` / `GameStat` / `GamePerformanceScore`; no rewrites.
2. **One question per surface** — if two blocks answer the same question, merge or tab.
3. **Progressive disclosure** — hero answers “who + how good”; analytics answers “why”; game log answers “prove it.”
4. **Formula v1 only in production** — advanced metrics (ORtg, DRtg, win shares) stay deferred until methodology is approved for public display.
5. **Density without clutter** — fewer cards, tighter grids, toggles instead of duplicate charts.

---

## Current state (baseline)

### Section stack today

```
PlayerProfileHeader
→ RecentGames
→ PlayerPerformanceDashboard
→ PlayerScoutingReport
→ PlayerAnalytics (10 stat tiles)
→ PlayerBestGame
→ PlayerProfileStrengths (archetype + percentile bars)
→ PlayerProductionProfile (shooting + advanced + game highs)
→ PlayerLeagueSplitChart (if 2+ leagues)
→ CompetitionParticipationSummary
→ CompetitionHistory
→ PlayerRankingTrend
→ PlayerFullGameLog
→ Rating explainer <details>
→ Claim CTA
```

### What works (keep)

| Element | Why |
| --- | --- |
| Hero identity card (photo, school, rating, ranks) | Strong recruiting-first impression |
| Stat vs benchmarks chart | Core differentiator vs generic stat pages |
| Skill radar (board percentile framing) | Quick archetype read |
| Recent games table | Ground truth for recent performance |
| Scouting paragraph | Human-readable synthesis |
| Full game log | Verification / power-user layer |

### Problems to fix

| Issue | Root cause |
| --- | --- |
| Hero whitespace | Fixed 3-column grid (`14.5rem \| flex \| 20rem`); 5 boxed stat pills duplicate season averages |
| Body whitespace | ~15 full-width `ProfileModule` cards; `lg:grid-cols-10` stat wall; wide scouting prose |
| Redundant stats | PPG/RPG/APG/GP in hero → Player Analytics → scouting prose |
| Redundant form | Recent Form deltas → Performance insight strip |
| Redundant percentiles | Radar + radar side bars → Profile Strengths bars → scouting |
| Redundant competition | Participation summary + history + league split |
| Redundant CTAs | Claim in hero + footer banner |

---

## Target information architecture (4 beats)

```text
Beat 1 — Identity     Compact hero: who, rating, ranks, 4 headline stats
Beat 2 — Snapshot     Recent 5 (table + one-line summary)
Beat 3 — Analytics    Performance hub (charts + toggles)
Beat 4 — Depth        Scouting, production, competition, game log
```

### Desktop layout sketch

```text
┌─────────────────────────────────────────────────────────────┐
│ [Photo]  Name · City · Meta          │ Rating · Ranks · CTA │
│          PPG · RPG · APG · GP (inline)                      │
└─────────────────────────────────────────────────────────────┘
┌ Recent Form ────────────────────────────────────────────────┐
│ Last 5: 27.4 (+4) · 17.8 RPG · 0.4 APG · 3-2              │
│ [full-width game table]                                     │
└─────────────────────────────────────────────────────────────┘
┌ Performance Analytics ──────────────────────────────────────┐
│ [Performance Trend]  Line ⟷ Bars   ← hero chart (#1 + #2)   │
│ [optional heatmap strip — collapsed]                        │
│ Tabs: [ vs Benchmarks ] [ Production roll ]                 │
│ Skill: Radar ⟷ Percentile bars                              │
│ ▸ More trends (collapsed)                                   │
└─────────────────────────────────────────────────────────────┘
┌ Scouting Report (max-w-3xl prose) ──────────────────────────┐
┌ Season Production │ Best Game │ Shooting │ Highs ───────────┐
┌ Competition (merged table + grouped bars) ──────────────────┐
┌ Board Standing: ranking movement (if enough snapshots) ─────┐
┌ Full Game Log ──────────────────────────────────────────────┘
```

### Target section order (`page.tsx`)

```typescript
<PlayerProfileHeader />
<RecentGames />
<PlayerPerformanceDashboard />   // redesigned hub
<PlayerScoutingReport />
<PlayerSeasonProduction />       // merged: best game + shooting + highs + core averages
<PlayerCompetitionModule />      // merged: participation + history + season bars
<PlayerRankingTrend />           // enhanced rank chart
<PlayerFullGameLog />
<details>Rating explainer</details>
<ClaimCta />                     // single CTA — remove duplicate from hero or footer only
```

---

## Chart catalog — what to implement

**Rule:** Do **not** render all 11 proposed charts as always-on panels. Implement **six concepts** via toggles/tabs inside **two modules**.

### Tier 1 — Profile (build)

| # | Chart | Verdict | Placement | Notes |
| ---: | --- | --- | --- | --- |
| **1** | **Performance trend line** | **Build — hero chart** | Top of Performance Analytics | `finalPerformanceScore` per game; 5-game rolling avg; W/L colored dots; rich hover (opponent, score, league, date, stat line). **Not** the headline `PlayerRating` (aggregated). |
| **2** | **Game-by-game bars** | **Build — toggle with #1** | Same component as #1 | `Line ⟷ Bars`; bar height = performance score; color by league tier. |
| **3** | **Percentile bars** | **Build — toggle with radar** | Skill profile module | Horizontal 0–100 bars; navy→amber gradient. v1: 6 board categories (scoring, efficiency, rebounding, playmaking, defense, accuracy/TS%). Extend to STL, BLK, USG% in v1.1. |
| **4** | **Radar (spider)** | **Keep — toggle with #3** | Skill profile module | Already built. Dual-player overlay → **compare tool only**. |
| **6** | **Rolling PPG/RPG/APG** | **Merge — tab, not standalone** | Tab on benchmark chart: `Production roll` | 5-game rolling lines for three stats. Replaces redundant mini-trend + insight strip overlap. |
| **7** | **Ranking movement** | **Enhance existing** | Board Standing strip | Inverted Y (rank #1 at top); milestone markers when data allows. Hide thin state if &lt; 3 snapshots. |
| **8** | **Season comparison bars** | **Merge into Competition** | Competition module | Grouped PPG/RPG/APG by season/league (extends current PPG-only split). |

**Also keep (existing, refined):**

| Chart | Verdict |
| --- | --- |
| Stat vs benchmarks (PTS/REB/AST/TS% vs league + age) | Tab `vs Benchmarks` inside Performance Analytics |
| Extended trends (TS%, minutes, perf score) | Collapsed `▸ More trends` by default |

### Tier 2 — Build next

| # | Chart | Verdict | Notes |
| ---: | --- | --- | --- |
| **11** | Performance heatmap | Optional polish | One-row calendar strip under #1; collapsed by default |
| **5** | USG% vs TS% scatter | Compare / premium later | Needs cohort scatter payload + per-player USG on profile |

### Tier 3 — Defer (not public v1)

| # | Chart | Verdict | Reason |
| ---: | --- | --- | --- |
| **9** | ORtg vs DRtg scatter | Defer | `advanced-metrics.ts` exists; unstable on youth samples; not approved for public narrative |
| **10** | Win shares cumulative area | Defer | Formula vnext / experimental; not production profile story |

### Question → chart mapping

| User question | Primary chart |
| --- | --- |
| Is this player improving game to game? | #1 Performance trend |
| Was one game a fluke? | #2 Bar toggle on #1 |
| How do they rank vs peers? | #3 or #4 (one visible) |
| How vs league / age averages over time? | Stat vs benchmarks tab |
| Where is national standing heading? | #7 Ranking movement |
| Do numbers hold in tougher competition? | #8 Season comparison |

---

## Redundancy elimination

| Remove / merge | Replace with |
| --- | --- |
| Hero 5 stat boxes | 4 inline chips: PPG · RPG · APG · GP |
| `PlayerAnalytics` 10-tile wall | `PlayerSeasonProduction` — 6 core + expandable secondary |
| Performance insight strip (4 chips) | One line in Recent Form; consistency/trajectory stay under benchmark chart |
| Profile Strengths percentile bars | Skill module `Radar ⟷ Bars` toggle |
| Radar internal duplicate bars + strengths bars | Single skill view |
| 3 competition modules | `PlayerCompetitionModule` |
| Duplicate Claim CTA | One location (hero **or** footer) |
| Scouting raw stat repetition | Interpretation-only copy; numbers live in charts |
| Extended trends always open | `<details>` collapsed default |

---

## Section specifications

### A. Hero card (`PlayerProfileHeader`)

- Tighten grid: photo column slightly narrower; identity + rating/ranks as 2 zones on desktop.
- Meta: dense 2×2 grid (School/Class · Position/Height).
- Stats: inline chips only — no boxed row.
- Actions: Compare + Claim on one row.
- Reduce mobile `min-h` on photo column.

### B. Recent Form (`RecentGames`)

- Single summary line above table: `Last 5: 27.4 PPG (+4) · 17.8 RPG · 0.4 APG · 3-2`.
- Remove floating 3-stat boxes (`md:max-w-[24rem]` cluster).
- Full-width table.

### C. Performance Analytics hub (`PlayerProfileCharts`)

**Structure (top → bottom):**

1. **Performance trajectory** — new `#1` + `#2` toggle component
2. **Optional heatmap strip** — `#11`, collapsed
3. **Tabs:** `vs Benchmarks` | `Production roll` (`#6`)
4. **Skill profile:** `Radar ⟷ Percentile bars` (`#4` / `#3`)
5. **Collapsed:** More trends (TS%, minutes, perf score)

**Copy rules:**

- Performance trend = **game performance score** (Formula v1 GPS), not live `PlayerRating`.
- League benchmark line: games with ≥10 logged minutes (existing rule).
- Skill profile: 50 = average peer percentile; not a pro projection.

**New component:** `PerformanceTrajectoryChart.tsx` (client-safe)

- Props: `games: PlayerProfileGame[]` (chronological)
- Line + bar modes; 5-game roll; W/L markers; tooltip with game detail + link to `/games/[id]`

### D. Scouting Report

- `max-w-3xl` prose column.
- Headline = archetype (remove duplicate from Profile Strengths **or** merge strengths into scouting header — not both).
- Generator trim: avoid repeating PPG/RPG/APG already in hero/charts.

### E. Season Production (new merged module)

Replace `PlayerAnalytics` + `PlayerBestGame` + `PlayerProductionProfile` + `PlayerProfileStrengths` bars.

| Zone | Content |
| --- | --- |
| Primary row | GP, MPG, PPG, RPG, APG, TS% |
| Secondary | Expandable: SPG, BPG, TOV, PF, +/- |
| 3-column grid (desktop) | Best game \| Shooting bars \| Game highs |
| Strengths strip | Archetype + badges only (no percentile bars) |

### F. Competition module (new)

Merge `CompetitionParticipationSummary` + `CompetitionHistory` + `PlayerLeagueSplitChart`.

- Primary league chip + total verified games
- Table: league · season · GP · PPG · RPG · APG
- Grouped season bars (`#8`) when 2+ leagues/seasons

### G. Board Standing (`PlayerRankingTrend`)

- Primary: national **rank** (inverted Y)
- Optional faint: rating line
- Milestones: first top 50, career best, current (when snapshot history supports)
- Empty state: “Ranking history builds with weekly snapshots” when &lt; 3 points

### H. Game log

- Keep `PlayerFullGameLog` at bottom.
- Filters/sort unchanged.

---

## Data & backend requirements

### Ready today (no loader changes for Tier 1)

| Field | Source |
| --- | --- |
| `finalPerformanceScore` | `PlayerProfileGame` |
| W/L, opponent, date, league, tier | `PlayerProfileGame` / leagues |
| Board percentiles (6) | `profile.intelligence.percentiles` |
| Benchmarks + period averages | `profile.intelligence.benchmarks` |
| Ranking trend | `profile.rankingTrend` (sparse until more snapshots) |

### Tier 1 loader extensions (optional, small)

| Need | Work |
| --- | --- |
| League tier per game for bar colors | Ensure `mapGameStat` exposes `tier` on each game (or join from season/league) |
| Tooltip stat line | Already on `PlayerProfileGame` |

### Tier 1.1 / Tier 2 (explicit approval)

| Need | Work |
| --- | --- |
| STL, BLK separate percentiles | Extend cohort keys in `player-profile.ts` |
| USG% percentile + scatter | Compute usage per player; cohort endpoint for compare/scatter |
| Cohort scatter for #5 | New read-only API: age group + gender peer points |
| ORtg / DRtg / win shares public | Formula vnext approval + per-game persistence policy |

### Client/server boundary

- All new chart components: `"use client"`.
- Types from `@/lib/player-profile-types`.
- Helpers from `@/lib/player-profile-analytics`.
- Never value-import `@/lib/player-profile`.

---

## Phased implementation

### Phase 1 — Layout density (low risk)

**Goal:** ~30% less scroll; no new charts.

| Task | Files |
| --- | --- |
| Compact hero + inline stats | `PlayerProfileHeader.tsx` |
| Recent Form one-line summary | `RecentGames.tsx` |
| Scouting `max-w-3xl` | `PlayerProfileCharts.tsx` |
| Collapse extended trends | `PlayerProfileCharts.tsx` |
| Remove insight strip | `PlayerProfileCharts.tsx` |
| Reorder sections | `page.tsx` |
| Single Claim CTA | `PlayerProfileHeader.tsx`, `page.tsx` |

**QA:** Jude Eriobu profile on laptop + mobile; no `node:fs` client errors.

### Phase 2 — Analytics hub + hero chart

**Goal:** Performance trajectory + tabbed analytics.

| Task | Files |
| --- | --- |
| `PerformanceTrajectoryChart` (#1 + #2) | `charts/PerformanceTrajectoryChart.tsx`, `PlayerProfileCharts.tsx` |
| Tab: vs Benchmarks / Production roll (#6) | `PlayerProfileCharts.tsx` |
| Skill Radar ⟷ Percentile bars toggle (#3/#4) | `PlayerProfileCharts.tsx`, `ProfileCharts.tsx` |
| Remove duplicate strength bars | `PlayerAnalytics.tsx` |
| Game tier on profile game type (if missing) | `player-profile-types.ts`, `player-profile.ts` |

**QA:** Hover tooltips; line/bar toggle; W/L colors; January+ month axis labels.

### Phase 3 — Module merges

| Task | Files |
| --- | --- |
| `PlayerSeasonProduction` | New or refactor `PlayerAnalytics.tsx` |
| `PlayerCompetitionModule` | New; replace 3 section imports |
| Enhanced ranking chart (#7) | `PlayerAnalytics.tsx` (`PlayerRankingTrend`) |
| Grouped season bars (#8) | Competition module |
| Scouting copy trim | `scouting-report.ts` |

### Phase 4 — Polish & compare prep

| Task | Notes |
| --- | --- |
| Heatmap strip (#11) | Collapsed under trajectory |
| USG vs TS scatter (#5) | `/players/compare` first |
| Dual radar on compare | `PlayerCompareClient.tsx` |
| Sticky subnav (optional) | Overview · Analytics · Games |

---

## Success criteria

| Metric | Target |
| --- | --- |
| Scroll depth (16-game profile) | ~30–40% reduction after Phase 1–3 |
| Stat repetition | No stat shown more than twice (number + narrative max) |
| Hero height (laptop) | Reduced without losing identity |
| Chart count (always visible) | ≤ 4 visualizations with toggles |
| Mobile | No orphan tiles; tables primary for games |
| a11y | `role="img"`, `aria-label`, keyboard legend toggles on charts |
| Performance | No new N+1 queries; cohort scatter gated to compare route |

### Manual QA checklist (per phase)

- [ ] `/players/[slug]` loads without build/runtime errors
- [ ] Hero: rating, ranks, 4 inline stats, one Claim CTA
- [ ] Recent Form: summary line + 5-game table
- [ ] Performance trend: chronological scores, 5-game roll, W/L dots, hover details
- [ ] Line/bar toggle colors bars by tier
- [ ] Benchmark tab: PTS/REB/AST/TS% vs league (10+ min) + age line
- [ ] Skill toggle: radar and bars show same 6 categories
- [ ] Scouting: readable width; no duplicate stat wall
- [ ] Competition: one module, table + bars if multi-league
- [ ] Ranking: inverted rank when ≥ 3 snapshots
- [ ] Game log: filters still work
- [ ] Compare link from hero works

---

## Explicit non-goals (this plan)

- Formula v2 writes or public switch
- Rating recomputes or snapshot generation
- ORtg / DRtg / win shares on public profile (v1)
- Shot charts or play-by-play
- Premium gating of analytics (already public)
- Mock-data removal from `/claim` picker (separate roadmap item)

---

## Open decisions

| ID | Question | Recommendation | Status |
| --- | --- | --- | --- |
| OD-1 | Default skill view: radar or bars? | Radar (already familiar); bars as toggle | **Pending product sign-off** |
| OD-2 | Claim CTA: hero or footer? | Hero only; footer text link | **Pending** |
| OD-3 | Performance trend Y-axis cap | Dynamic with headroom vs fixed 0–100 | **Pending** (GPS is 0–100 scale) |
| OD-4 | Heatmap in Phase 2 or 4? | Phase 4 polish | **Locked** |

---

## Revision log

| Date | Change |
| --- | --- |
| 2026-06-18 | v1.0 — Initial plan from profile UX audit + 11-chart proposal triage |
