import type { Metadata } from "next";
import { Barlow_Condensed, IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Footer, Navbar } from "@/components/layout";
import { AuthProvider } from "@/components/auth/AuthContext";
import "../styles/globals.css";

const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-barlow-condensed"
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plus-jakarta"
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono"
});

export const metadata: Metadata = {
  title: {
    default: "OnCourt Rankings PH",
    template: "%s | OnCourt Rankings PH"
  },
  description: "OnCourt Rankings Philippines tracks verified official basketball games and rankings."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${barlow.variable} ${plusJakarta.variable} ${plexMono.variable}`}>
      <body className="font-sans">
        <AuthProvider>
          <Navbar />
          {children}
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
