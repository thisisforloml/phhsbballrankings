"use client";

import Image from "next/image";
import Link from "next/link";

import { BRAND_ADMIN, BRAND_ASSETS } from "@/lib/brand";

export function AdminTopBar() {
  return (
    <header className="fixed left-0 right-0 top-0 z-40 border-b border-line-500 bg-white/95 backdrop-blur">
      <div className="flex min-h-[4rem] items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/admin" prefetch={false} className="flex items-center gap-3 leading-none">
          <Image
            src={BRAND_ASSETS.icon192}
            alt=""
            width={48}
            height={48}
            sizes="36px"
            className="h-9 w-9 rounded-md object-contain"
          />
          <span>
            <span className="block text-sm font-bold tracking-tight text-court-900">{BRAND_ADMIN}</span>
            <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-court-500">Data operations</span>
          </span>
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/"
            prefetch={false}
            className="hidden rounded-md border border-line-500 px-3 py-2 font-semibold text-court-700 hover:border-court-400 hover:text-court-900 sm:inline-flex"
          >
            View public site
          </Link>
          <Link href="/portal/logout" prefetch={false}>
            Sign out
          </Link>
        </div>
      </div>
    </header>
  );
}
