# TR-6A Admin Team Ratings Preview — Implementation Report

**Status:** Implemented  
**Date:** 2026-06-17  
**Scope:** Internal admin preview only — no public routes, no `/teams` changes, no snapshots

---

## Summary

Read-only admin page at **`/admin/team-ratings`** for reviewing persisted `ProgramTeamRating` national boards before TR-6 public cutover.

| Deliverable | Location |
|---|---|
| Read layer | `src/lib/team-ratings/get-admin-program-team-rating-board.ts` |
| Admin page | `src/app/admin/team-ratings/page.tsx` |
| Client UI | `src/app/admin/team-ratings/TeamRatingsPreviewClient.tsx` |
| Nav | `AdminSidebar` Advanced → Team Ratings Preview |
| Validation | `scripts/validate-admin-team-ratings-tr6a.ts` |

`TEAM_NATIONAL_RATINGS_ENABLED` remains **false**.

---

## Display contract

| Column | Source |
|---|---|
| rank | Ordinal at read (`index + 1`) |
| program | `Program.fullName` (link to `/admin/programs/[id]`) |
| ageGroup / gender | Board key |
| rating | `ProgramTeamRating.rating` |
| verifiedGameCount / verifiedOpponentCount | Evidence counts |
| formulaVersion | `TeamFormulaVersion.slug` (`TPI-v1`) |
| policyVersion | `evidencePolicyVersion · thresholdPolicyVersion` |
| computedAt | Batch timestamp |

Sort: `rating DESC`, `verifiedGameCount DESC`, `program.fullName ASC` (TR-4 §1.4).

---

## Validation panel

Per selected board:

- **Board size** (+ public-eligible subset)
- **Highest / lowest rating** with program names
- **Below threshold** count
- **Missing program warnings** — soft-deleted `Program` references
- **Version homogeneity** alert if mixed formula/policy stamps

---

## Rollback

### UI-only (immediate)

1. Delete `src/app/admin/team-ratings/`
2. Remove nav entry from `AdminSidebar.tsx` and `adminNav.ts`
3. Optionally delete `get-admin-program-team-rating-board.ts`

No database, compute, or public impact.

### Data unaffected

`ProgramTeamRating` rows remain; only the preview UI is removed.

---

## Manual QA

- [ ] Sign in as ADMIN, open `/admin/team-ratings`
- [ ] ORGANIZER account redirected away from page
- [ ] Filters update URL (`?ageGroup=U16&gender=BOYS`)
- [ ] U16 Boys shows 16 programs; ranks 1–16
- [ ] `/teams` and `/rankings` unchanged
- [ ] No new public API routes

Validation report: `scripts/reports/tr6a-validation-latest.json`

**Validation run:** 10 PASS · 0 FAIL

### Screenshots / visual artifacts

| Artifact | Purpose |
|---|---|
| `docs/planning/audits/tr6a-admin-team-ratings-screenshot.html` | Static U16 Boys board snapshot from live DB |
| `docs/planning/audits/tr6a-admin-team-ratings-preview.png` | UI mockup from live U16 Boys top ranks |

**Note:** If `/admin/team-ratings` shows a blank content area, restart the Next.js dev server after `npx prisma generate` so the in-memory Prisma client includes `programTeamRating`.
