import {
  type GenerateParams,
  type GeneratedImage,
  type ImageProvider,
  ProviderError,
  fetchWithTimeout,
} from "./types";
import { getNextKey, getKeyCount } from "@/lib/openrouter_keys";

// OpenRouter — chat/completions com modelo de imagem + modalities ["image","text"].
// A imagem volta em base64 em message.images[0].image_url.data_url (ou inline em content).
export const openrouter: ImageProvider = {
  id: "openrouter",
  label: "OpenRouter (Gemini Image)",
  envKeys: ["OPENROUTER_API_KEY"],
  models: [
    { id: "google/gemini-2.5-flash-image-preview", label: "Gemini 2.5 Flash Image", costHint: "pago" },
  ],
  isConfigured: () => getKeyCount() > 0,
  async generate(p: GenerateParams): Promise<GeneratedImage> {
    const started = Date.now();
    const model = p.model ?? "google/gemini-2.5-flash-image-preview";
    const keys = getKeyCount();
    let lastError: ProviderError | null = null;

    for (let k = 0; k < Math.max(keys, 1); k++) {
      const key = getNextKey();
      if (!key) {
        lastError = new ProviderError("openrouter: sem chave no pool");
        break;
      }
      try {
        const res = await fetchWithTimeout(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://orbit.app",
              "X-Title": "Orbit",
            },
            body: JSON.stringify({
              model,
              modalities: ["image", "text"],
              messages: [{ role: "user", content: p.prompt }],
            }),
          },
          45_000,
        );
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          console.error(`[IMG:openrouter] HTTP ${res.status}:`, detail.slice(0, 200));
          lastError = new ProviderError(`openrouter HTTP ${res.status}`, res.status);
          continue;
        }
        const data = (await res.json()) as {
          choices?: Array<{
            message?: {
              content?: string;
              images?: Array<{ image_url?: { url?: string } }>;
            };
          }>;
        };
        const message = data.choices?.[0]?.message;
        // 1) images[].image_url.url (data URL base64)  2) content com data URL inline
        const imageUrl = message?.images?.[0]?.image_url?.url ?? null;
        const contentUrl = message?.content?.startsWith("data:image/") ? message.content : null;
        const dataUrl = imageUrl ?? contentUrl;
        if (dataUrl) {
          const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
          if (match) {
            return {
              base64: match[2],
              mime: match[1],
              provider: "openrouter",
              model,
              latencyMs: Date.now() - started,
            };
          }
          return { url: dataUrl, provider: "openrouter", model, latencyMs: Date.now() - started };
        }
        lastError = new ProviderError("openrouter: resposta sem imagem");
      } catch (error) {
        lastError = error instanceof ProviderError ? error : new ProviderError("openrouter: falha de rede");
      }
    }
    throw lastError ?? new ProviderError("openrouter: falha desconhecida");
  },
};
