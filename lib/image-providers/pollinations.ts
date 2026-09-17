import {
  type GenerateParams,
  type GeneratedImage,
  type ImageProvider,
  ProviderError,
  bufferToBase64,
  fetchWithTimeout,
} from "./types";

// Pollinations (FLUX) — grátis, sem chave, SEMPRE o último da fallback chain.
export const pollinations: ImageProvider = {
  id: "pollinations",
  label: "Pollinations (FLUX) — grátis",
  envKeys: [],
  models: [
    { id: "flux", label: "FLUX", costHint: "grátis" },
    { id: "turbo", label: "Turbo", costHint: "grátis" },
  ],
  isConfigured: () => true,
  async generate(p: GenerateParams): Promise<GeneratedImage> {
    const started = Date.now();
    const seed = p.seed ?? Math.floor(Math.random() * 1_000_000);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      p.prompt,
    )}?width=${p.width ?? 1024}&height=${p.height ?? 1024}&model=${p.model ?? "flux"}&nologo=true&enhance=true&seed=${seed}`;
    const res = await fetchWithTimeout(url, { method: "GET" }, 60_000);
    if (!res.ok) {
      throw new ProviderError(`Pollinations HTTP ${res.status}`, res.status);
    }
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength < 1000) {
      throw new ProviderError(`Pollinations resposta inválida (${buffer.byteLength} bytes)`);
    }
    const mime = res.headers.get("content-type")?.startsWith("image/")
      ? res.headers.get("content-type")!
      : "image/jpeg";
    return {
      base64: bufferToBase64(buffer),
      mime,
      provider: "pollinations",
      model: p.model ?? "flux",
      latencyMs: Date.now() - started,
    };
  },
};
