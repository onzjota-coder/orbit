import { NextResponse } from "next/server";

export const maxDuration = 15;

const CACHE_TTL = 12 * 60 * 60 * 1000;
const SEARCH_QUERY = "galaxy stars nebula night";

let cache: { images: string[]; expiresAt: number } | null = null;

function isHttpImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return /^https?:$/.test(new URL(value).protocol);
  } catch {
    return false;
  }
}

export async function GET() {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { enabled: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json({ enabled: true, images: cache.images });
  }

  try {
    const params = new URLSearchParams({
      key: apiKey,
      q: SEARCH_QUERY,
      orientation: "horizontal",
      per_page: "30",
      safesearch: "true",
    });
    const response = await fetch(
      `https://pixabay.com/api/?${params.toString()}`,
      {
        signal: AbortSignal.timeout(12000),
      },
    );

    if (!response.ok)
      throw new Error(`Pixabay respondeu com status ${response.status}`);

    const data = (await response.json()) as {
      hits?: { largeImageURL?: string }[];
    };
    const images = (data.hits ?? [])
      .map((hit) => hit.largeImageURL)
      .filter(isHttpImageUrl);

    if (!images.length) throw new Error("Pixabay não retornou imagens");
    cache = { images, expiresAt: Date.now() + CACHE_TTL };
    return NextResponse.json(
      { enabled: true, images },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch (error) {
    console.error("Pixabay background error:", error);
    return NextResponse.json(
      {
        enabled: false,
        error: "Não foi possível carregar imagens do Pixabay agora.",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
