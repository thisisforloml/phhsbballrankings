/** Public product branding - use these constants for user-facing copy. */
export const BRAND_NAME = "Peach Basket";
export const BRAND_NAME_FULL = "Peach Basket PH";
export const BRAND_ADMIN = "Peach Basket Admin";
export const BRAND_ADMIN_EYEBROW = "PEACH BASKET ADMIN";
export const BRAND_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://peachbasket.vercel.app";
export const BRAND_CONTACT_EMAIL = "darwinjosephs00@gmail.com";
export const BRAND_CONTACT_PHONE = "+63 976 216 5301";
export const BRAND_CONTACT_PHONE_E164 = "+639762165301";
export const BRAND_OPERATOR = "Darwin Joseph F. Santos";
export const BRAND_DESCRIPTION =
  "Peach Basket PH tracks official basketball games, player profiles, team records, and rankings across the Philippines.";

/** Production-sized assets - see scripts/generate-brand-assets.mjs */
export const BRAND_ASSETS = {
  favicon: "/peach-basket/optimized/favicon.ico",
  icon32: "/peach-basket/optimized/icon-32.png",
  icon192: "/peach-basket/optimized/icon-192.webp",
  horizontalLogo: "/peach-basket/optimized/logo-horizontal.webp",
  horizontalLogoSm: "/peach-basket/optimized/logo-horizontal-sm.webp",
  appleTouchIcon: "/peach-basket/optimized/apple-touch-icon.png",
  ogImage: "/peach-basket/optimized/og-image.webp",
  /** Legacy vector masters (large; avoid in runtime UI) */
  iconSvg: "/peach-basket/icon.svg",
  horizontalLogoSvg: "/peach-basket/logo-horizontal.svg",
  stackedLogoSvg: "/peach-basket/logo-stacked.svg",
} as const;

/** @deprecated Use BRAND_ASSETS - kept for gradual migration */
export const BRAND_LOGO_ICON = BRAND_ASSETS.icon32;
export const BRAND_LOGO_HORIZONTAL = BRAND_ASSETS.horizontalLogo;
