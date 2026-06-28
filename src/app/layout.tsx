import type { Metadata } from "next";
import { AppChrome } from "@/components/layout/AppChrome";
import { BRAND_DESCRIPTION, BRAND_LOGO_HORIZONTAL, BRAND_LOGO_ICON, BRAND_NAME, BRAND_NAME_FULL } from "@/lib/brand";
import { getPublicTrustMeta } from "@/lib/public-site-data";
import "../styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://oncourtrankings.ph"),
  title: {
    default: BRAND_NAME_FULL,
    template: `%s | ${BRAND_NAME_FULL}`,
  },
  description: BRAND_DESCRIPTION,
  applicationName: BRAND_NAME,
  icons: {
    icon: BRAND_LOGO_ICON,
    shortcut: BRAND_LOGO_ICON,
    apple: "/peach-basket/logo-stacked.png",
  },
  openGraph: {
    type: "website",
    siteName: BRAND_NAME,
    title: BRAND_NAME_FULL,
    description: BRAND_DESCRIPTION,
    images: [{ url: BRAND_LOGO_HORIZONTAL, alt: BRAND_NAME_FULL }],
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND_NAME_FULL,
    description: BRAND_DESCRIPTION,
    images: [BRAND_LOGO_HORIZONTAL],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const trustMeta = await getPublicTrustMeta();

  return (
    <html lang="en">
      <head>
        <meta name="format-detection" content="telephone=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        <AppChrome trustMeta={trustMeta}>{children}</AppChrome>
      </body>
    </html>
  );
}
