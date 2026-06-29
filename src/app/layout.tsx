import type { Metadata } from "next";
import { AppChrome } from "@/components/layout/AppChrome";
import { BRAND_ASSETS, BRAND_DESCRIPTION, BRAND_NAME, BRAND_NAME_FULL } from "@/lib/brand";
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
    icon: [
      { url: BRAND_ASSETS.favicon, sizes: "32x32" },
      { url: BRAND_ASSETS.icon192, type: "image/webp", sizes: "192x192" },
    ],
    shortcut: BRAND_ASSETS.favicon,
    apple: BRAND_ASSETS.appleTouchIcon,
  },
  openGraph: {
    type: "website",
    siteName: BRAND_NAME,
    title: BRAND_NAME_FULL,
    description: BRAND_DESCRIPTION,
    images: [{ url: BRAND_ASSETS.ogImage, width: 1200, height: 630, alt: BRAND_NAME_FULL }],
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND_NAME_FULL,
    description: BRAND_DESCRIPTION,
    images: [BRAND_ASSETS.ogImage],
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
