const DEFAULT_USER_AGENT = "PeachBasket-Admin-UrlImport/1.0";

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        Accept: "application/json, text/html, */*",
        ...(init?.headers ?? {})
      },
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status}) for ${url}`);
    }
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const text = await fetchText(url, init);
  return JSON.parse(text) as T;
}
