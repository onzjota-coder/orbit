// Galeria de imagens geradas — últimas 30 em localStorage (prompt + provider + data).
// Mesma estratégia de resiliência do chat-store (try/catch, nunca quebra a UI).

const GALLERY_KEY = "orbit_image_gallery";
export const GALLERY_MAX = 30;

export type GalleryItem = {
  id: string;
  imageDataUrl: string;
  prompt: string;
  provider: string;
  model: string;
  createdAt: number;
  aspectRatio: string;
};

export function loadGallery(): GalleryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GALLERY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GalleryItem[]).slice(0, GALLERY_MAX) : [];
  } catch {
    return [];
  }
}

export function addToGallery(item: Omit<GalleryItem, "id" | "createdAt">): GalleryItem[] {
  const next: GalleryItem[] = [
    { ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: Date.now() },
    ...loadGallery(),
  ].slice(0, GALLERY_MAX);
  try {
    window.localStorage.setItem(GALLERY_KEY, JSON.stringify(next));
  } catch {
    // quota estourada → descarta as mais antigas e tenta de novo
    try {
      window.localStorage.setItem(GALLERY_KEY, JSON.stringify(next.slice(0, 10)));
    } catch {
      /* storage indisponível — segue sem persistir */
    }
  }
  return next;
}

export function clearGallery(): void {
  try {
    window.localStorage.removeItem(GALLERY_KEY);
  } catch {
    /* noop */
  }
}
