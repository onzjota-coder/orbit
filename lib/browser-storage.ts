import { domainOf, isHttpUrl, normalizeFavoriteUrl } from "./browser-url";

export type Favorite = { title: string; url: string; folder?: string };
export type UrlHistoryItem = { title: string; url: string; at: number };

export const FAVORITES_STORAGE_KEY = "orbit_favorites";
export const URL_HISTORY_STORAGE_KEY = "orbit_history";
export const URL_HISTORY_MAX = 200;

function readStorageJson(key: string): unknown {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStorageJson(key: string, value: unknown): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {}
}

export function normalizeFavorites(value: unknown): Favorite[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const favorite = item as Partial<Favorite>;
      const url =
        typeof favorite.url === "string"
          ? normalizeFavoriteUrl(favorite.url)
          : null;
      if (!url) return [];
      return [{
        title:
          typeof favorite.title === "string" && favorite.title.trim()
            ? favorite.title.trim()
            : domainOf(url),
        url,
        ...(typeof favorite.folder === "string"
          ? { folder: favorite.folder }
          : {}),
      }];
    })
    .filter(
      (favorite, index, all) =>
        all.findIndex((candidate) => candidate.url === favorite.url) === index,
    );
}

export function normalizeUrlHistory(
  value: unknown,
  now: () => number = Date.now,
): UrlHistoryItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const entry = item as Partial<UrlHistoryItem>;
      const url = isHttpUrl(entry.url) ? entry.url : null;
      return url
        ? [{
            url,
            title:
              typeof entry.title === "string" && entry.title.trim()
                ? entry.title
                : domainOf(url),
            at: typeof entry.at === "number" ? entry.at : now(),
          }]
        : [];
    })
    .slice(-URL_HISTORY_MAX);
}

export function readFavorites(): Favorite[] {
  return normalizeFavorites(readStorageJson(FAVORITES_STORAGE_KEY));
}

export function writeFavorites(favorites: Favorite[]): void {
  writeStorageJson(FAVORITES_STORAGE_KEY, favorites);
}

export function readUrlHistory(): UrlHistoryItem[] {
  return normalizeUrlHistory(readStorageJson(URL_HISTORY_STORAGE_KEY));
}

export function writeUrlHistory(items: UrlHistoryItem[]): void {
  writeStorageJson(URL_HISTORY_STORAGE_KEY, items.slice(-URL_HISTORY_MAX));
}
