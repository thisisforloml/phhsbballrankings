import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { getPublicTrustMeta } from "@/lib/public-site-data";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const trustMeta = await getPublicTrustMeta();

  return (
    <>
      <Navbar />
      <div className="-mt-[var(--navbar-height)]">{children}</div>
      <Footer trustMeta={trustMeta} />
    </>
  );
}
