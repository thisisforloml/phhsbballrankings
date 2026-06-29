# Asset Organization

```
logos/                          # Source masters (repo root) — PNG + SVG
public/logos/                   # Served runtime PNGs (copy from logos/)
  logo-horizontal.png
  logo-stacked.png
  logo-icon.png
public/peach-basket/            # Served SVG masters for web
  logo-horizontal.svg
  logo-stacked.svg
  icon.svg

src/lib/brand.ts                # BRAND_NAME, BRAND_ASSETS paths
src/lib/design-system/          # Design tokens
src/lib/format/stats.ts         # Stat formatting
src/components/design-system/   # Numeric component
src/components/icons/sports/    # Sports icon library
src/components/layout/          # PeachBasketLogo
docs/branding/                  # This documentation
```

## Adding assets

1. Place masters in `logos/`
2. Copy PNG files to `public/logos/` for runtime serving
3. Copy or sync SVG files to `public/peach-basket/` when updated
4. Register path in `src/lib/brand.ts` if user-facing
5. Document in [Logo Usage](./logo-usage.md) or [Icons](./icons.md)

## User uploads

Player photos: `public/uploads/player-photos/` — not brand assets.

League logos: stored as URLs in database — not part of Peach Basket brand kit.
