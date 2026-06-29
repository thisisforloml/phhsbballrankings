# Competition Strength Transparency — Launch Specification

**Status:** Design specification (pre-implementation)  
**Version:** 1.0  
**Effective:** 2026-06-18  
**Companion audit:** [COMPETITION_STRENGTH_TRANSPARENCY_AUDIT.md](./audits/COMPETITION_STRENGTH_TRANSPARENCY_AUDIT.md)  
**Constraint:** **No modification to player ratings, GPS formulas, star bands, or ranking order**

---

## 1. Purpose

Give players, parents, coaches, and recruiters **visible competition context** — which leagues, what tier, how many verified games — while keeping Formula v1 ratings **tier-neutral** as they are in production today.

This spec defines copy, data rules, UI surfaces, and rollout phases. It does **not** authorize tier multiplier activation.

---

## 2. Design principles

1. **Context ≠ rating** — Every surface that shows tier or competition must include or link to a short disclaimer.
2. **Governance-aligned language** — Tier 1 = National Flagship (highest); Tier 4 = Developmental (lowest). Never use legacy “Entry/Elite” inversion on public surfaces.
3. **Evidence-based only** — Count verified/submitted official games linked to `GameStat`; no inferred tiers.
4. **Progressive disclosure** — Rankings stay scannable; depth lives on player profile and recruiting view.
5. **Fail-closed on ambiguity** — If `League.tier` unset or league provisional, show name without tier badge.

---

## 3. Tier display standard (mandatory before badges)

Centralize in `src/lib/competition-tier-display.ts` (proposed):

| DB `tier` | Public short label | Public long label | Recruiting shorthand |
|----------:|--------------------|-------------------|----------------------|
| 1 | T1 | National Flagship | Flagship |
| 2 | T2 | Elite National Circuit | Elite circuit |
| 3 | T3 | Competitive Regional | Regional |
| 4 | T4 | Developmental | Developmental |

**Deprecation:** Remove or bypass existing `tierLabel()` in `player-profile.ts` and `CompetitionHistory.tsx` that maps tier 1 → “Entry”, tier 4 → “Elite”.

**Tooltip (all tier surfaces):**

> Competition tier describes league strength for context. It does not change player ratings on Peach Basket.

---

## 4. Feature specifications

### 4.1 P0 — Primary competition display (Rankings + Search)

**Surfaces:** `/rankings`, `/api/search` player results, optional homepage leaderboards.

**Row extension** (`NationalRankingRow`):

```typescript
primaryCompetition: {
  leagueName: string;      // normalized display name
  shortName: string;       // e.g. "UAAP S88 HS Boys"
  verifiedGameCount: number;
  tier: number | null;     // DB tier, for internal sort only in P0
} | null;
```

**Selection algorithm:**

1. Group player’s verified `GameStat` rows by `leagueId` (or normalized league name).
2. Primary = league with **maximum verified game count**.
3. Tie-break: **lower tier number** (governance: 1 beats 3).
4. Tie-break: most recent `gameDate`.

**UI:**

- Render under `currentTeam`: `UAAP S88 HS Boys · 62 games`
- Do **not** show tier badge on board row in P0.
- Tooltip on subtitle: full league name + season if space.

**Search (`public-search.ts`):**

- Add to `meta` or `subtitle`: primary competition short name when no public rank.
- Keep `rankLabel` age-group accurate (post home-board architecture).

**Effort:** ~1–2 days engineering + QA.

---

### 4.2 P1 — Tier exposure breakdown (Player profile)

**Surface:** Player profile, new module **“Competition Exposure”** above League History.

**Data:**

```typescript
type TierExposure = {
  tier: 1 | 2 | 3 | 4;
  label: string;           // governance long label
  verifiedGames: number;
  sharePct: number;        // of player's verified games
};
```

**Query:** Single aggregation per player from `GameStat` → `Game` → `Season` → `League.tier`.

**UI:**

```
Competition Exposure          15 verified games
[T1 National Flagship    8  ████████░░  53%]
[T3 Competitive Regional 7  ███████░░░  47%]
```

- Neutral gray bars (not brand orange/green used for ratings).
- Footnote: *Ratings are not weighted by competition tier.*

**Mobile:** 2×2 grid if &lt;360px width.

**Effort:** ~2 days.

---

### 4.3 P1 — Competition profile summary (Player profile)

**Enhance existing `CompetitionHistory`:**

| Field | Source | Display |
|-------|--------|---------|
| League name | `League.name` + normalizer | Title |
| Season | `Season.name` | Subtitle |
| Games | count | `N games` |
| Tier | governance label | `T1 · National Flagship` |
| Verification | `League.verificationStatus` | `Verified` / `Provisional` chip |
| Avg stat line | existing | PPG / RPG / APG |

**Sort order:** Governance tier ascending (1 first), then games descending.

**Fix:** Replace `Math.max(existing.tier, league.tier)` intent — for display sort use **min tier number** as “strongest” league.

---

### 4.4 P1 — Tier badges (profile only, post-label-fix)

Small chip on league cards: `T1` with tooltip long label.

**Not on rankings row** until one full release cycle validates no misinterpretation.

---

### 4.5 P2 — Scout / recruiting indicators (AG-4)

**Surface:** U19 class-year recruiting view ([AG4_RECRUITING_VIEW_IMPLEMENTATION_PLAN.md](./AG4_RECRUITING_VIEW_IMPLEMENTATION_PLAN.md)).

**Additional columns / chips (read-only):**

| Indicator | Rule |
|-----------|------|
| `Exposure: Flagship` | ≥50% games in tier 1 |
| `Exposure: Circuit` | ≥50% games in tier 2–3, &lt;25% tier 1 |
| `Exposure: Mixed` | No majority |
| `Verification: Provisional` | Any league `verificationStatus = PROVISIONAL` in exposure |

