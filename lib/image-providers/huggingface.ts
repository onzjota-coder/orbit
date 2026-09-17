import {
  type GenerateParams,
  type GeneratedImage,
  type ImageProvider,
  ProviderError,
  bufferToBase64,
  fetchWithTimeout,
  requireEnv,
} from "./types";

export const huggingface: ImageProvider = {
  id: "huggingface",
  label: "Hugging Face Inference",
  envKeys: ["HF_TOKEN"],
  models: [
    { id: "black-forest-labs/FLUX.1-schnell", label: "FLUX.1 Schnell", costHint: "free tier" },
    { id: "stabilityai/stable-diffusion-xl-base-1.0", label: "SDXL", costHint: "free tier" },
  ],
  isConfigured: () => Boolean(process.env.HF_TOKEN && process.env.HF_TOKEN.length > 10),
  async generate(p: GenerateParams): Promise<GeneratedImage> {
    const started = Date.now();
    const model = p.model ?? "black-forest-labs/FLUX.1-schnell";
    const res = await fetchWithTimeout(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${requireEnv("HF_TOKEN")}`,
          "Content-Type": "application/json",
          Accept: "image/png",
        },
        body: JSON.stringify({
          inputs: p.prompt,
          parameters: { width: p.width ?? 1024, height: p.height ?? 1024, seed: p.seed },
        }),
      },
      45_000,
    );
    const contentType = res.headers.get("content-type") ?? "";
    if (res.ok && contentType.startsWith("image/")) {
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength < 1000) throw new ProviderError("HF: resposta curta");
      return {
        base64: bufferToBase64(buffer),
        mime: contentType,
        provider: "huggingface",
        model,
        latencyMs: Date.now() - started,
      };
    }
    // Erros HF vêm como JSON { error }
    const body = await res.json().catch(() => null) as { error?: string } | null;
    console.error(`[IMG:huggingface] HTTP ${res.status}:`, body?.error?.slice(0, 200) ?? "");
    throw new ProviderError(`huggingface HTTP ${res.status}`, res.status);
  },
};
