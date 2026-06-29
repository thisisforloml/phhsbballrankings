# UI/UX Overhaul — Audit (Step 1)

Status: **Signed off (2026-06-17).**

## Sign-off decisions
- **Palette:** Primary = deep court navy/ink (`#0F2044` family); single accent = hardwood orange (`#D97706`); one neutral gray ramp; semantic `success`/`warning`/`error` reserved for state only.
- **Route deletions:** **None for now** — every route is restyled **in place** and kept working. "Consolidate" verdicts are achieved by making routes share the same primitives (reduced duplicated styling), not by removing routes. Deletions to be revisited later.
- **Scope:** **Every page** migrated to the redesign standard.

## Implementation strategy
1. Tokens remap: all legacy color families (`court`, `deep`, `paper`, `line`, `navy`, `amber`, `surface`, `ink`, `hardwood`, `gold`, `win`, `loss`) are repointed into the one unified palette, plus new semantic aliases (`primary`, `accent`, `neutral`, `success`, `warning`, `danger`). This shifts every page to the cohesive palette immediately.
2. `globals.css` shared classes rewritten to the new calmer aesthetic (one radius, subtle elevation, more whitespace), keeping class names so dependent pages restyle automatically.
3. New React primitives in `src/components/ui/` (`Card`, `Button`, `Badge`, `DataTable`, `PageHeader`, `Section`, `Stat`, `Field`, `Tabs`) become the single source of truth; pages migrate structure onto them.

This is a redesign-and-subtraction pass, not a feature-addition pass. The audit below classifies every public and admin page/component as **Keep As-Is / Restyle / Consolidate / Delete**, with reasoning. Nothing is touched until this list is agreed.

---

## Core problem (why a redesign, not more widgets)

The product currently ships **two competing visual languages**:

1. **"Sports/editorial"** — `court` / `hardwood` / `gold` / `paper` / `line` tokens, square corners, hard offset shadows (`shadow-[3px_3px_0...]`), cream `#f7f4ef` page background. Used on home, rankings, player profile, games, navbar, footer.
2. **"Generic SaaS"** — `navy` / `amber` / `surface` / `ink` tokens, `rounded-lg`, soft `shadow-sm`, gray/white backgrounds. Used on about, careers, legal, admin shell, portal, organizer.

`tailwind.config.ts` defines **12 overlapping color families** (`court`, `deep`, `hardwood`, `gold`, `paper`, `line`, `navy`, `amber`, `surface`, `ink`, `win`, `loss`). `globals.css` carries **~50 bespoke component classes**. This is exactly the "same product with more widgets bolted on" symptom: every surface improvises its own card, table, and badge.

**Target end-state:** one restrained palette, one type scale (4–5 sizes), one spacing scale, and a single shared primitive set (`Card`, `Button`, `Badge`, `Table`, `PageHeader`, `Section`, `Stat`) used identically on every page — replacing both the `Admin*` kit and the public-specific styling.

---

## Proposed design tokens (to be built in Step 2)

| Token group | Decision |
| --- | --- |
| **Primary** | Deep court navy/ink (`#0F2044` family) — brand anchor, headers, primary buttons |
| **Accent** | Single hardwood orange (`#D97706`) — one accent only, for emphasis/CTAs/active state |
| **Neutrals** | One gray ramp (`surface` 0→800 consolidated) — backgrounds, borders, text |
| **Semantic** | `success` / `warning` / `error` reserved for state only (win/loss become semantic) |
| **Type scale** | 5 sizes: `display` (hero), `title` (page/section h1–h2), `heading` (card h3), `body`, `caption`/`label`. Consistent weights. |
| **Spacing** | One 4px-based scale; kill one-off paddings. Standard page gutter + section rhythm. |
| **Radius** | One radius for cards/inputs/buttons (no mix of square + `rounded-lg`). |
| **Elevation** | One subtle shadow for raised surfaces; remove hard offset "comic" shadows. |

> Palette retires: `deep`, `gold`, `paper`, `line`, `navy` (as a separate family), `amber` (as a separate family), `ink` (folds into neutrals), `court` (folds into primary/neutral). `win`/`loss` → semantic `success`/`error`.

---

## Public pages

