const KNOWN_FAVICONS: Record<string, string> = {
  youtube: "https://www.youtube.com/favicon.ico",
  google: "https://www.google.com/favicon.ico",
  instagram: "https://www.instagram.com/favicon.ico",
};
const cache = new Map<string, string>();

/** Resolves a stable favicon URL without using an emoji as the primary icon. */
export function resolveFavicon(url: string, fallback = "/icon.svg"): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    const cached = cache.get(hostname);
    if (cached) return cached;
    const known = Object.entries(KNOWN_FAVICONS).find(([domain]) => hostname === domain || hostname.endsWith(`.${domain}`))?.[1];
    const resolved = known ?? `https://${hostname}/favicon.ico`;
    cache.set(hostname, resolved);
    return resolved;
  } catch {
    return fallback;
  }
}
