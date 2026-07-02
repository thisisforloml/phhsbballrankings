import { LayoutScrollDiagnostics } from "@/components/debug/LayoutScrollDiagnostics";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
      {process.env.NODE_ENV === "development" ? <LayoutScrollDiagnostics /> : null}
    </>
  );
}
