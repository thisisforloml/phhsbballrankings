import Link from "next/link";
import { BRAND_LOGO_ICON, BRAND_NAME } from "@/lib/brand";

type BrandLogoProps = {
  href?: string;
  className?: string;
  dark?: boolean;
};

export function BrandLogo({ href = "/", className = "", dark = false }: BrandLogoProps) {
  const mark = (
    <>
      <img src={BRAND_LOGO_ICON} alt="" className="mx-auto h-20 w-20 rounded-md object-contain" />
      <span className={`mt-3 block font-display text-4xl font-extrabold ${dark ? "text-white" : "text-navy-800"}`}>
        Peach <span className="text-hardwood-600">Basket</span>
      </span>
    </>
  );

  if (!href) {
    return <div className={`block text-center leading-none ${className}`}>{mark}</div>;
  }

  return (
    <Link href={href} className={`block text-center leading-none ${className}`} aria-label={`${BRAND_NAME} home`}>
      {mark}
    </Link>
  );
}
