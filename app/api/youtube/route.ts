import { NextResponse } from "next/server";

type YoutubeResult = {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  publishedAt: string;
};

type CacheEntry = { expires: number; results: YoutubeResult[] };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(req: Request) {
  const query = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!query) return NextResponse.json({ results: [] });

  const key = query.toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return NextResponse.json({ results: cached.results });
  cache.delete(key);

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      error: "sem_chave",
      instrucoes: "Configure YOUTUBE_API_KEY no .env.local. Use a mesma conta Google do Gemini em console.cloud.google.com → YouTube Data API v3 → Enable → API Key.",
    }, { status: 503 });
  }

  try {
    const endpoint = new URL("https://www.googleapis.com/youtube/v3/search");
    endpoint.searchParams.set("part", "snippet");
    endpoint.searchParams.set("q", query);
    endpoint.searchParams.set("type", "video");
    endpoint.searchParams.set("maxResults", "12");
    endpoint.searchParams.set("key", apiKey);
    const response = await fetch(endpoint, { next: { revalidate: 300 } });
    const body = await response.json();
    if (!response.ok) return NextResponse.json({ error: body?.error?.message ?? "Falha na API do YouTube" }, { status: response.status });

    const results: YoutubeResult[] = (body.items ?? []).flatMap((item: { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; thumbnails?: { medium?: { url?: string }; high?: { url?: string } }; publishedAt?: string } }) => {
      const videoId = item.id?.videoId;
      if (!videoId) return [];
      return [{
        videoId,
        title: item.snippet?.title ?? "Vídeo sem título",
        channel: item.snippet?.channelTitle ?? "Canal desconhecido",
        thumbnail: item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.medium?.url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        publishedAt: item.snippet?.publishedAt ?? "",
      }];
    });
    cache.set(key, { expires: Date.now() + CACHE_TTL, results });
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar o YouTube agora." }, { status: 502 });
  }
}
