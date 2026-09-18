// ─────────────────────────────────────────────────────────────
// Interface ÚNICA de provedores de imagem do Orbit.
// Um arquivo por provedor em lib/image-providers/, todos
// registrados em registry.ts. Nenhuma chave sai do servidor.
// ─────────────────────────────────────────────────────────────

export type GenerateParams = {
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
  seed?: number;
};

/** Declared capabilities let the registry grow beyond image generation. */
export type ProviderCapability = "text" | "image" | "vision";

export type GeneratedImage = {
  /** base64 puro (sem prefixo data:) OU url — pelo menos um */
  base64?: string;
  url?: string;
  /** mime detectado (padrão image/jpeg) */
  mime?: string;
  provider: string;
  model: string;
  latencyMs: number;
};

export class ProviderError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
  }
}

export interface ImageProvider {
  id: string;
  label: string;
  /** variáveis .env que o provedor precisa (todas ou nenhuma) */
  envKeys: string[];
  capabilities?: ProviderCapability[];
  models: { id: string; label: string; costHint?: string }[];
  isConfigured(): boolean;
  generate(p: GenerateParams): Promise<GeneratedImage>;
}

/** Timeout padrão por chamada — a rota aplica 25s no total. */
export const PROVIDER_TIMEOUT_MS = 25_000;

/** Lê uma env obrigatória; lança se ausente (chamado só quando isConfigured() === true). */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 8) {
    throw new ProviderError(`Chave ${name} ausente no servidor`);
  }
  return value;
}

/** ArrayBuffer → base64 (caminho rápido em chunks). */
export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return Buffer.from(binary, "binary").toString("base64");
}

/** Fetch com timeout e erro normalizado. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = PROVIDER_TIMEOUT_MS,
): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}
