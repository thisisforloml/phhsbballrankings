# LC1 — SEO Audit

**Audit date:** 2026-06-28

## Present

| Item | Status | Location |
|------|--------|----------|
| `metadataBase` | ✅ | `src/app/layout.tsx` → `https://peachbasket.ph` |
| Title template | ✅ | `%s \| Peach Basket` |
| Default description | ✅ | `BRAND_DESCRIPTION` |
| Open Graph | ✅ | type, siteName, title, description, images |
| Twitter card | ✅ | `summary_large_image` |
| Favicons | ✅ | SVG icon + apple stacked logo |
| Per-route metadata | Partial | See below |
| `generateMetadata` | ✅ | Player, team, game, league detail, rankings gender/age |

## Missing

| Item | Severity | Notes |
|------|----------|-------|
| `src/app/sitemap.ts` | **High** | No sitemap generation |
| `src/app/robots.ts` | **High** | No robots.txt |
| JSON-LD structured data | **Medium** | No `application/ld+json` anywhere |
| Canonical URLs per page | **Low** | Relies on `metadataBase` only |
| `robots` meta tag | **Low** | Not set in root metadata |

## Pages without dedicated metadata

| Route | Impact |
|-------|--------|
| `/teams` | High — indexable list page |
| `/leagues` | High — indexable list page |
| `/claim` | Medium — client component, no `metadata` export |
| `/players` (if exists as list) | Medium |

Pages **with** metadata: `/`, `/rankings`, `/games`, `/about`, `/how-we-rank`, `/faqs`, `/privacy`, `/terms`, dynamic entity pages.

## OG images

- Root OG uses `BRAND_ASSETS.horizontalLogo` (SVG URL).
- Some social crawlers prefer raster — PNG fallbacks exist in `brand.ts` but are not used in metadata.

## Recommendations before marketing SEO launch

1. Add `sitemap.ts` covering players, teams, leagues, games, static pages.
2. Add `robots.ts` allowing public routes, disallowing `/admin`, `/portal`, `/api`.
3. Add metadata to `/teams` and `/leagues`.
4. Optional: `WebSite` + `SportsOrganization` JSON-LD on homepage.

## Not a blocker for soft launch

Direct traffic and partner links work without sitemap; discoverability is limited.