**Sort:** Not by these indicators by default (RC-5 AG-4); filter-only in AG-4.1 if requested.

---

## 5. API & data layer

### 5.1 Proposed helpers (no schema change)

| Module | Responsibility |
|--------|----------------|
| `competition-tier-display.ts` | Governance labels, tooltips |
| `player-competition-context.ts` | `getPrimaryCompetition()`, `getTierExposure()`, `getLeagueHistory()` |
| Extend `rankings.ts` row mapper | Attach `primaryCompetition` |
| Extend `player-profile.ts` | Use shared helpers; fix sort |

### 5.2 Caching

At current scale, per-request aggregation is acceptable. If rankings page exceeds ~500 rows × join cost, add:

- Server-side memoization per `playerId` for request lifetime, or
- Nightly `player_competition_summary` table (future).

---

## 6. Copy deck (public)

**Rankings footer:**

> Rankings reflect verified official game performance. Competition names show where stats were recorded. Competition tier is informational and does not change ratings.

**Profile exposure module:**

> How many verified games this player has in each competition tier. Tiers are assigned by Peach Basket using our competition classification framework.

**Recruiting view banner:**

> Recruiting context — schedule strength and verification status. National rank unchanged.

---

## 7. Schema changes

### Required for launch

**None.**

### Recommended (governance track)

```prisma
model League {
  // existing fields...
  tierReviewedAt  DateTime?
  tierRationale   String?
  tierSource      String?   // RUBRIC | MANUAL | IMPORT_DEFAULT
}
```

Migration is **optional** for P0–P1; admin notes field can substitute short-term.

---

## 8. Backfill & governance checklist

Before P1 tier badges:

- [ ] Governance board signs [COMPETITION_TIER_GOVERNANCE_FRAMEWORK.md](./COMPETITION_TIER_GOVERNANCE_FRAMEWORK.md) numbering
- [ ] Admin updates 5 circuit leagues per [COMPETITION_TIER_CLASSIFICATION_REVIEW.md](./audits/COMPETITION_TIER_CLASSIFICATION_REVIEW.md) (optional for display-only if labels explain current DB tier)
- [ ] Ship centralized `competition-tier-display.ts`
- [ ] Remove inverted labels from `CompetitionHistory.tsx`
- [ ] Add admin tier legend to `LeagueDetailClient.tsx`

Before any rating impact:

- [ ] Separate approval: GPS `leagueWeight` activation
- [ ] Recompute impact per [TIER_WEIGHT_IMPACT_SIMULATION.md](./audits/TIER_WEIGHT_IMPACT_SIMULATION.md)
- [ ] **Not in scope of this spec**

---

## 9. Rollout order

| Phase | Deliverables | Depends on |
|-------|--------------|------------|
| **P0** | Primary competition on rankings + search; disclaimers | None |
| **P0.5** | Governance tier display helper; fix profile league labels | Governance sign-off |
| **P1** | Tier exposure module; enhanced competition history | P0.5 |
| **P1b** | Tier badges on profile league cards | P1 + 1 week QA |
| **P2** | AG-4 recruiting exposure indicators | AG-4 gate |
| **Future** | League public pages with tier rationale | League CMS |

---

## 10. QA checklist

- [ ] UAAP player shows primary competition “UAAP …”, not “Entry”
- [ ] Circuit-heavy player (e.g. Lucas Kaw) exposure shows tier 3 majority
- [ ] Collegiate-heavy player (e.g. Jude Eriobu) exposure shows tier 1 majority
- [ ] Xyriel: primary NCAA/U19 competition visible on U16 board row
- [ ] Unknown-DOB player: primary competition from stats; no false tier claim
- [ ] Rank order identical before/after deploy (byte compare snapshot)
- [ ] Mobile: rankings row does not wrap past 2 lines for subtitle
- [ ] Screen reader: tier exposure bars have text equivalents

---

## 11. Expected impact on ranking credibility

| Stakeholder | Expected effect |
|-------------|-----------------|
| Parents / players | Understand why highly rated players differ in schedule visibility |
| Coaches / scouts | Faster qualification of competition level without leaving platform |
| Platform trust | Transparency replaces suspicion of “black box” after tier-neutral rating policy is stated |
| Rankings integrity | **Neutral** — numbers unchanged; credibility **increases** via explainability |

---

## 12. Tier-weighted ratings policy

| Question | Decision |
|----------|----------|
| Should tier weights activate after this launch? | **No** — not bundled |
| Current production | All GPS `leagueWeight = 1`; ratings tier-neutral |
| Prerequisites to revisit | Governance alignment, tier backfill, simulation sign-off, explicit recompute approval |
| Relationship to Formula vNext | vNext `leagueTierWeight` remains shadow-only; independent of this transparency launch |

**Remain disabled** until a separate **Tier Weight Activation** gate passes.

---

## 13. Implementation estimate

| Phase | Engineering | Design/copy |
|-------|-------------|-------------|
| P0 | 1–2 d | 0.5 d |
| P0.5 + P1 | 3–4 d | 1 d |
| P2 (AG-4) | 2–3 d | 0.5 d |

Total MVP (P0 + P0.5 + P1): **~1 sprint** without schema migration.

---

## 14. Summary

| Item | Recommendation |
|------|----------------|
| **Recommended UX** | Primary competition (rankings/search) + tier exposure + competition history (profile) + governance tier labels + disclaimers |
| **Rollout order** | P0 → P0.5 label fix → P1 exposure/history → P1b badges → P2 recruiting |
| **Credibility impact** | Positive explainability; no numeric rank change |
| **Tier-weighted ratings** | **Stay disabled** |