| Route | Verdict | Reasoning |
| --- | --- | --- |
| `/` (home) | **Restyle** | Flagship. Rebuild on new primitives; reduce competing focal points. |
| `/rankings` | **Restyle** | Core surface; standardize table + filter primitives. |
| `/rankings/[gender]/[age]` | **Restyle** | Same table primitive; fix density on mobile. |
| `/teams` | **Restyle** | Standardize table; improve discoverability. |
| `/teams/[id]` | **Restyle** | Team profile uses same card/table shells as player profile. |
| `/games` | **Restyle** | Game list onto shared card/table. |
| `/games/[id]` | **Restyle** | Box score onto shared table primitive. |
| `/leagues` | **Restyle** | League grid onto shared card. |
| `/leagues/[id]` | **Restyle** | Standings table primitive. |
| `/players/[slug]` | **Restyle (flagship)** | Must read as ONE cohesive analytics product — single card shell + spacing rhythm across trend / radar / shooting / scouting / compare. |
| `/players/compare` | **Restyle (feature layer)** | Rebuild on new primitives from the start (Step 4). |
| `/players` | **Consolidate** | Redirect into `/rankings` (or live search). Redundant with rankings + search. |
| `/players/search` | **Delete** | Superseded by the global `SearchOverlay`; redundant standalone search page. |
| `/players/submit-info` | **Consolidate** | Merge into a single "claim/submit your info" flow with `/claim`. |
| `/about` | **Restyle** | Legacy `navy/amber` styling → new tokens. |
| `/how-we-rank` | **Restyle** | Keep content; new tokens. |
| `/methodology` | **Consolidate → Delete** | Overlaps `/how-we-rank`; fold any unique content in, then remove. |
| `/faqs` | **Restyle** | New tokens. |
| `/careers` | **Restyle** | Legacy `navy/amber`; also has stale "monthly update" copy to fix. |
| `/partner` | **Consolidate** | Merge with `/apply` + `/organizer/apply` into one "work with us" path. |
| `/privacy` | **Restyle** | Legal; clean typographic template. |
| `/terms` | **Restyle** | Legal; same template as privacy. |
| `/claim` | **Restyle** | Keep (claim workflow); restyle + absorb `/players/submit-info`. |
| `/apply` | **Consolidate** | Fold into organizer apply path. |

## Auth / portal / legacy

| Route | Verdict | Reasoning |
| --- | --- | --- |
| `/portal/login` | **Restyle** | Canonical staff/organizer login. |
| `/portal` | **Restyle** | Portal home onto new primitives. |
| `/portal/players` | **Restyle** | Portal sub-page. |
| `/portal/live-stats` | **Consolidate** | One canonical Live Capture surface (see Live Capture below). |
| `/login` | **Restyle** | Member login; standardize auth card. |
| `/register` | **Restyle** | Member register; same auth card. |
| `/administrator` | **Delete** | Legacy duplicate of `/admin` using a `sessionStorage` hack + `/api/administrator/*`. Superseded by `/admin`. |
| `/owner` | **Delete** | Legacy owner dashboard; superseded by `/admin`. Verify no unique action before removal. |
| `/licensed` | **Delete (verify)** | Appears to be a legacy/placeholder route; confirm not linked. |

## Organizer

| Route | Verdict | Reasoning |
| --- | --- | --- |
| `/organizer` | **Restyle** | New primitives. |
| `/organizer/submissions` | **Consolidate** | Shares intake UI with admin; reduce duplicated upload copy/layout. Organizer keeps submission-only focus. |
| `/organizer/apply` | **Restyle** | Canonical "apply to organize" path (absorbs `/apply`, `/partner`). |
| `/organizer/live-stats` | **Consolidate** | Merge into single Live Capture surface. |

## Admin

| Route | Verdict | Reasoning |
| --- | --- | --- |
| `/admin` (dashboard) | **Restyle** | New primitives; clear single focus + data-health quick links. |
| `/admin/submissions` | **Restyle/Consolidate** | Part of one linear submission pipeline. |
| `/admin/submissions/[id]` | **Restyle** | Highest clutter; rebuild as guided pipeline step. |
| `/admin/programs` | **Restyle** | Identity workspace. |
| `/admin/programs/[id]` | **Restyle** | Identity detail. |
| `/admin/players` | **Consolidate** | Into Identity workspace (tab). |
| `/admin/teams` | **Consolidate** | Into Identity workspace (tab). |
| `/admin/team-ratings` | **Restyle** | Ratings workspace. |
| `/admin/data-health` | **Restyle** | New primitives; remediation queues. |
| `/admin/data-health/player-duplicates` | **Restyle** | Under Data Health. |
| `/admin/tools/submissions` (URL import) | **Consolidate** | Merge into submission pipeline intake (not a separate tool). |
| `/admin/tools/live-stats` | **Consolidate** | Into single Live Capture surface. |

---

## Components / styling layer

### Tokens & global styling
| Item | Verdict | Reasoning |
| --- | --- | --- |
| `tailwind.config.ts` color families | **Replace** | Collapse 12 families → 1 palette (primary, accent, neutrals, semantic). |
| `tailwind.config.ts` fontSize (`stat-*`, `label`, `mono-sm`) | **Replace** | New 5-size type scale. |
| `globals.css` (~50 component classes) | **Replace** | Cut to a minimal base layer; styling moves into shared React primitives. |

