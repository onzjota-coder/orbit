import {
  type GenerateParams,
  type GeneratedImage,
  type ImageProvider,
  ProviderError,
  fetchWithTimeout,
  requireEnv,
} from "./types";

// Replicate — predictions com polling (o modelo roda async).
export const replicate: ImageProvider = {
  id: "replicate",
  label: "Replicate",
  envKeys: ["REPLICATE_API_TOKEN"],
  models: [
    { id: "black-forest-labs/flux-schnell", label: "FLUX Schnell", costHint: "trial/pago" },
  ],
  isConfigured: () => Boolean(process.env.REPLICATE_API_TOKEN && process.env.REPLICATE_API_TOKEN.length > 10),
  async generate(p: GenerateParams): Promise<GeneratedImage> {
    const started = Date.now();
    const token = requireEnv("REPLICATE_API_TOKEN");
    const model = p.model ?? "black-forest-labs/flux-schnell";
    const create = await fetchWithTimeout(
      "https://api.replicate.com/v1/predictions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "wait=20", // espera até 20s no próprio POST (evita polling longo)
        },
        body: JSON.stringify({
          // modelo oficial exige version hash via /models/{owner}/{name}
          input: {
            prompt: p.prompt,
            aspect_ratio: aspect(p.width ?? 1024, p.height ?? 1024),
            ...(p.seed !== undefined ? { seed: p.seed } : {}),
          },
        }),
        // versão via header de modelo no endpoint de collections não existe;
        // usamos o endpoint de modelo com deploy automático:
        // https://api.replicate.com/v1/models/{owner}/{name}/predictions
      },
      25_000,
    );
    // Replicate /v1/predictions sem version não é aceito — usar endpoint de modelo:
    if (create.status === 422 || create.status === 400) {
      return generateViaModelEndpoint(token, model, p, started);
    }
    if (!create.ok) {
      const detail = await create.text().catch(() => "");
      console.error(`[IMG:replicate] HTTP ${create.status}:`, detail.slice(0, 200));
      throw new ProviderError(`replicate HTTP ${create.status}`, create.status);
    }
    return finishPrediction((await create.json()) as ReplicatePrediction, token, started);
  },
};

async function generateViaModelEndpoint(
  token: string,
  model: string,
  p: GenerateParams,
  started: number,
): Promise<GeneratedImage> {
  const res = await fetchWithTimeout(
    `https://api.replicate.com/v1/models/${model}/predictions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait=20",
      },
      body: JSON.stringify({
        input: {
          prompt: p.prompt,
          aspect_ratio: aspect(p.width ?? 1024, p.height ?? 1024),
          ...(p.seed !== undefined ? { seed: p.seed } : {}),
        },
      }),
    },
    25_000,
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[IMG:replicate] model-endpoint HTTP ${res.status}:`, detail.slice(0, 200));
    throw new ProviderError(`replicate HTTP ${res.status}`, res.status);
  }
  return finishPrediction((await res.json()) as ReplicatePrediction, token, started);
}

type ReplicatePrediction = {
  id?: string;
  status?: string;
  output?: string | string[];
  error?: string;
};

async function finishPrediction(prediction: ReplicatePrediction, token: string, started: number): Promise<GeneratedImage> {
  let current = prediction;
  // Polling até 45s total (o Prefer:wait=20 costuma resolver na 1ª chamada)
  const deadline = Date.now() + 45_000;
  while (
    current.status &&
    !["succeeded", "failed", "canceled"].includes(current.status) &&
    Date.now() < deadline
  ) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetchWithTimeout(
      `https://api.replicate.com/v1/predictions/${current.id}`,
      { headers: { Authorization: `Bearer ${token}` } },
      10_000,
    );
    if (!poll.ok) throw new ProviderError(`replicate poll HTTP ${poll.status}`, poll.status);
    current = (await poll.json()) as ReplicatePrediction;
  }
  if (current.status !== "succeeded") {
    throw new ProviderError(`replicate: status ${current.status ?? "desconhecido"}`);
  }
  const output = Array.isArray(current.output) ? current.output[0] : current.output;
  if (!output) throw new ProviderError("replicate: saída vazia");
  // output é URL — buscamos e convertemos para base64 (a rota devolve data URL ao client)
  const imageRes = await fetchWithTimeout(output, {}, 20_000);
  if (!imageRes.ok) throw new ProviderError(`replicate: falha ao baixar imagem (${imageRes.status})`);
  const buffer = await imageRes.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  const mime = imageRes.headers.get("content-type")?.startsWith("image/")
    ? imageRes.headers.get("content-type")!
    : "image/png";
  // Replicate devolve URL; convertemos pra base64 pra UI tratar tudo igual
  return {
    base64: Buffer.from(binary, "binary").toString("base64"),
    mime,
    provider: "replicate",
    model: "flux-schnell",
    latencyMs: Date.now() - started,
  };
}

function aspect(width: number, height: number): string {
  const ratio = width / height;
  if (ratio > 1.5) return "16:9";
  if (ratio < 0.67) return "9:16";
  return "1:1";
}
