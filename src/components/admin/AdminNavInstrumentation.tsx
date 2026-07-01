"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const LOG = "[NAV_INSTRUMENT_CLIENT]";

function logClient(event: string, fields: Record<string, unknown>) {
  console.log(LOG, JSON.stringify({ event, at: Date.now(), ...fields }));
}

export function AdminNavInstrumentation() {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current === pathname) return;

    logClient("pathname.change", {
      from: previousPathname.current,
      to: pathname,
    });
    previousPathname.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const onLinkClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor?.href) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.origin);
      } catch {
        return;
      }

      if (!url.pathname.startsWith("/admin") && url.pathname !== "/portal/logout") return;

      logClient("link.click", {
        href: url.pathname + url.search,
        tagName: anchor.tagName.toLowerCase(),
        isNextLink: anchor.getAttribute("data-nextjs-link") !== null || anchor.hasAttribute("data-next-mark"),
        defaultPrevented: event.defaultPrevented,
      });
    };

    document.addEventListener("click", onLinkClick, true);
    return () => document.removeEventListener("click", onLinkClick, true);
  }, []);

  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = function instrumentedFetch(input: RequestInfo | URL, init?: RequestInit) {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input instanceof Request
              ? input.url
              : String(input);

      const isAdminNav =
        url.includes("/admin/") || url.includes("_rsc=") || url.endsWith(".rsc") || url.includes("/portal/");

      if (isAdminNav) {
        const requestHeaders = new Headers(
          init?.headers ?? (input instanceof Request ? input.headers : undefined),
        );

        logClient("fetch.start", {
          url,
          method: init?.method ?? (input instanceof Request ? input.method : "GET"),
          credentials: init?.credentials ?? (input instanceof Request ? input.credentials : "same-origin"),
          mode: init?.mode ?? (input instanceof Request ? input.mode : "cors"),
          rscHeader: requestHeaders.get("RSC") ?? requestHeaders.get("rsc"),
          nextRouterPrefetch: requestHeaders.get("Next-Router-Prefetch") ?? requestHeaders.get("next-router-prefetch"),
          secFetchMode: requestHeaders.get("Sec-Fetch-Mode") ?? requestHeaders.get("sec-fetch-mode"),
          secFetchDest: requestHeaders.get("Sec-Fetch-Dest") ?? requestHeaders.get("sec-fetch-dest"),
        });
      }

      return originalFetch.call(this, input, init).then((response) => {
        if (isAdminNav) {
          logClient("fetch.complete", {
            url,
            status: response.status,
            redirected: response.redirected,
            finalUrl: response.url,
          });
        }
        return response;
      });
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