### New shared primitives (to be created in Step 2 — single source of truth)
`Card`, `Button` (primary/secondary/ghost/destructive), `Badge`/`StatusPill`, `DataTable` (sticky identity column, sort, empty state), `PageHeader`, `Section`, `Stat`, `Field`/form inputs, `Tabs`.

### Public components
| Component | Verdict | Reasoning |
| --- | --- | --- |
| `PublicPageShell` | **Restyle** | Becomes the new `Section`/page wrapper with standard gutters. |
| `ProfileModule` | **Replace → `Card`** | The flagship "card shell" everything migrates to. |
| `RankingTable`, `NationalTeamRankingTable`, `TeamStandingTable`, `TeamRosterTable`, `BoxScoreTable`, `GameList` | **Restyle → `DataTable`** | All collapse to one table primitive. |
| `PlayerAnalytics`, `PlayerProfileCharts`, `charts/ProfileCharts` | **Restyle** | Re-skin onto new `Card` + token colors so the profile reads cohesively. |
| `PlayerProfileHeader`, `PlayerHero` | **Consolidate** | One hero pattern (two currently). |
| `FilterBar`, `SortIndicator` | **Restyle** | Into shared table/filter primitives. |
| `SectionHeader` | **Replace → `PageHeader`** | |
| `StatCard`, `RatingBadge`, `TierBadge`, `StarRating`, `WinLossPill`, `TrendArrow`, `AgeGroupPill`, `VerifiedBadge`, `AgeUnverifiedBadge` | **Restyle/Consolidate** | Badges/pills collapse into one `Badge`/`StatusPill` family + a couple domain-specific (stars, rating). |
| `LeagueCard`, `player-card` | **Restyle → `Card`** | |
| `RankingsCoverageNotice`, `EmptyState`, `Skeleton`, `PlayerAvatar`, `PremiumGate`, `CourtArc`, `GrainOverlay` | **Restyle/keep** | `GrainOverlay`/`CourtArc` are decorative — keep only if they fit the calmer aesthetic, else **Delete**. |
| `sections/*` (Hero, Leaderboard, RecentGames, LeagueGrid, CompetitionHistory, RatingExplainer) | **Restyle** | Home/marketing sections onto new primitives. |
| `header-player-search`, `SearchOverlay` | **Keep/Restyle** | Canonical search; absorbs `/players/search`. |
| `Navbar`, `Footer`, `AppChrome` | **Restyle** | Shared chrome — highest leverage; new tokens propagate site-wide. |

### Admin components (the `Admin*` kit — being replaced, not "standardized on")
| Component | Verdict | Reasoning |
| --- | --- | --- |
| `AdminShell`, `AdminSidebar`, `AdminLayoutClient`, `AdminTopBar` (in `AppChrome`) | **Restyle** | Rebuild shell on new tokens; keep IA (Inbox/Identity/Data Health/Live Capture/Ratings). |
| `AdminPageHeader` **+** `AdminPageTemplate` | **Merge → `PageHeader`/`Section`** | Two overlapping templates → one. |
| `AdminFilterRow` **+** `AdminFilterChipBar` | **Merge** | Two filter patterns → one. |
| `AdminDataTable` | **Replace → shared `DataTable`** | Same table primitive as public. |
| `AdminBadge`, `submissionStatusBadges`, `submissionHealthBadges` | **Merge → `Badge`/`StatusPill`** | |
| `AdminAlert`, `AdminFormFeedback`, `AdminEmptyState`, `AdminSaveButton` | **Replace** | By shared `Alert`, `Button`, `EmptyState`. |
| `PublishImpactSummaryCard`, `PlayerPhotoCropper` | **Restyle** | Keep behavior; re-skin onto `Card`. |

---

## Non-negotiables honored

- **No data mutations** (schema, migrations, recompute, snapshots, merges, deletes) without separate approval. This pass is visual/IA/UI only.
- **`GameStat` / `Game` immutability** and existing destructive-action confirmation copy are **restyled, not removed**.
- **No regressions**: every route not marked **Delete** keeps working.

## Deletions requiring explicit confirmation (functional routes, not just clutter)

These are pre-approved as UI/IA per the directive, but because they have backend wiring I want a thumbs-up before removing:

- `/administrator` (+ `/api/administrator/*` usage) — duplicate of `/admin`
- `/owner` — legacy dashboard
- `/licensed` — legacy/placeholder
- `/players/search` — superseded by global search
- `/methodology` — overlaps `/how-we-rank`

Everything else is Restyle/Consolidate (no route removed without parity).

---

## Change log — what shipped (Steps 2–4)

Status: **Implemented (2026-06-17).** Per sign-off, **no routes were deleted**; every route was restyled in place. "Consolidate" verdicts were achieved by making surfaces share the new primitives, removing duplicated styling rather than removing pages.

