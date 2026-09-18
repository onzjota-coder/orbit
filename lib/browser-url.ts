/** Pure URL helpers shared by browser persistence and UI flows. */
export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return /^https?:$/.test(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function normalizeFavoriteUrl(raw: string): string | null {
  try {
    const value = /^https?:\/\//i.test(raw.trim())
      ? raw.trim()
      : `https://${raw.trim()}`;
    const parsed = new URL(value);
    if (!/^https?:$/.test(parsed.protocol)) return null;
    parsed.hash = "";
    if (parsed.pathname === "/" && !parsed.search) parsed.pathname = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}
