import { type ImageProvider } from "./types";
import { pollinations } from "./pollinations";
import { together } from "./together";
import { deepinfra } from "./deepinfra";
import { huggingface } from "./huggingface";
import { stability } from "./stability";
import { cloudflare } from "./cloudflare";
import { gemini } from "./gemini";
import { openrouter } from "./openrouter";
import { replicate } from "./replicate";
import { fal } from "./fal";
import { openai } from "./openai";

/** Todos os provedores. Pollinations é sempre o ÚLTIMO da fallback chain. */
export const IMAGE_PROVIDERS: ImageProvider[] = [
  openai,
  together,
  deepinfra,
  huggingface,
  stability,
  cloudflare,
  gemini,
  openrouter,
  replicate,
  fal,
  pollinations, // grátis, nunca falha — sempre por último
];

export function getProvider(id: string): ImageProvider | undefined {
  return IMAGE_PROVIDERS.find((p) => p.id === id);
}

export type ProviderStatus = {
  id: string;
  label: string;
  models: ImageProvider["models"];
  configured: boolean;
  missingEnv: string[];
  capabilities: NonNullable<ImageProvider["capabilities"]>;
  usage: { requests: number; tokens: null; status: "unknown"; quota: string; lastUsed: null };
};

/** Status de configuração para a UI (nunca expõe valores de chave). */
export function providersStatus(): ProviderStatus[] {
  return IMAGE_PROVIDERS.map((p) => {
    const missingEnv = p.envKeys.filter(
      (k) => !process.env[k] || process.env[k]!.length < 8,
    );
    return {
      id: p.id,
      label: p.label,
      models: p.models,
      configured: p.isConfigured(),
      missingEnv,
      capabilities: p.capabilities ?? ["image"],
      usage: { requests: 0, tokens: null, status: "unknown", quota: "Quota não informada pelo provedor", lastUsed: null },
    };
  });
}

/** Fallback chain: pedido → demais configurados → Pollinations por último. */
export function fallbackChain(preferred: string): ImageProvider[] {
  const chosen = getProvider(preferred);
  const others = IMAGE_PROVIDERS.filter(
    (p) => p.id !== preferred && p.isConfigured(),
  );
  const chain: ImageProvider[] = [];
  if (chosen?.isConfigured()) chain.push(chosen);
  chain.push(...others.filter((p) => p.id !== "pollinations"));
  chain.push(pollinations);
  return chain;
}
