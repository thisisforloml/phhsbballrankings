# LC1 — Launch Verdict

**Audit date:** 2026-06-28

## Recommendation

# ⚠️ Ready with Minor Caveats

Peach Basket is **ready for a controlled production deployment** (soft launch to partners, recruiters, and direct traffic) **after P0 remediation**. It is **not ready for a full marketing/SEO launch** without P1–P2 SEO and error-boundary work.

---

## Evidence supporting readiness

1. **Application runs correctly in development** — home, rankings (238 players), player profiles, games, teams, and leagues compile and return HTTP 200 on a fresh dev server.
2. **Design system adoption is substantive** — `Numeric` and `format/stats.ts` cover rankings, profiles, box scores, hero, search, and claim flows; SVG logos load from `/peach-basket/`; Tailwind `accent-*` utilities compile after the token merge fix.
3. **`src/` TypeScript is clean** — no type errors in application code.
4. **CSS/build pipeline works** — `next build` reaches `✓ Compiled successfully` before the typecheck phase fails.
5. **Data integrity guardrails** — missing players/teams/games/leagues call `notFound()` in server loaders; empty lists use `EmptyState` components.
6. **Core SEO foundation** — root `metadataBase`, OG, Twitter cards, and per-entity metadata on high-value detail pages.

---

## Caveats (must address or accept)

| Caveat | Severity | Mitigation |
|--------|----------|------------|
| `npm run build` fails on `scripts/` type errors | **Blocker** | Exclude `scripts` from production typecheck (see [08-build-health.md](./08-build-health.md)) |
| No `error.tsx` / `not-found.tsx` | High | Add before exposing to broad audience |
| No sitemap/robots | High for SEO | Defer if not relying on organic search |
| ESLint not configured | Medium | Tooling only |
| 0% player photos | Medium | Product/content limitation, not regression |
| Rankings Suspense `null` fallback | Medium | Brief blank flash on slow clients |

---

## What would change the verdict

| To ✅ Ready for Launch | To ❌ Not Ready |
|------------------------|-----------------|
| P0 + P1 complete; build green on CI | Build cannot be fixed without major script rewrite |
| Branded error/404 pages live | Runtime errors discovered on staging |
| Production env validated | `PORTAL_SESSION_SECRET` missing in prod |

---

## Stakeholder summary

> Peach Basket’s public product is functionally complete and visually consistent after the design system migration. The remaining gaps are **deployment pipeline** (build typecheck scope), **error/SEO polish**, and **content** (player photos) — not core ranking or profile functionality. Proceed with soft launch after fixing the build; plan a second wave for SEO and accessibility hardening before paid acquisition.

---

## Sign-off checklist

- [ ] Engineering: P0 build fix merged
- [ ] Ops: production env vars set
- [ ] QA: smoke test on staging
- [ ] Product: accepts photo/SEO limitations for v1
