import {
  type GenerateParams,
  type GeneratedImage,
  type ImageProvider,
  ProviderError,
  fetchWithTimeout,
} from "./types";
import { getNextKey, getKeyCount } from "@/lib/gemini_keys";

// Gemini 2.5 Flash Image (AI Studio) — resposta inline_data base64.
// Reusa o pool round-robin de chaves Gemini já existente (lib/key-pool.ts).
export const gemini: ImageProvider = {
  id: "gemini",
  label: "Google Gemini (Flash Image)",
  envKeys: ["GEMINI_API_KEY"],
  models: [
    { id: "gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image", costHint: "free tier AI Studio" },
    { id: "gemini-2.0-flash-exp-image-generation", label: "Gemini 2.0 Flash (exp)", costHint: "free tier" },
  ],
  isConfigured: () => getKeyCount() > 0,
  async generate(p: GenerateParams): Promise<GeneratedImage> {
    const started = Date.now();
    const model = p.model ?? "gemini-2.5-flash-image";
    const keys = getKeyCount();
    let lastError: ProviderError | null = null;

    for (let k = 0; k < Math.max(keys, 1); k++) {
      const key = getNextKey();
      if (!key) {
        lastError = new ProviderError("gemini: sem chave no pool");
        break;
      }
      try {
        const res = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify({
              contents: [{ parts: [{ text: p.prompt }] }],
              generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
            }),
          },
          45_000,
        );
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          console.error(`[IMG:gemini] HTTP ${res.status}:`, detail.slice(0, 200));
          lastError = new ProviderError(`gemini HTTP ${res.status}`, res.status);
          continue; // próxima chave do pool
        }
        const data = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }>;
        };
        const parts = data.candidates?.[0]?.content?.parts ?? [];
        const imagePart = parts.find((part) => part.inlineData?.data);
        if (imagePart?.inlineData?.data) {
          return {
            base64: imagePart.inlineData.data,
            mime: imagePart.inlineData.mimeType ?? "image/png",
            provider: "gemini",
            model,
            latencyMs: Date.now() - started,
          };
        }
        lastError = new ProviderError("gemini: resposta sem imagem");
      } catch (error) {
        lastError = error instanceof ProviderError ? error : new ProviderError("gemini: falha de rede");
      }
    }
    throw lastError ?? new ProviderError("gemini: falha desconhecida");
  },
};
