import {
  type GenerateParams,
  type GeneratedImage,
  type ImageProvider,
  ProviderError,
  requireEnv,
  fetchWithTimeout,
} from "./types";

/** Compatível com OpenAI Images API — usado por Together, DeepInfra e OpenAI. */
export async function openAiCompatibleGenerate(
  providerId: string,
  baseUrl: string,
  apiKey: string,
  defaultModel: string,
  p: GenerateParams,
): Promise<GeneratedImage> {
  const started = Date.now();
  const model = p.model ?? defaultModel;
  const res = await fetchWithTimeout(`${baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: p.prompt,
      // Together/DeepInfra aceitam tamanho; gpt-image-1 também
      ...(providerId === "openai"
        ? { size: "1024x1024", n: 1, quality: "high" }
        : { width: p.width ?? 1024, height: p.height ?? 1024 }),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[IMG:${providerId}] HTTP ${res.status}:`, detail.slice(0, 200));
    throw new ProviderError(`${providerId} HTTP ${res.status}`, res.status);
  }
  const data = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const item = data.data?.[0];
  if (item?.b64_json) {
    return { base64: item.b64_json, mime: "image/png", provider: providerId, model, latencyMs: Date.now() - started };
  }
  if (item?.url) {
    return { url: item.url, provider: providerId, model, latencyMs: Date.now() - started };
  }
  throw new ProviderError(`${providerId} respondeu sem imagem`);
}

export const together: ImageProvider = {
  id: "together",
  label: "Together.ai (FLUX Schnell)",
  envKeys: ["TOGETHER_API_KEY"],
  models: [
    { id: "black-forest-labs/FLUX.1-schnell-Free", label: "FLUX.1 Schnell", costHint: "free tier" },
  ],
  isConfigured: () => Boolean(process.env.TOGETHER_API_KEY && process.env.TOGETHER_API_KEY.length > 10),
  generate: (p) =>
    openAiCompatibleGenerate(
      "together",
      "https://api.together.xyz/v1",
      requireEnv("TOGETHER_API_KEY"),
      "black-forest-labs/FLUX.1-schnell-Free",
      p,
    ),
};
