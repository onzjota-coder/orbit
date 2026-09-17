import {
  type GenerateParams,
  type GeneratedImage,
  type ImageProvider,
  ProviderError,
  bufferToBase64,
  fetchWithTimeout,
  requireEnv,
} from "./types";

// Fal.ai — fal.run/{model} síncrono; FAL_KEY pode ser "id:secret" ou só secret.
export const fal: ImageProvider = {
  id: "fal",
  label: "Fal.ai",
  envKeys: ["FAL_KEY"],
  models: [{ id: "fal-ai/flux/schnell", label: "FLUX Schnell", costHint: "créditos" }],
  isConfigured: () => Boolean(process.env.FAL_KEY && process.env.FAL_KEY.length > 10),
  async generate(p: GenerateParams): Promise<GeneratedImage> {
    const started = Date.now();
    const model = p.model ?? "fal-ai/flux/schnell";
    const res = await fetchWithTimeout(
      `https://fal.run/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${requireEnv("FAL_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: p.prompt,
          image_size: size(p.width ?? 1024, p.height ?? 1024),
          ...(p.seed !== undefined ? { seed: p.seed } : {}),
        }),
      },
      45_000,
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[IMG:fal] HTTP ${res.status}:`, detail.slice(0, 200));
      throw new ProviderError(`fal HTTP ${res.status}`, res.status);
    }
    const data = (await res.json()) as { images?: Array<{ url?: string; content_type?: string }> };
    const imageUrl = data.images?.[0]?.url;
    if (!imageUrl) throw new ProviderError("fal: resposta sem imagem");
    // Baixa a URL e converte para base64 (padrão único na resposta)
    const imageRes = await fetchWithTimeout(imageUrl, {}, 20_000);
    if (!imageRes.ok) throw new ProviderError(`fal: falha ao baixar imagem (${imageRes.status})`);
    const declaredType = data.images?.[0]?.content_type;
    const mime = imageRes.headers.get("content-type")?.startsWith("image/")
      ? imageRes.headers.get("content-type")!
      : declaredType && declaredType.startsWith("image/")
        ? declaredType
        : "image/png";
    return {
      base64: bufferToBase64(await imageRes.arrayBuffer()),
      mime,
      provider: "fal",
      model,
      latencyMs: Date.now() - started,
    };
  },
};

function size(width: number, height: number): string {
  const ratio = width / height;
  if (ratio > 1.5) return "landscape_16_9";
  if (ratio < 0.67) return "portrait_16_9";
  return "square_hd";
}
