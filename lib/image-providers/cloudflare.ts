import {
  type GenerateParams,
  type GeneratedImage,
  type ImageProvider,
  ProviderError,
  fetchWithTimeout,
  requireEnv,
} from "./types";

// Cloudflare Workers AI — REST com account id + API token.
// POST https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/black-forest-labs/flux-1-schnell
// Resposta JSON: { result: { image: "<base64>" }, success: true }
export const cloudflare: ImageProvider = {
  id: "cloudflare",
  label: "Cloudflare Workers AI",
  envKeys: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"],
  models: [
    { id: "@cf/black-forest-labs/flux-1-schnell", label: "FLUX.1 Schnell", costHint: "free diário" },
  ],
  isConfigured: () =>
    Boolean(
      process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_API_TOKEN.length > 10 &&
      process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_ACCOUNT_ID.length > 5,
    ),
  async generate(p: GenerateParams): Promise<GeneratedImage> {
    const started = Date.now();
    const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
    const token = requireEnv("CLOUDFLARE_API_TOKEN");
    const model = p.model ?? "@cf/black-forest-labs/flux-1-schnell";
    const res = await fetchWithTimeout(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: p.prompt, seed: p.seed }),
      },
      45_000,
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[IMG:cloudflare] HTTP ${res.status}:`, detail.slice(0, 200));
      throw new ProviderError(`cloudflare HTTP ${res.status}`, res.status);
    }
    const data = (await res.json()) as { success?: boolean; result?: { image?: string }; errors?: unknown[] };
    const b64 = data.result?.image;
    if (!data.success || !b64) {
      console.error("[IMG:cloudflare] resposta sem imagem:", JSON.stringify(data.errors ?? []).slice(0, 200));
      throw new ProviderError("cloudflare: resposta sem imagem");
    }
    return { base64: b64, mime: "image/png", provider: "cloudflare", model, latencyMs: Date.now() - started };
  },
};
