# Logo Usage

## Asset locations

| Variant | SVG (master) | PNG (runtime UI) |
| --- | --- | --- |
| Horizontal | `/peach-basket/logo-horizontal.svg` | `/logos/logo-horizontal.png` |
| Stacked | `/peach-basket/logo-stacked.svg` | `/logos/logo-stacked.png` |
| Icon | `/peach-basket/icon.svg` | `/logos/logo-icon.png` |

PNG source files live in `logos/` at the repo root and are copied to `public/logos/` for Next.js static serving.

Source masters: `logos/` at repository root.

## Component

```tsx
import { PeachBasketLogo } from "@/components/layout/PeachBasketLogo";

<PeachBasketLogo variant="horizontal" />
<PeachBasketLogo variant="stacked" format="svg" />  {/* vector master when needed */}
```

Paths are defined in `src/lib/brand.ts` → `BRAND_ASSETS`. PNG is the default runtime format.

## Where logos are used

- Navbar (`Navbar.tsx`)
- Admin top bar (`AppChrome.tsx`)
- Login, register, portal login
- Favicon and Open Graph metadata (`layout.tsx`)

All runtime UI uses PNG from `logos/` (via `public/logos/`).

## SVG (optional)

Use `format="svg"` for vector masters — print workflows, marketing exports, or when vector is explicitly required.

## Clear space

Maintain clear space equal to the height of the peach icon mark on all sides.

## Minimum sizes

| Variant | Minimum width |
| --- | --- |
| Horizontal | 120px |
| Stacked | 80px |
| Icon only | 24px |

## Incorrect usage

- Do not stretch or distort aspect ratio
- Do not change logo colors outside brand guidelines
- Do not place on low-contrast backgrounds without a container
- Do not use peach UI chrome to “match” the logo — UI stays navy/orange

## Light / dark mode

- **Light surfaces:** full-color horizontal or stacked logo
- **Dark surfaces (nav, hero):** horizontal logo on `primary-900` background
- Icon mark may be used alone when space is constrained (mobile chrome)
