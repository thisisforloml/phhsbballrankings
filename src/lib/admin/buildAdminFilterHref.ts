export function buildAdminFilterHref(
  basePath: string,
  current: URLSearchParams | string,
  overrides: Record<string, string | null | undefined>
) {
  const params = new URLSearchParams(typeof current === "string" ? current : current.toString());

  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === undefined || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
