import {
  type GenerateParams,
  type GeneratedImage,
  type ImageProvider,
  ProviderError,
  bufferToBase64,
  fetchWithTimeout,
  requireEnv,
} from "./types";

export const stability: ImageProvider = {
  id: "stability",
  label: "Stability AI",
  envKeys: ["STABILITY_API_KEY"],
  models: [{ id: "core", label: "Stable Image Core", costHint: "créditos" }],
  isConfigured: () => Boolean(process.env.STABILITY_API_KEY && process.env.STABILITY_API_KEY.length > 10),
  async generate(p: GenerateParams): Promise<GeneratedImage> {
    const started = Date.now();
    const form = new FormData();
    form.append("prompt", p.prompt);
    form.append("output_format", "png");
    form.append("aspect_ratio", aspectRatio(p.width ?? 1024, p.height ?? 1024));
    if (p.seed !== undefined) form.append("seed", String(p.seed));
    const res = await fetchWithTimeout(
      "https://api.stability.ai/v2beta/stable-image/generate/core",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${requireEnv("STABILITY_API_KEY")}`,
          Accept: "image/*",
        },
        body: form,
      },
      45_000,
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[IMG:stability] HTTP ${res.status}:`, detail.slice(0, 200));
      throw new ProviderError(`stability HTTP ${res.status}`, res.status);
    }
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength < 1000) throw new ProviderError("stability: resposta curta");
    return {
      base64: bufferToBase64(buffer),
      mime: "image/png",
      provider: "stability",
      model: "core",
      latencyMs: Date.now() - started,
    };
  },
};

function aspectRatio(width: number, height: number): string {
  const ratio = width / height;
  if (ratio > 1.5) return "16:9";
  if (ratio < 0.67) return "9:16";
  return "1:1";
}