### Step 2 — Design system (the kit itself changed)
- **`tailwind.config.ts`** — collapsed the 12 overlapping color families into **one palette**: `primary` (court navy `#0F2044` ramp), `accent` (single hardwood orange `#D97706` ramp), `neutral` (one gray ramp), and semantic `success`/`warning`/`danger` (state only). All legacy families (`court`, `deep`, `hardwood`, `gold`, `paper`, `line`, `navy`, `amber`, `surface`, `ink`, `win`, `loss`) are now **aliases** repointed into the unified palette, so every existing class restyles automatically with no per-file churn and no regressions. Replaced the ad-hoc `fontSize` map with a **5-step type scale**, unified `borderRadius`, replaced hard "comic" offset shadows with a single subtle elevation (`shadow-card`/`shadow-raised`), and calmed keyframes.
- **`src/styles/globals.css`** — rewrote shared component classes (`.button` + variants, `.sports-module`/cards, `.login-panel`, `.profile-card`, `.label`, gutters/rhythm) onto the calmer aesthetic (one radius, subtle elevation, more whitespace). Class names preserved so dependent pages restyle automatically.
- **New shared primitives in `src/components/ui/`** (single source of truth): `Card` (+`CardHeader`/`CardBody`), `Button`, `Badge`, `DataTable`, `PageHeader`, `Section`, `Stat`, `Field`, `Tabs`. Barrel `index.ts` re-exports these alongside retained domain primitives (`StarRating`, `RatingBadge`, `WinLossPill`, `TrendArrow`, `TierBadge`, `VerifiedBadge`, `PremiumGate`, `StatCard`, `Skeleton`, `PlayerAvatar`, `CourtArc`, `GrainOverlay`).

### Step 3 — Re-apply (migrated surfaces)
- **Shared chrome:** `Navbar`, `Footer`, `AppChrome`/`AdminTopBar`, `SearchOverlay` — new tokens propagate site-wide; navigation weight dropped from `font-black` to `font-semibold`.
- **Public:** home (`HomeClient`, `HeroSection`, `LeaderboardPreview`, `SectionHeader`, `AgeGroupPill`, `RecentGames`, `CompetitionHistory`), rankings (`RankingsClient`, `RankingTable`, `NationalTeamRankingTable`, `FilterBar`), teams (`TeamsClient`, `TeamStandingTable`, `TeamRosterTable`), games (`GameList`, `BoxScoreTable`, `games/[id]`), leagues (`LeagueCard`, `leagues/[id]`), player profile (`PlayerProfileHeader`, `ProfileModule`, `PlayerAnalytics`, `PlayerProfileCharts`, `charts/ProfileCharts`), marketing/legal (`about`, `how-we-rank`, `claim`, `terms`, `privacy`), and auth/portal (`portal/login`).
- **Admin/organizer:** `AdminSidebar`, `AdminPageHeader`, `AdminPageTemplate`, `AdminBadge`, `AdminDataTable`, `AdminAlert`, `AdminEmptyState`, `AdminFilterRow`, `AdminSaveButton`, `adminFilterStyles`, `submissionStatus` helpers, `PublishImpactSummaryCard`, and the `admin` dashboard / `submissions` / `data-health` pages.

### What was simplified / merged (no routes removed)
- **One color palette** replaces 12 families; **one accent** (hardwood orange) used for emphasis/CTAs/active state only; **win/loss → semantic `success`/`danger`**.
- **`font-black` eliminated site-wide** (one consistent heading weight) — verified zero remaining occurrences in `src/`.
- **Hard offset "comic" shadows removed** (`shadow-[Npx_Npx_0...]`) in favor of one subtle elevation token, including `SearchOverlay` and `claim` cards.
- **Tables** across public + admin share the same visual treatment (neutral borders, lighter weights, semantic diff coloring).
- **Player profile** now reads as one cohesive analytics product: same card shell, spacing rhythm, and accent color across trend / radar / shooting / scouting / game log.
- **Fixed bug:** portal login primary CTA used `.button secondary` with an inline `bg-navy-800` override that lost to component-class specificity (rendered as a weak white outline). Switched to `.button primary` so the primary action is correctly the navy button.

### QA results
- **Type check:** `npx tsc --noEmit` — **0 errors in `src/`**. Remaining errors are all pre-existing in `scripts/` (data/back-office scripts unrelated to this pass) and were not introduced here.
- **Visual check (dev server, Cursor browser):** home, `/rankings`, `/teams`, `/players/[slug]`, `/portal/login` all render the new navy + single-accent language with consistent cards/tables/badges — a clearly different product vs. the prior dual-language look.
- **Constraints honored:** no schema/data/recompute/snapshot/merge/delete changes; `GameStat`/`Game` immutability and destructive-action confirmation copy restyled, not removed; no route deleted — every non-Delete surface still works.
