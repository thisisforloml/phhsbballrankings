"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type UseAdminFilterParamsOptions<T extends Record<string, string>> = {
  defaults: T;
  keys: (keyof T)[];
  debounceKey?: keyof T;
  debounceMs?: number;
};

function readParamsFromUrl<T extends Record<string, string>>(searchParams: URLSearchParams, defaults: T, keys: (keyof T)[]): T {
  const next = { ...defaults };
  for (const key of keys) {
    const value = searchParams.get(String(key));
    if (value !== null) {
      next[key] = decodeURIComponent(value) as T[keyof T];
    }
  }
  return next;
}

export function useAdminFilterParams<T extends Record<string, string>>({
  defaults,
  keys,
  debounceKey,
  debounceMs = 300
}: UseAdminFilterParamsOptions<T>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const keysRef = useRef(keys);
  keysRef.current = keys;
  const keysSignature = keys.map(String).join("\0");
  const [filters, setFilters] = useState<T>(() => readParamsFromUrl(searchParams, defaults, keys));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const keyList = keysRef.current;
    const nextFromUrl = readParamsFromUrl(searchParams, defaults, keyList);
    setFilters((previous) => {
      for (const key of keyList) {
        if (previous[key] !== nextFromUrl[key]) return nextFromUrl;
      }
      return previous;
    });
  }, [defaults, keysSignature, searchParams]);

  const writeToUrl = useCallback((next: T) => {
    const keyList = keysRef.current;
    const params = new URLSearchParams(searchParams.toString());

    for (const key of keyList) {
      const value = next[key];
      const defaultValue = defaults[key];
      if (!value || value === defaultValue) {
        params.delete(String(key));
      } else {
        params.set(String(key), value);
      }
    }

    const query = params.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    const currentQuery = searchParams.toString();
    const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;
    if (url === currentUrl) return;

    router.replace(url, { scroll: false });
  }, [defaults, pathname, router, searchParams]);

  const scheduleWrite = useCallback((next: T, immediate: boolean) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    if (immediate) {
      writeToUrl(next);
      return;
    }

    debounceRef.current = setTimeout(() => writeToUrl(next), debounceMs);
  }, [debounceMs, writeToUrl]);

  const patchFilters = useCallback((patch: Partial<T>) => {
    setFilters((previous) => {
      const next = { ...previous, ...patch };
      const shouldDebounce = debounceKey !== undefined && Object.keys(patch).length === 1 && debounceKey in patch;
      scheduleWrite(next, !shouldDebounce);
      return next;
    });
  }, [debounceKey, scheduleWrite]);

  const clearFilters = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setFilters(defaults);
    writeToUrl(defaults);
  }, [defaults, writeToUrl]);

  return { filters, patchFilters, clearFilters };
}
