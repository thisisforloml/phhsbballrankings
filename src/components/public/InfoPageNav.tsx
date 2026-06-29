import Link from "next/link";

const links = [
  { href: "/about", label: "About Us" },
  { href: "/how-we-rank", label: "How We Rank" },
  { href: "/faqs", label: "FAQs" },
];

export function InfoPageNav({ current }: { current: "about" | "how-we-rank" | "faqs" }) {
  return (
    <nav aria-label="Platform information" className="flex flex-wrap gap-2">
      {links.map((link) => {
        const active = link.href === `/${current}`;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] transition ${
              active
                ? "border-hardwood-600 bg-hardwood-600 text-white"
                : "border-line-500 bg-white text-court-700 hover:border-hardwood-600"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
